/**
 * Tests for the safety endpoints' auth guards and input validation, mirroring
 * the style of tests/integration/validation.test.ts: each test builds a minimal
 * Express app that replicates the exact guard/validation logic from
 * server/routes/safety.routes.ts — so we verify the rules (unauthenticated
 * rejection, self-action guards, required fields, future-date checks) without a
 * live database.
 *
 * The handlers below are faithful copies of the real ones, with the DB layer
 * (`pool.query`) stubbed so only the guard/validation branches are exercised.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import supertest from "supertest";

// Stub pool: every query resolves empty so handlers reach their response branch.
const okPool = { query: async () => ({ rows: [] as any[] }) };

// Build a safety app whose authenticateRequest returns `authedAs` (null = no session).
function buildSafetyApp(
  authedAs: string | null = "user-123",
  pool: { query: (...a: any[]) => Promise<{ rows: any[] }> } = okPool
) {
  const app = express();
  app.use(express.json());
  const authenticateRequest = async () => authedAs;

  // ── PATCH /api/users/:id/safety-mode (must be self) ──────────────────────
  app.patch("/api/users/:id/safety-mode", async (req, res) => {
    const sessionUserId = await authenticateRequest();
    if (!sessionUserId || sessionUserId !== req.params.id)
      return res.status(401).json({ error: "Unauthorised" });
    return res.json({ safetyModeEnabled: !!req.body.safetyModeEnabled });
  });

  // ── POST /api/users/:id/block ────────────────────────────────────────────
  app.post("/api/users/:id/block", async (req, res) => {
    const sessionUserId = await authenticateRequest();
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    if (sessionUserId === req.params.id)
      return res.status(400).json({ error: "Cannot block yourself" });
    await pool.query();
    return res.json({ blocked: true });
  });

  // ── POST /api/users/:id/report ───────────────────────────────────────────
  app.post("/api/users/:id/report", async (req, res) => {
    const sessionUserId = await authenticateRequest();
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    if (sessionUserId === req.params.id)
      return res.status(400).json({ error: "Cannot report yourself" });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });
    await pool.query();
    return res.json({ reported: true });
  });

  // ── POST /api/safety/contacts/:contactId ─────────────────────────────────
  app.post("/api/safety/contacts/:contactId", async (req, res) => {
    const userId = await authenticateRequest();
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { contactId } = req.params;
    if (contactId === userId)
      return res.status(400).json({ error: "Cannot add yourself" });
    const { rows: u } = await pool.query("SELECT id FROM users WHERE id = $1", [contactId]);
    if (!u.length) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true });
  });

  // ── POST /api/safety/checkin (scheduledAt required + must be future) ──────
  app.post("/api/safety/checkin", async (req, res) => {
    const userId = await authenticateRequest();
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required" });
    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }
    return res.json({ id: "checkin-1", scheduledAt: scheduled.toISOString() });
  });

  // ── POST /api/safety/alert (SOS) ─────────────────────────────────────────
  app.post("/api/safety/alert", async (req, res) => {
    const userId = await authenticateRequest();
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    return res.json({ ok: true, contactsAlerted: 0 });
  });

  return app;
}

// ── Auth guards: unauthenticated requests are rejected everywhere ──────────
describe("Safety routes — unauthenticated requests are rejected", () => {
  const req = supertest(buildSafetyApp(null));

  const cases: Array<[string, string]> = [
    ["patch", "/api/users/u2/safety-mode"],
    ["post", "/api/users/u2/block"],
    ["post", "/api/users/u2/report"],
    ["post", "/api/safety/contacts/u2"],
    ["post", "/api/safety/checkin"],
    ["post", "/api/safety/alert"],
  ];

  for (const [method, path] of cases) {
    it(`returns 401 for ${method.toUpperCase()} ${path}`, async () => {
      const res = await (req as any)[method](path).send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorised");
    });
  }
});

// ── safety-mode is self-only ───────────────────────────────────────────────
describe("PATCH /api/users/:id/safety-mode — self-only guard", () => {
  it("returns 401 when toggling another user's safety mode", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .patch("/api/users/other/safety-mode")
      .send({ safetyModeEnabled: true });
    expect(res.status).toBe(401);
  });

  it("returns 200 and echoes the flag for the authenticated self", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .patch("/api/users/user-123/safety-mode")
      .send({ safetyModeEnabled: true });
    expect(res.status).toBe(200);
    expect(res.body.safetyModeEnabled).toBe(true);
  });

  it("coerces a truthy non-boolean to a boolean flag", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .patch("/api/users/user-123/safety-mode")
      .send({ safetyModeEnabled: "yes" });
    expect(res.status).toBe(200);
    expect(res.body.safetyModeEnabled).toBe(true);
  });
});

// ── Block: cannot block yourself ───────────────────────────────────────────
describe("POST /api/users/:id/block — self-block guard", () => {
  it("returns 400 when blocking yourself", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/user-123/block")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/);
  });

  it("returns 200 when blocking another user", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/other/block")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.blocked).toBe(true);
  });
});

// ── Report: self-guard + reason required ───────────────────────────────────
describe("POST /api/users/:id/report — validation", () => {
  it("returns 400 when reporting yourself", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/user-123/report")
      .send({ reason: "spam" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/);
  });

  it("returns 400 when reason is missing", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/other/report")
      .send({ detail: "no reason given" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/[Rr]eason/);
  });

  it("returns 400 when reason is an empty string", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/other/report")
      .send({ reason: "" });
    expect(res.status).toBe(400);
  });

  it("returns 200 with a valid reason", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/users/other/report")
      .send({ reason: "harassment" });
    expect(res.status).toBe(200);
    expect(res.body.reported).toBe(true);
  });
});

// ── Add safety contact: self-guard + must exist ────────────────────────────
describe("POST /api/safety/contacts/:contactId — validation", () => {
  it("returns 400 when adding yourself as a safety contact", async () => {
    const res = await supertest(buildSafetyApp("user-123"))
      .post("/api/safety/contacts/user-123")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/);
  });

  it("returns 404 when the target user does not exist", async () => {
    const emptyUsers = { query: async () => ({ rows: [] }) };
    const res = await supertest(buildSafetyApp("user-123", emptyUsers))
      .post("/api/safety/contacts/ghost")
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  it("returns 200 when adding an existing other user", async () => {
    const existingUser = { query: async () => ({ rows: [{ id: "friend" }] }) };
    const res = await supertest(buildSafetyApp("user-123", existingUser))
      .post("/api/safety/contacts/friend")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Check-in scheduling: required + must be in the future ──────────────────
describe("POST /api/safety/checkin — scheduledAt validation", () => {
  const req = supertest(buildSafetyApp("user-123"));

  it("returns 400 when scheduledAt is missing", async () => {
    const res = await req.post("/api/safety/checkin").send({ place: "Cafe" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scheduledAt required/);
  });

  it("returns 400 when scheduledAt is not a valid date", async () => {
    const res = await req.post("/api/safety/checkin").send({ scheduledAt: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it("returns 400 when scheduledAt is in the past", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await req.post("/api/safety/checkin").send({ scheduledAt: past });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it("returns 200 when scheduledAt is in the future", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await req.post("/api/safety/checkin").send({ scheduledAt: future });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
  });
});
