import type { Express } from "express";
import { storage } from "../storage";
import { buildFingerprint, computeOverlap, detectAlmostMet, computeHonestyTier } from "../fingerprint";
import { authenticateRequest, uploadImageDataUrl, notifyNewMessage } from "../http-helpers";
import { pool } from "../db";
import type { RouteDeps } from "./deps";

// Core app: users, discover, matches, messages, photos/upload, bucket-list.
export function registerCoreRoutes(app: Express, deps: RouteDeps) {
  const { io, uploadLimiter } = deps;
  app.get("/api/users", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [allUsers, heroPhotoMap] = await Promise.all([
      storage.getAllUsers(),
      storage.getFirstApprovedPhotoPerUser(),
    ]);
    const safe = allUsers.map(({ password: _, email: _e, stripeCustomerId: _sc, stripeSubscriptionId: _ss, identityVerificationId: _vi, identityVerifiedAt: _vat, photoLicenseAgreed: _pla, ...u }) => ({
      ...u,
      heroPhotoUrl: heroPhotoMap[u.id] ?? null,
    }));
    res.json(safe);
  });

  app.get("/api/discover", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const [currentUser, currentPhotos, connectedIds, allUsers, heroPhotoMap] = await Promise.all([
      storage.getUser(userId),
      storage.getPhotosByUser(userId),
      storage.getMatchedUserIds(userId),
      storage.getAllUsers(),
      storage.getFirstApprovedPhotoPerUser(),
    ]);

    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const myFp = buildFingerprint(currentPhotos, currentUser.adventureTags);
    // Matching app — don't hide people you skipped. Only exclude yourself,
    // anyone you're already connected with (in messaging), and blocks.
    const connectedSet = new Set(connectedIds);

    // Load block lists — exclude anyone the user blocked or who blocked them
    let blockedIds = new Set<string>();
    try {
      const { rows } = await pool.query(
        `SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1`,
        [userId]
      );
      blockedIds = new Set(rows.map((r: any) => r.blocked_id ?? r.blocker_id));
    } catch { /* non-fatal — degrade gracefully */ }

    const candidates = allUsers.filter(u => {
      if (u.id === userId) return false;
      if (connectedSet.has(u.id)) return false;   // already connected → in messaging
      if (blockedIds.has(u.id)) return false;
      // Safety mode: only show verified users to users who enabled it
      if (currentUser.safetyModeEnabled && !u.identityVerified) return false;
      return true;
    });

    // Bulk-load all candidate photos + bucket lists in parallel (eliminates N+1)
    const candidateIds = candidates.map(c => c.id);
    const [allCandidatePhotos] = await Promise.all([
      storage.getAllPhotosForUsers(candidateIds),
    ]);

    // Bucket List matching — fetch current user's and all candidates' pinned destinations
    let myBucketList = new Set<string>();
    const candidateBucketMap = new Map<string, Set<string>>();
    try {
      const [myBL, candidateBLs] = await Promise.all([
        pool.query("SELECT destination_name FROM bucket_list WHERE user_id = $1", [userId]),
        candidateIds.length > 0
          ? pool.query("SELECT user_id, destination_name FROM bucket_list WHERE user_id = ANY($1)", [candidateIds])
          : Promise.resolve({ rows: [] }),
      ]);
      myBucketList = new Set(myBL.rows.map((r: any) => (r.destination_name as string).toLowerCase().trim()));
      for (const row of candidateBLs.rows) {
        if (!candidateBucketMap.has(row.user_id)) candidateBucketMap.set(row.user_id, new Set());
        candidateBucketMap.get(row.user_id)!.add((row.destination_name as string).toLowerCase().trim());
      }
    } catch { /* non-fatal — degrade gracefully */ }

    const now = Date.now();

    const scored = candidates.map(candidate => {
      const candidatePhotos = allCandidatePhotos[candidate.id] ?? [];
      const candidateFp = buildFingerprint(candidatePhotos, candidate.adventureTags);
      const { score, sharedTags } = computeOverlap(myFp, candidateFp);
      const almostMet = detectAlmostMet(currentPhotos, candidatePhotos);
      const age = candidate.dob
        ? Math.floor((Date.now() - new Date(candidate.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

      // Bucket list bonus: each shared destination adds 0.05, capped at 0.25
      const candidateBL = candidateBucketMap.get(candidate.id) ?? new Set<string>();
      const sharedDestinations = [...myBucketList].filter(d => candidateBL.has(d));
      const bucketBonus = Math.min(sharedDestinations.length * 0.05, 0.25);

      const isBoostActive = !!(candidate.boostExpiresAt && new Date(candidate.boostExpiresAt).getTime() > now);

      return {
        id: candidate.id,
        name: candidate.name,
        age,
        ethnicity: candidate.ethnicity,
        tagline: candidate.tagline,
        heroPhotoUrl: heroPhotoMap[candidate.id] ?? candidate.avatarUrl ?? null,
        adventureTags: candidate.adventureTags,
        identityVerified: candidate.identityVerified,
        openToRoaming: candidate.openToRoaming,
        overlapScore: score + bucketBonus,
        sharedTags,
        sharedDestinations,
        almostMet,
        isBoostActive,
        tier: candidate.tier,
      };
    });

    scored.sort((a, b) => {
      // 1. Active boosts always surface first
      if (a.isBoostActive !== b.isBoostActive) return a.isBoostActive ? -1 : 1;
      // 2. Almost Met — shared physical location is the strongest signal
      if (a.almostMet && !b.almostMet) return -1;
      if (!a.almostMet && b.almostMet) return 1;
      // 3. Adventurer tier gets a small priority bump (0.05) for paying for the service
      const aTierBonus = a.tier === "adventurer" ? 0.05 : 0;
      const bTierBonus = b.tier === "adventurer" ? 0.05 : 0;
      return (b.overlapScore + bTierBonus) - (a.overlapScore + aTierBonus);
    });

    res.json(scored);
  });

  app.post("/api/matches/pass", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ message: "targetId required" });
    try {
      await storage.createPass(userId, targetId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // The current user's mutual connections (matched users) — drives the
  // "Crew up with…" panels on Matches and Profile.
  app.get("/api/connections", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const matchedIds = await storage.getMatchedUserIds(userId);
    const users = await Promise.all(matchedIds.map(id => storage.getUser(id)));
    res.json(users.filter(Boolean).map(u => ({ id: u!.id, name: u!.nickname || u!.name, avatarUrl: u!.avatarUrl, tagline: u!.tagline })));
  });

  app.patch("/api/users/:id", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId || sessionUserId !== req.params.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { name, nickname, tagline, location, avatarUrl, adventureTags } = req.body;
    if (tagline !== undefined && typeof tagline === "string" && tagline.length > 60) {
      return res.status(400).json({ message: "Tagline must be 60 characters or less" });
    }
    if (name !== undefined && typeof name === "string" && name.length > 100) {
      return res.status(400).json({ message: "Name must be 100 characters or less" });
    }
    if (nickname !== undefined && typeof nickname === "string" && nickname.length > 40) {
      return res.status(400).json({ message: "Nickname must be 40 characters or less" });
    }
    try {
      const updated = await storage.updateUser(req.params.id, {
        ...(name !== undefined && { name }),
        ...(nickname !== undefined && { nickname: nickname || null }),
        ...(tagline !== undefined && { tagline }),
        ...(location !== undefined && { location }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(adventureTags !== undefined && { adventureTags }),
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bucket-list/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const item = await storage.getBucketItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Not found" });
      if (item.userId !== userId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteBucketItem(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/photos", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const allPhotos = await storage.getPhotosByUser(req.params.id);
    if (authUserId === req.params.id) {
      return res.json(allPhotos);
    }
    const publicPhotos = allPhotos
      .filter(p => p.verdict === "approved")
      .map(({ id, storageUrl, caption, displayOrder, createdAt }) => ({ id, storageUrl, caption, displayOrder, createdAt }));
    res.json(publicPhotos);
  });

  app.post("/api/photos", uploadLimiter, async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    if (req.body.userId && req.body.userId !== authUserId) {
      return res.status(403).json({ message: "Cannot create photos for another user" });
    }
    try {
      const photo = await storage.createPhoto(req.body);
      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload", uploadLimiter, async (req, res) => {
    try {
      const authUserId = await authenticateRequest(req);
      if (!authUserId) return res.status(401).json({ message: "Not authenticated" });

      const { dataUrl, filename, userId, caption, displayOrder } = req.body;
      if (!dataUrl || !filename || !userId) {
        return res.status(400).json({ message: "dataUrl, filename, userId required" });
      }
      if (caption !== undefined && typeof caption === "string" && caption.length > 200) {
        return res.status(400).json({ message: "Caption must be 200 characters or less" });
      }
      if (userId !== authUserId) {
        return res.status(403).json({ message: "Cannot upload photos for another user" });
      }

      const upload = await uploadImageDataUrl(userId, dataUrl);
      if (!upload.ok) return res.status(upload.status).json({ message: upload.message });

      const photo = await storage.createPhoto({
        userId,
        storageUrl: upload.url,
        caption: caption || null,
        displayOrder: displayOrder ?? 0,
        personScore: 0,
        authenticityScore: 100,
        adventureScore: 0,
        verdict: "approved",
        isLicensable: false,
      });

      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/matches", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const userMatches = await storage.getMatchesForUser(userId);
    res.json(userMatches);
  });

  app.post("/api/matches", async (req, res) => {
    // Must be authenticated — the initiator must be the session user
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const { userAId, userBId, status } = req.body;
      if (!userAId || !userBId) return res.status(400).json({ message: "userAId and userBId are required" });

      // Prevent forging likes on behalf of other users
      if (userAId !== sessionUserId) {
        return res.status(403).json({ message: "Forbidden — you can only like as yourself" });
      }

      // Block matches involving demo profiles — they are display-only placeholders
      if (String(userAId).startsWith("demo-") || String(userBId).startsWith("demo-")) {
        return res.json({ isNewMatch: false, demo: true });
      }

      // Enforce free-tier connection limit (3 per month)
      const initiatorId = sessionUserId;
      const initiator = await storage.getUser(initiatorId);
      if (initiator && (initiator.tier === "free" || !initiator.tier)) {
        const sentThisMonth = await storage.getMonthlyConnectionsSent(initiatorId);
        if (sentThisMonth >= 3) {
          return res.status(403).json({
            message: "Free plan limit reached",
            limitReached: true,
            upgradeRequired: true,
          });
        }
      }

      const notifyConnection = (otherUserId: string, matchId: string) => {
        storage.getUser(sessionUserId).then(me =>
          storage.createNotification({
            userId: otherUserId,
            type: "match",
            title: "New connection!",
            body: me?.name ? `${me.name} connected with you — say hi!` : "You have a new connection",
            data: JSON.stringify({ matchId }),
          })
        ).catch(() => {});
      };

      // Matching app: a like is an instant connection. If any record already
      // exists (a prior like either way, or even a past pass), connect now.
      const existing = await storage.getMatchBetween(userAId, userBId);
      if (existing) {
        if (existing.status === "matched") {
          return res.json({ ...existing, isNewMatch: false, alreadyExists: true });
        }
        const updated = await storage.updateMatchStatus(existing.id, "matched", { matchedAt: new Date() });
        const otherUserId = userAId === sessionUserId ? userBId : userAId;
        notifyConnection(otherUserId, updated?.id ?? existing.id);
        return res.json({ ...updated, isNewMatch: true });
      }

      // Silently compute adventure fingerprint overlap — never exposed to clients
      let overlapScore = 0;
      let sharedTags: string[] = [];
      let almostMetLocation: string | null = null;
      let almostMetDate: string | null = null;
      try {
        const [photosA, photosB, userA, userB] = await Promise.all([
          storage.getPhotosByUser(userAId),
          storage.getPhotosByUser(userBId),
          storage.getUser(userAId),
          storage.getUser(userBId),
        ]);
        if (userA && userB) {
          const fpA = buildFingerprint(photosA, userA.adventureTags);
          const fpB = buildFingerprint(photosB, userB.adventureTags);
          const overlap = computeOverlap(fpA, fpB);
          overlapScore = overlap.score;
          sharedTags = overlap.sharedTags;
          const almostMet = detectAlmostMet(photosA, photosB);
          if (almostMet) {
            almostMetLocation = almostMet.location;
            almostMetDate = almostMet.dateHint;
          }
        }
      } catch { /* fingerprint errors must never block match creation */ }

      const match = await storage.createMatch({
        userAId, userBId, status: "matched", matchedAt: new Date(),
        overlapScore, sharedTags,
        ...(almostMetLocation && { almostMetLocation, almostMetDate }),
      });
      notifyConnection(userBId, match.id);
      res.status(201).json({ ...match, isNewMatch: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/honesty", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const photos = await storage.getPhotosByUser(req.params.id);
      const tier = computeHonestyTier(photos);
      res.json({ tier });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/matches/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { status } = req.body;
    const updated = await storage.updateMatchStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Match not found" });
    res.json(updated);
  });

  app.get("/api/matches/:matchId/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // Verify requesting user is a participant in this match
    const match = await storage.getMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ message: "Not authorised to view these messages" });
    }
    const msgs = await storage.getMessagesByMatch(req.params.matchId);
    res.json(msgs);
  });

  app.post("/api/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.body.senderId && req.body.senderId !== userId) {
      return res.status(403).json({ message: "Cannot send messages as another user" });
    }
    const content: string = req.body.content ?? "";
    if (!content || content.length > 2000) {
      return res.status(400).json({ message: "Message must be 1–2000 characters" });
    }
    // Verify match exists, is mutually matched, and sender is a participant
    const match = await storage.getMatchById(req.body.matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (match.status !== "matched") {
      return res.status(403).json({ message: "Messaging requires a mutual match" });
    }
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ message: "You are not a participant in this match" });
    }
    try {
      const msg = await storage.createMessage({ matchId: req.body.matchId, senderId: userId, content });
      // Deliver to anyone in the live chat room and alert the recipient's bell,
      // mirroring the socket path so HTTP-sent messages aren't silently dropped.
      io.to(`match:${req.body.matchId}`).emit("new_message", msg);
      notifyNewMessage(match, userId, content).catch(() => {});
      res.status(201).json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bucket-list/:userId", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
    if (sessionUserId !== req.params.userId) return res.status(403).json({ message: "Not authorized" });
    const items = await storage.getBucketListByUser(req.params.userId);
    res.json(items);
  });

  app.post("/api/bucket-list", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const name = typeof req.body?.destinationName === "string" ? req.body.destinationName.trim() : "";
      if (!name) return res.status(400).json({ message: "Destination name is required" });
      if (name.length > 80) return res.status(400).json({ message: "Destination name must be 80 characters or less" });
      const imageUrl = typeof req.body?.imageUrl === "string" && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : null;

      // Prevent duplicates (case-insensitive) and cap the list size
      const existing = await storage.getBucketListByUser(userId);
      if (existing.length >= 30) return res.status(400).json({ message: "You can pin up to 30 destinations." });
      if (existing.some(b => b.destinationName.trim().toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: "You've already pinned that destination." });
      }

      const item = await storage.createBucketItem({ userId, destinationName: name, imageUrl });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upload a photo for a dream destination. Stores it in the photos bucket under
  // the user's destinations/ prefix and returns the public URL — it does NOT
  // create a photos record, so it never appears among the user's adventure shots.
  app.post("/api/bucket-list/image", uploadLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const upload = await uploadImageDataUrl(userId, req.body?.dataUrl, "destinations");
      if (!upload.ok) return res.status(upload.status).json({ message: upload.message });
      res.status(201).json({ url: upload.url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
