import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Request } from "express";
import { storage } from "./storage";

const scryptAsync = promisify(scrypt);

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function compareAdminPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(":");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const hashBuffer = Buffer.from(hash, "hex");
    if (derivedKey.length !== hashBuffer.length) return false;
    return timingSafeEqual(derivedKey, hashBuffer);
  } catch {
    return false;
  }
}

export async function getAdminFromSession(req: Request): Promise<string | null> {
  return (req.session as any)?.adminId || null;
}

export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  const adminId = await getAdminFromSession(req);
  if (!adminId) return false;
  const admin = await storage.getAdminById(adminId);
  return !!admin;
}

export async function seedInitialAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn("[admin] ADMIN_PASSWORD env var not set — skipping initial admin seed. Set it to create the first admin account.");
    return;
  }

  const count = await storage.getAdminCount();
  if (count > 0) {
    return;
  }

  const passwordHash = await hashAdminPassword(password);
  await storage.createAdmin({
    username,
    passwordHash,
    displayName: "Admin",
    createdBy: undefined,
  });
  console.log(`[admin] Initial admin account created: username="${username}"`);
}
