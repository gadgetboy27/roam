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
export const pool = new pg.Pool(pgConnectConfig(process.env.DATABASE_URL));

export const db = drizzle(pool, { schema });
