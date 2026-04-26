import { describe, it, expect } from "vitest";
import { signupSchema } from "../../shared/schema.js";

const validPayload = {
  name: "Jane Doe",
  email: "jane@example.com",
  password: "SecurePass1!",
};

describe("signupSchema — valid payloads", () => {
  it("accepts a fully valid signup payload", () => {
    expect(signupSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts an optional dob, gender, tagline", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      dob: "1995-06-15",
      gender: "female",
      tagline: "Adventure awaits",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a password exactly 8 chars (lower bound)", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "12345678" }).success).toBe(true);
  });

  it("accepts a password exactly 128 chars (upper bound)", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "a".repeat(128) }).success).toBe(true);
  });

  it("accepts a tagline exactly 60 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, tagline: "a".repeat(60) }).success).toBe(true);
  });
});

describe("signupSchema — email validation", () => {
  it("rejects a missing email", () => {
    const { email: _e, ...rest } = validPayload;
    expect(signupSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an email without @ symbol", () => {
    expect(signupSchema.safeParse({ ...validPayload, email: "notanemail" }).success).toBe(false);
  });

  it("rejects an email without a domain", () => {
    expect(signupSchema.safeParse({ ...validPayload, email: "user@" }).success).toBe(false);
  });
});

describe("signupSchema — password validation", () => {
  it("rejects a missing password", () => {
    const { password: _p, ...rest } = validPayload;
    expect(signupSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a password shorter than 8 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "short" }).success).toBe(false);
  });

  it("rejects a password of exactly 7 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "1234567" }).success).toBe(false);
  });

  it("rejects a password longer than 128 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "a".repeat(129) }).success).toBe(false);
  });

  it("rejects a password of exactly 129 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, password: "b".repeat(129) }).success).toBe(false);
  });
});

describe("signupSchema — name validation", () => {
  it("rejects a missing name", () => {
    const { name: _n, ...rest } = validPayload;
    expect(signupSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(signupSchema.safeParse({ ...validPayload, name: "" }).success).toBe(false);
  });
});

describe("signupSchema — tagline validation", () => {
  it("rejects a tagline longer than 60 chars", () => {
    expect(signupSchema.safeParse({ ...validPayload, tagline: "a".repeat(61) }).success).toBe(false);
  });

  it("accepts an absent tagline (optional field)", () => {
    expect(signupSchema.safeParse({ ...validPayload }).success).toBe(true);
  });
});
