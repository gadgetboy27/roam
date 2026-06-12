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
const WARM_CONNECTIONS = 4;        // how many pooled connections to keep hot
export const pool = new pg.Pool({
  ...pgConnectConfig(process.env.DATABASE_URL),
  max: 10,
  idleTimeoutMillis: 120_000,       // don't reap warm connections between pings
  connectionTimeoutMillis: 15_000,  // error after 15s instead of hanging forever
  keepAlive: true,                  // TCP keepalive so NAT/pooler doesn't drop us
  keepAliveInitialDelayMillis: 10_000,
});

// Keep several connections hot. The earlier version pinged every 4 min but the
// pool reaped idle connections first, so each request still paid a cold reconnect
// (the ~0.5s/query tax that made /api/groups' 2nd/3rd serial query slow). Ping a
// handful in parallel, more often than the idle timeout, so the pool always has
// warm connections ready — this is what actually moves the needle, app-wide.
function warmPool() {
  const pings = Array.from({ length: WARM_CONNECTIONS }, () => pool.query("SELECT 1").catch(() => {}));
  return Promise.all(pings);
}
warmPool(); // warm immediately on boot
setInterval(warmPool, 45_000).unref?.();  // re-warm every 45s (< idleTimeout)

export const db = drizzle(pool, { schema });
