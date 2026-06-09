import type { Express } from "express";
import { storage } from "../storage";
import { authenticateRequest, toPublicAd } from "../http-helpers";

// All group, member, campsite, broadcast, event, invite, and RSVP routes.
export function registerGroupRoutes(app: Express) {
  // ─── Group eligibility helper ─────────────────────────────────────────────
  // Squad (2–5) and Crew (6–20) are FREE — available from signup so as many small
  // groups as possible can form. Community (20–100) and Organiser (∞) are larger,
  // higher-planning groups and require a paid tier (Adventurer or Organiser plan).
  async function checkGroupLeaderEligibility(userId: string, type?: string): Promise<{ eligible: boolean; reason?: string; checks?: Record<string, boolean>; needsUpgrade?: boolean }> {
    const user = await storage.getUser(userId);
    if (!user) return { eligible: false, reason: "User not found" };

    const requiresPaid = type === "community" || type === "organiser";
    if (!requiresPaid) {
      // Free: Squad & Crew — no paywall, no profile gate.
      return { eligible: true };
    }

    const photos = await storage.getPhotosByUser(userId);
    const hasApprovedPhoto = photos.some(p => p.verdict === "approved");
    const tags = user.adventureTags ?? [];
    const isFoundingOrGifted = user.isFoundingMember || user.isTierGifted;
    const checks = {
      tier: user.tier === "adventurer" || user.tier === "contributor" || isFoundingOrGifted || user.isOrganiser,
      photo: hasApprovedPhoto,
      tagline: !!user.tagline,
      tags: tags.length >= 3,
    };
    if (!checks.tier) return { eligible: false, reason: "Community & Organiser groups need an Adventurer or Organiser plan", checks, needsUpgrade: true };
    if (!checks.photo) return { eligible: false, reason: "At least one approved adventure photo required", checks };
    if (!checks.tagline) return { eligible: false, reason: "Add a tagline to your profile", checks };
    if (!checks.tags) return { eligible: false, reason: "Add at least 3 adventure tags to your profile", checks };
    return { eligible: true, checks };
  }

  // ─── Groups REST API ──────────────────────────────────────────────────────

  app.get("/api/groups", async (req, res) => {
    const allGroups = await storage.getAllGroups();
    const enriched = await Promise.all(allGroups.map(async g => {
      const members = await storage.getGroupMembers(g.id);
      const approvedCount = members.filter(m => m.status === "approved").length;
      return { ...g, memberCount: approvedCount };
    }));
    res.json(enriched);
  });

  app.get("/api/groups/my-led", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.json([]);
    const led = await storage.getGroupsLedByUser(userId);
    res.json(led);
  });

  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const members = await storage.getGroupMembers(req.params.id);
    const approvedCount = members.filter(m => m.status === "approved").length;
    res.json({ ...group, memberCount: approvedCount });
  });

  app.post("/api/groups", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const eligibility = await checkGroupLeaderEligibility(userId, req.body?.type);
    if (!eligibility.eligible) return res.status(403).json({ error: eligibility.reason, needsUpgrade: eligibility.needsUpgrade });
    const { name, description, type, location, adventureTags, coverImageUrl, visibility } = req.body;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    const maxSizeMap: Record<string, number> = { squad: 5, crew: 20, community: 100, organiser: 1000 };
    const group = await storage.createGroup({
      name,
      description: description ?? null,
      type,
      maxSize: maxSizeMap[type] ?? 5,
      leaderId: userId,
      location: location ?? null,
      adventureTags: adventureTags ?? null,
      coverImageUrl: coverImageUrl ?? null,
      visibility: visibility ?? "open",
      isActive: true,
    });
    await storage.addGroupMember({ groupId: group.id, userId, role: "leader", status: "approved", joinedAt: new Date() });
    res.json(group);
  });

  app.patch("/api/groups/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can edit the group" });
    const { name, description, location, adventureTags, coverImageUrl, visibility } = req.body;
    const updated = await storage.updateGroup(req.params.id, { name, description, location, adventureTags, coverImageUrl, visibility } as any);
    res.json(updated);
  });

  app.delete("/api/groups/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can dissolve the group" });
    await storage.deleteGroup(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/groups/eligibility/check", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    // Base (Squad/Crew) is always free; also report whether the user can create
    // the paid Community/Organiser sizes, so the UI can lock + offer the upgrade.
    const base = await checkGroupLeaderEligibility(userId);
    const large = await checkGroupLeaderEligibility(userId, "community");
    res.json({ ...base, canCreateLargeGroups: large.eligible, upgradeReason: large.needsUpgrade ? large.reason : large.reason });
  });

  // ─── Group members ────────────────────────────────────────────────────────

  app.get("/api/groups/:id/members", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isLeader = group.leaderId === sessionUserId;
    const allMembers = await storage.getGroupMembers(req.params.id);
    const visibleMembers = isLeader ? allMembers : allMembers.filter(m => m.status === "approved");
    const enriched = await Promise.all(visibleMembers.map(async m => {
      const user = await storage.getUser(m.userId);
      const hero = await storage.getHeroPhoto(m.userId);
      return { ...m, user: user ? { id: user.id, name: user.nickname || user.name, avatarUrl: user.avatarUrl, location: user.location, tier: user.tier, heroPhotoUrl: hero?.url ?? null } : null };
    }));
    res.json(enriched);
  });

  app.post("/api/groups/:id/join", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || !group.isActive) return res.status(404).json({ error: "Group not found" });
    const existing = await storage.getGroupMember(req.params.id, userId);
    if (existing) return res.status(409).json({ error: "Already a member or pending" });
    const members = await storage.getGroupMembers(req.params.id);
    const approved = members.filter(m => m.status === "approved").length;
    if (approved >= group.maxSize) return res.status(400).json({ error: "Group is full" });
    const status = group.visibility === "open" ? "approved" : "pending";
    const member = await storage.addGroupMember({
      groupId: req.params.id,
      userId,
      role: "member",
      status,
      joinedAt: status === "approved" ? new Date() : undefined,
    });
    if (status === "pending") {
      await storage.createNotification({ userId: group.leaderId, type: "join_request", title: "New join request", body: `Someone wants to join ${group.name}`, data: JSON.stringify({ groupId: group.id }) });
    }
    res.json(member);
  });

  // The leader's matched connections who aren't already in this group — the pool
  // they can pull straight into a Squad/Crew (no email needed).
  app.get("/api/groups/:id/invitable-connections", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the leader can invite" });
    const [matchedIds, members] = await Promise.all([
      storage.getMatchedUserIds(userId),
      storage.getGroupMembers(req.params.id),
    ]);
    const memberIds = new Set(members.map(m => m.userId));
    const invitableIds = matchedIds.filter(id => !memberIds.has(id));
    const users = await Promise.all(invitableIds.map(id => storage.getUser(id)));
    res.json(users.filter(Boolean).map(u => ({ id: u!.id, name: u!.nickname || u!.name, avatarUrl: u!.avatarUrl, tagline: u!.tagline })));
  });

  // Smart crew-up: find-or-create a 1:1 squad with a matched connection. Avoids
  // duplicate squads if you've already crewed up with this person.
  app.post("/api/groups/crew-up", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const targetId = req.body?.userId;
    if (!targetId) return res.status(400).json({ error: "userId required" });
    const matchedIds = await storage.getMatchedUserIds(userId);
    if (!matchedIds.includes(targetId)) return res.status(403).json({ error: "You can only crew up with people you've connected with" });

    // Already have a squad you lead with exactly the two of you? Reuse it.
    const led = await storage.getGroupsLedByUser(userId);
    for (const g of led) {
      if (g.type !== "squad" || !g.isActive) continue;
      const members = await storage.getGroupMembers(g.id);
      const approved = members.filter(m => m.status === "approved").map(m => m.userId);
      if (approved.length === 2 && approved.includes(userId) && approved.includes(targetId)) {
        return res.json({ ...g, existing: true });
      }
    }

    const [me, them] = await Promise.all([storage.getUser(userId), storage.getUser(targetId)]);
    const first = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "Crew";
    const group = await storage.createGroup({
      name: `${first(me?.nickname || me?.name)} & ${first(them?.nickname || them?.name)}`,
      type: "squad", maxSize: 5, leaderId: userId, visibility: "closed", isActive: true,
    } as any);
    await storage.addGroupMember({ groupId: group.id, userId, role: "leader", status: "approved", joinedAt: new Date() });
    await storage.addGroupMember({ groupId: group.id, userId: targetId, role: "member", status: "approved", joinedAt: new Date() });
    await storage.createNotification({
      userId: targetId, type: "group_invite",
      title: `Added to ${group.name}`,
      body: `${me?.nickname || me?.name || "Someone"} crewed up with you — say hi in the campsite!`,
      data: JSON.stringify({ groupId: group.id }),
    });
    res.status(201).json({ ...group, existing: false });
  });

  // Add a mutual connection straight into the group. They're pre-approved (both
  // already opted into each other) and get a notification so they know.
  app.post("/api/groups/:id/invite-connection", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const targetId = req.body?.userId;
    if (!targetId) return res.status(400).json({ error: "userId required" });
    const group = await storage.getGroup(req.params.id);
    if (!group || !group.isActive) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the leader can invite" });
    const matchedIds = await storage.getMatchedUserIds(userId);
    if (!matchedIds.includes(targetId)) return res.status(403).json({ error: "You can only invite people you've connected with" });
    const existing = await storage.getGroupMember(req.params.id, targetId);
    if (existing) return res.status(409).json({ error: "Already in this group" });
    const members = await storage.getGroupMembers(req.params.id);
    if (members.filter(m => m.status === "approved").length >= group.maxSize) {
      return res.status(400).json({ error: "Group is full" });
    }
    const member = await storage.addGroupMember({
      groupId: req.params.id, userId: targetId, role: "member", status: "approved", joinedAt: new Date(),
    });
    const inviter = await storage.getUser(userId);
    await storage.createNotification({
      userId: targetId,
      type: "group_invite",
      title: `Added to ${group.name}`,
      body: `${inviter?.name || "Someone"} added you to their ${group.type} — say hi in the campsite!`,
      data: JSON.stringify({ groupId: group.id }),
    });
    res.json(member);
  });

  app.post("/api/groups/:id/leave", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId === userId) return res.status(400).json({ error: "Leader cannot leave — transfer leadership or dissolve the group" });
    await storage.removeGroupMember(req.params.id, userId);
    res.json({ success: true });
  });

  app.patch("/api/groups/:id/members/:userId/approve", async (req, res) => {
    const requesterId = await authenticateRequest(req);
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can approve members" });
    const member = await storage.getGroupMember(req.params.id, req.params.userId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const updated = await storage.updateGroupMember(member.id, { status: "approved", joinedAt: new Date() });
    await storage.createNotification({ userId: req.params.userId, type: "join_approved", title: "Join request approved", body: `You've been approved to join ${group.name}!`, data: JSON.stringify({ groupId: group.id }) });
    res.json(updated);
  });

  app.patch("/api/groups/:id/members/:userId/reject", async (req, res) => {
    const requesterId = await authenticateRequest(req);
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can reject members" });
    await storage.removeGroupMember(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  app.delete("/api/groups/:id/members/:userId", async (req, res) => {
    const requesterId = await authenticateRequest(req);
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== requesterId && requesterId !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
    await storage.removeGroupMember(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  // ─── Campsite (group messages) ────────────────────────────────────────────

  app.get("/api/groups/:id/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const member = await storage.getGroupMember(req.params.id, userId);
    if (!member || member.status !== "approved") return res.status(403).json({ error: "You are not a member of this group" });
    const msgs = await storage.getGroupMessages(req.params.id, 100);
    const enriched = await Promise.all(msgs.map(async m => {
      const sender = await storage.getUser(m.senderId);
      return { ...m, sender: sender ? { id: sender.id, name: sender.nickname || sender.name, avatarUrl: sender.avatarUrl } : null };
    }));
    res.json(enriched);
  });

  // ─── Squad Leader broadcast ───────────────────────────────────────────────

  app.post("/api/groups/:id/broadcast", async (req, res) => {
    const requesterId = await authenticateRequest(req);
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });

    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can send announcements" });

    const { message: content, recipientIds } = req.body as { message: string; recipientIds: string[] };
    if (!content?.trim()) return res.status(400).json({ error: "Message is required" });
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) return res.status(400).json({ error: "Select at least one recipient" });

    // Verify all recipients are approved members
    const allMembers = await storage.getGroupMembers(req.params.id);
    const approvedIds = new Set(allMembers.filter(m => m.status === "approved").map(m => m.userId));
    const validRecipients = recipientIds.filter(uid => approvedIds.has(uid) && uid !== requesterId);
    if (validRecipients.length === 0) return res.status(400).json({ error: "No valid recipients" });

    // Post as an announcement in the campsite
    const leader = await storage.getUser(requesterId);
    const msg = await storage.createGroupMessage({ groupId: req.params.id, senderId: requesterId, content: content.trim(), isAnnouncement: true });

    // Notify each recipient
    await Promise.all(validRecipients.map(uid =>
      storage.createNotification({
        userId: uid,
        type: "group_broadcast",
        title: `📢 ${group.name}`,
        body: content.trim().length > 80 ? content.trim().slice(0, 80) + "…" : content.trim(),
        data: JSON.stringify({ groupId: req.params.id }),
      })
    ));

    res.json({ success: true, message: { ...msg, sender: leader ? { id: leader.id, name: leader.name, avatarUrl: leader.avatarUrl } : null }, recipientCount: validRecipients.length });
  });

  // ─── Group events ─────────────────────────────────────────────────────────

  app.get("/api/groups/:id/events", async (req, res) => {
    const events = await storage.getGroupEvents(req.params.id);
    res.json(events);
  });

  app.post("/api/groups/:id/events", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const member = await storage.getGroupMember(req.params.id, userId);
    if (!member || member.status !== "approved" || (member.role !== "leader" && member.role !== "moderator")) {
      return res.status(403).json({ error: "Only leaders can create events" });
    }
    const { title, description, location, startAt, endAt, ticketPriceNzd } = req.body;
    if (!title || !startAt) return res.status(400).json({ error: "title and startAt are required" });
    const parsedTicketPrice = ticketPriceNzd ? Math.round(parseFloat(ticketPriceNzd) * 100) : null;
    const event = await storage.createGroupEvent({
      groupId: req.params.id,
      createdBy: userId,
      title,
      description: description ?? null,
      location: location ?? null,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      ticketPriceNzd: parsedTicketPrice,
    });
    const members = await storage.getGroupMembers(req.params.id);
    const approved = members.filter(m => m.status === "approved" && m.userId !== userId);
    await Promise.all(approved.map(m => storage.createNotification({ userId: m.userId, type: "group_event", title: "New group event", body: `${group.name}: ${title}`, data: JSON.stringify({ groupId: group.id, eventId: event.id }) })));
    res.json(event);
  });

  app.delete("/api/groups/:id/events/:eventId", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can delete events" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event || event.groupId !== req.params.id) return res.status(404).json({ error: "Event not found in this group" });
    await storage.deleteGroupEvent(req.params.eventId);
    res.json({ success: true });
  });

  // ─── Group Invites ────────────────────────────────────────────────────────

  app.post("/api/groups/:id/invites", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can invite members" });
    const { email, message } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ error: "Email required" });
    const normalised = email.trim().toLowerCase();
    const existing = await storage.getGroupInvitesByGroup(group.id);
    const alreadyInvited = existing.find(i => i.invitedEmail === normalised && i.status === "pending");
    if (alreadyInvited) return res.status(409).json({ error: "This person has already been invited and hasn't responded yet" });
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await storage.createGroupInvite({
      groupId: group.id,
      invitedEmail: normalised,
      invitedByUserId: userId,
      token,
      message: message || null,
      expiresAt,
    });
    const inviteUrl = `${req.protocol}://${req.get("host")}/invite/${token}`;
    const inviter = await storage.getUser(userId);
    const inviterName = inviter?.name || "Someone";
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "LetsRoam.life <noreply@letsroam.life>",
          to: normalised,
          subject: `${inviterName} invited you to join ${group.name} on LetsRoam.life`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0e1a0d;color:#e8dcc8;padding:32px;border-radius:16px">
              <h1 style="font-size:28px;margin-bottom:4px;color:#e8dcc8">roam.</h1>
              <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,220,200,0.4);margin-top:0">adventure matching</p>
              <hr style="border-color:rgba(232,220,200,0.1);margin:24px 0"/>
              <p style="font-size:16px;color:rgba(232,220,200,0.85)"><strong style="color:#e8dcc8">${inviterName}</strong> has invited you to join <strong style="color:#a4e63a">${group.name}</strong> on roam.</p>
              ${message ? `<blockquote style="border-left:3px solid rgba(164,230,58,0.4);margin:16px 0;padding:8px 16px;color:rgba(232,220,200,0.6);font-style:italic">${message}</blockquote>` : ""}
              <p style="color:rgba(232,220,200,0.5);font-size:13px">Joining connects you with adventure-minded people planning real experiences together.</p>
              <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#a4e63a;color:#0e1a0d;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">Accept Invite</a>
              <p style="color:rgba(232,220,200,0.3);font-size:11px;margin-top:24px">This invite expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
            </div>
          `,
        });
      } catch (e) {
        console.warn("[invite] Email send failed:", e);
      }
    }
    res.json({ success: true, inviteUrl, token: invite.token });
  });

  app.get("/api/groups/:id/invites", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== userId) return res.status(403).json({ error: "Forbidden" });
    const invites = await storage.getGroupInvitesByGroup(req.params.id);
    res.json(invites);
  });

  app.get("/api/invites/:token", async (req, res) => {
    const invite = await storage.getGroupInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") return res.status(410).json({ error: "This invite has already been used or expired", status: invite.status });
    if (new Date() > invite.expiresAt) {
      await storage.updateGroupInviteStatus(invite.id, "expired");
      return res.status(410).json({ error: "This invite has expired" });
    }
    const group = await storage.getGroup(invite.groupId);
    const inviter = await storage.getUser(invite.invitedByUserId);
    res.json({
      invite,
      group: group ? { id: group.id, name: group.name, description: group.description, type: group.type, visibility: group.visibility, coverImageUrl: group.coverImageUrl } : null,
      inviterName: inviter?.name || "A member",
    });
  });

  app.post("/api/invites/:token/accept", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Login required to accept this invite" });
    const invite = await storage.getGroupInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") return res.status(410).json({ error: "This invite has already been used or expired" });
    if (new Date() > invite.expiresAt) {
      await storage.updateGroupInviteStatus(invite.id, "expired");
      return res.status(410).json({ error: "This invite has expired" });
    }
    const existing = await storage.getGroupMember(invite.groupId, userId);
    if (existing) {
      await storage.updateGroupInviteStatus(invite.id, "accepted");
      return res.json({ success: true, alreadyMember: true });
    }
    const group = await storage.getGroup(invite.groupId);
    if (!group) return res.status(404).json({ error: "Group no longer exists" });
    const members = await storage.getGroupMembers(invite.groupId);
    const approvedCount = members.filter(m => m.status === "approved").length;
    if (approvedCount >= group.maxSize) return res.status(409).json({ error: "This group is now full" });
    await storage.addGroupMember({ groupId: invite.groupId, userId, role: "member", status: "pending" });
    await storage.updateGroupInviteStatus(invite.id, "accepted");
    const leader = group.leaderId;
    await storage.createNotification({
      userId: leader,
      type: "group_invite_accepted",
      title: "Invite accepted",
      body: `Someone accepted your invite to ${group.name} — check their profile before approving.`,
      data: JSON.stringify({ groupId: group.id }),
    });
    res.json({ success: true, groupId: invite.groupId });
  });

  // ─── Event RSVP ───────────────────────────────────────────────────────────

  app.post("/api/events/:eventId/rsvp", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const member = await storage.getGroupMember(event.groupId, userId);
    if (!member || member.status !== "approved") return res.status(403).json({ error: "You must be an approved group member to RSVP" });
    if (event.ticketPriceNzd) {
      return res.status(402).json({ error: "This event requires a ticket", requiresTicket: true, eventId: event.id });
    }
    await storage.rsvpEvent(req.params.eventId, userId);
    res.json({ success: true });
  });

  app.delete("/api/events/:eventId/rsvp", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    await storage.unrsvpEvent(req.params.eventId, userId);
    res.json({ success: true });
  });

  app.get("/api/events/upcoming", async (req, res) => {
    const userId = await authenticateRequest(req) ?? undefined;
    const events = await storage.getUpcomingEvents(userId);
    res.json(events);
  });

  app.get("/api/events/public", async (req, res) => {
    const events = await storage.getPublicEventAds();
    res.json(events.map(toPublicAd));
  });

  app.get("/api/events/:eventId/attendees", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    const member = await storage.getGroupMember(event.groupId, authUserId);
    if (!member || member.status !== "approved") return res.status(403).json({ message: "You must be an approved group member to view attendees" });
    const attendees = await storage.getEventAttendees(req.params.eventId);
    res.json(attendees);
  });
}
