import { describe, it, expect, beforeAll } from "vitest";
import express, { type Application } from "express";
import supertest, { type SuperTest, type Test } from "supertest";

function buildApp(): Application {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });

  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

function buildProdApp(): Application {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' wss: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join("; ")
    );
    next();
  });

  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("Security headers — baseline (all environments)", () => {
  let request: SuperTest<Test>;

  beforeAll(() => {
    request = supertest(buildApp());
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request.get("/ping");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options: SAMEORIGIN", async () => {
    const res = await request.get("/ping");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets X-XSS-Protection: 1; mode=block", async () => {
    const res = await request.get("/ping");
    expect(res.headers["x-xss-protection"]).toBe("1; mode=block");
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const res = await request.get("/ping");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy restricting geo/mic/camera", async () => {
    const res = await request.get("/ping");
    expect(res.headers["permissions-policy"]).toBe("geolocation=(), microphone=(), camera=()");
  });
});

describe("Security headers — production extras", () => {
  let request: SuperTest<Test>;

  beforeAll(() => {
    request = supertest(buildProdApp());
  });

  it("sets Strict-Transport-Security with 1-year max-age", async () => {
    const res = await request.get("/ping");
    expect(res.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  });

  it("sets Content-Security-Policy with frame-ancestors none", async () => {
    const res = await request.get("/ping");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("CSP restricts font-src to self and Google Fonts CDN only", async () => {
    const res = await request.get("/ping");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
  });
});
