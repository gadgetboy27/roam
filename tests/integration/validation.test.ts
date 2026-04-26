/**
 * Tests for server-side input validation rules added in the security audit.
 * Each test creates a minimal Express app that replicates the exact validation
 * logic from the real route handler — letting us verify boundary conditions
 * without requiring a live database connection.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import supertest from "supertest";

// ---------------------------------------------------------------------------
// Reusable helper — simulate an authenticated PATCH /api/users/:id handler
// with only the validation logic (no DB write).
// ---------------------------------------------------------------------------
function buildUserPatchApp(authenticatedAs: string | null = "user-123") {
  const app = express();
  app.use(express.json());

  app.patch("/api/users/:id", async (req, res) => {
    // Simulate authenticateRequest result
    const sessionUserId = authenticatedAs;
    if (!sessionUserId || sessionUserId !== req.params.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { name, tagline } = req.body;

    if (tagline !== undefined && typeof tagline === "string" && tagline.length > 60) {
      return res.status(400).json({ message: "Tagline must be 60 characters or less" });
    }
    if (name !== undefined && typeof name === "string" && name.length > 100) {
      return res.status(400).json({ message: "Name must be 100 characters or less" });
    }

    return res.json({ ok: true });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Reusable helper — simulate an authenticated POST /api/upload handler
// with only the caption validation logic.
// ---------------------------------------------------------------------------
function buildUploadApp() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.post("/api/upload", async (req, res) => {
    const { dataUrl, filename, userId, caption } = req.body;

    if (!dataUrl || !filename || !userId) {
      return res.status(400).json({ message: "dataUrl, filename, userId required" });
    }
    if (caption !== undefined && typeof caption === "string" && caption.length > 200) {
      return res.status(400).json({ message: "Caption must be 200 characters or less" });
    }

    return res.json({ ok: true });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tagline validation (PATCH /api/users/:id)
// ---------------------------------------------------------------------------
describe("PATCH /api/users/:id — tagline validation", () => {
  const userId = "user-123";
  const req = supertest(buildUserPatchApp(userId));

  it("accepts a tagline of exactly 60 chars", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ tagline: "a".repeat(60) });
    expect(res.status).toBe(200);
  });

  it("accepts a tagline of 1 char", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ tagline: "x" });
    expect(res.status).toBe(200);
  });

  it("rejects a tagline of 61 chars", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ tagline: "a".repeat(61) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/60/);
  });

  it("rejects a tagline of 200 chars", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ tagline: "a".repeat(200) });
    expect(res.status).toBe(400);
  });

  it("allows an absent tagline (field not sent)", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ location: "Auckland" });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Name validation (PATCH /api/users/:id)
// ---------------------------------------------------------------------------
describe("PATCH /api/users/:id — name validation", () => {
  const userId = "user-123";
  const req = supertest(buildUserPatchApp(userId));

  it("accepts a name of exactly 100 chars", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ name: "a".repeat(100) });
    expect(res.status).toBe(200);
  });

  it("rejects a name of 101 chars", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ name: "a".repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/100/);
  });

  it("allows an absent name (field not sent)", async () => {
    const res = await req.patch(`/api/users/${userId}`).send({ tagline: "Hiker" });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Auth guard (PATCH /api/users/:id)
// ---------------------------------------------------------------------------
describe("PATCH /api/users/:id — auth guard", () => {
  it("returns 401 when unauthenticated (no session)", async () => {
    const req = supertest(buildUserPatchApp(null));
    const res = await req.patch("/api/users/user-123").send({ tagline: "Hi" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when authenticated as a different user", async () => {
    const req = supertest(buildUserPatchApp("other-user-id"));
    const res = await req.patch("/api/users/user-123").send({ tagline: "Hi" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Caption validation (POST /api/upload)
// ---------------------------------------------------------------------------
describe("POST /api/upload — caption validation", () => {
  const req = supertest(buildUploadApp());
  const base = { dataUrl: "data:image/jpeg;base64,abc", filename: "photo.jpg", userId: "u1" };

  it("accepts a caption of exactly 200 chars", async () => {
    const res = await req.post("/api/upload").send({ ...base, caption: "a".repeat(200) });
    expect(res.status).toBe(200);
  });

  it("accepts a caption of 1 char", async () => {
    const res = await req.post("/api/upload").send({ ...base, caption: "x" });
    expect(res.status).toBe(200);
  });

  it("rejects a caption of 201 chars", async () => {
    const res = await req.post("/api/upload").send({ ...base, caption: "a".repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/200/);
  });

  it("allows an absent caption", async () => {
    const res = await req.post("/api/upload").send(base);
    expect(res.status).toBe(200);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await req.post("/api/upload").send({ userId: "u1" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });
});

// ---------------------------------------------------------------------------
// Message length validation — replicated from Socket.IO send_message handler
// ---------------------------------------------------------------------------
describe("Message content length — boundary validation", () => {
  function buildMessageApp() {
    const app = express();
    app.use(express.json());

    app.post("/api/test/message", (req, res) => {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "content required" });
      }
      if (content.length > 2000) {
        return res.status(400).json({ message: "Message too long" });
      }
      return res.json({ ok: true });
    });
    return app;
  }

  const req = supertest(buildMessageApp());

  it("accepts a message of exactly 2000 chars", async () => {
    const res = await req.post("/api/test/message").send({ content: "a".repeat(2000) });
    expect(res.status).toBe(200);
  });

  it("rejects a message of 2001 chars", async () => {
    const res = await req.post("/api/test/message").send({ content: "a".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("rejects an empty content field", async () => {
    const res = await req.post("/api/test/message").send({ content: "" });
    expect(res.status).toBe(400);
  });
});
