import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../server/auth.js";

describe("hashPassword", () => {
  it("returns a string in salt:hash format", async () => {
    const hash = await hashPassword("password123");
    expect(typeof hash).toBe("string");
    expect(hash).toContain(":");
    const [salt, hex] = hash.split(":");
    expect(salt).toHaveLength(32);
    expect(hex).toHaveLength(128);
  });

  it("generates a unique salt each time", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });
});

describe("comparePassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct-password");
    await expect(comparePassword("correct-password", hash)).resolves.toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hash = await hashPassword("correct-password");
    await expect(comparePassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("returns false for an empty password against a valid hash", async () => {
    const hash = await hashPassword("some-password");
    await expect(comparePassword("", hash)).resolves.toBe(false);
  });

  it("returns false for a malformed stored hash with no colon", async () => {
    await expect(comparePassword("password", "malformedhashwithoutcolon")).resolves.toBe(false);
  });

  it("returns false for an empty stored hash", async () => {
    await expect(comparePassword("password", "")).resolves.toBe(false);
  });

  it("returns false for a stored hash with only a colon", async () => {
    await expect(comparePassword("password", ":")).resolves.toBe(false);
  });

  it("returns false when salt is present but hash is empty", async () => {
    await expect(comparePassword("password", "validhexsalt32chars0000000000000:")).resolves.toBe(false);
  });

  it("is consistent — same correct password always returns true", async () => {
    const hash = await hashPassword("consistency-test");
    for (let i = 0; i < 3; i++) {
      await expect(comparePassword("consistency-test", hash)).resolves.toBe(true);
    }
  });
});
