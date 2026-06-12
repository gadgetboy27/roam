import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

// Strip sslmode from the URL so pg-connection-string doesn't override
// the ssl option with verify-full semantics (Supabase uses a self-signed
// cert in their chain which fails certificate chain validation).
export function pgConnectConfig(url: string | undefined): { connectionString: string; ssl: { rejectUnauthorized: false } } {
  if (!url) throw new Error("DATABASE_URL is not set");
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } };
  } catch {
    return { connectionString: url, ssl: { rejectUnauthorized: false } };
  }
}

// Single shared connection pool. Reused for Drizzle ORM and for the handful of
// routes that run raw SQL — never call pool.end() on it at request scope.
//
// Tuned for a remote (cross-region) Supabase pooler: the pg defaults reap idle
// connections after 10s and wait forever for one, so low-traffic requests kept
// paying a full TCP+TLS reconnect (~0.5s/query) and a stuck request could hang
// for minutes (the 186s spike). Keep connections warm and fail fast instead.
export const pool = new pg.Pool({
  ...pgConnectConfig(process.env.DATABASE_URL),
  max: 10,
  idleTimeoutMillis: 60_000,        // keep idle connections ~1 min (was 10s)
  connectionTimeoutMillis: 15_000,  // error after 15s instead of hanging forever
  keepAlive: true,                  // TCP keepalive so NAT/pooler doesn't drop us
  keepAliveInitialDelayMillis: 10_000,
});

// Keep at least one connection warm against the pooler's server-side idle close,
// so the first request after a quiet period isn't a cold reconnect.
setInterval(() => { pool.query("SELECT 1").catch(() => {}); }, 4 * 60 * 1000).unref?.();

export const db = drizzle(pool, { schema });
