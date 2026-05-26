import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { seedInitialAdmin } from "./admin-auth";
import path from "path";
import pg from "pg";

/**
 * Idempotent startup migration — runs inside a single transaction.
 *
 * On every boot it:
 *   1. Deletes orphaned records (logging row counts per table)
 *   2. Applies FK constraints with ON DELETE CASCADE (skipped if already present)
 *   3. Creates any missing indexes
 *
 * If anything fails the transaction rolls back and the process exits with code 1
 * so the deployment fails loudly rather than starting in a broken state.
 */
async function runStartupMigrations(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Orphan cleanup ────────────────────────────────────────────────────────
    const orphanSteps: Array<{ label: string; sql: string }> = [
      {
        // NOT EXISTS handles NULL foreign-key values that NOT IN silently skips
        label: "orphaned messages (NULL or missing match_id / sender_id)",
        sql: `DELETE FROM messages
              WHERE match_id  IS NULL
                 OR sender_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM matches WHERE matches.id = messages.match_id)
                 OR NOT EXISTS (SELECT 1 FROM users  WHERE users.id  = messages.sender_id)`,
      },
      {
        label: "orphaned photos (NULL or missing user_id)",
        sql: `DELETE FROM photos
              WHERE user_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = photos.user_id)`,
      },
      {
        label: "orphaned notifications (NULL or missing user_id)",
        sql: `DELETE FROM notifications
              WHERE user_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = notifications.user_id)`,
      },
      {
        label: "orphaned matches (NULL or missing user_a_id / user_b_id)",
        sql: `DELETE FROM matches
              WHERE user_a_id IS NULL
                 OR user_b_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = matches.user_a_id)
                 OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = matches.user_b_id)`,
      },
      {
        label: "orphaned group_members (NULL or missing user_id / group_id)",
        sql: `DELETE FROM group_members
              WHERE user_id  IS NULL
                 OR group_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM users   WHERE users.id   = group_members.user_id)
                 OR NOT EXISTS (SELECT 1 FROM groups  WHERE groups.id  = group_members.group_id)`,
      },
    ];

    for (const { label, sql } of orphanSteps) {
      const res = await client.query(sql);
      const n = res.rowCount ?? 0;
      if (n > 0) console.log(`[migration] Deleted ${n} ${label}`);
    }

    // ── FK constraints (each guarded by IF NOT EXISTS) ────────────────────────
    const fkSteps: Array<{ name: string; table: string; sql: string }> = [
      {
        name: "fk_photos_user",
        table: "photos",
        sql: `ALTER TABLE photos
              ADD CONSTRAINT fk_photos_user
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_matches_user_a",
        table: "matches",
        sql: `ALTER TABLE matches
              ADD CONSTRAINT fk_matches_user_a
              FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_matches_user_b",
        table: "matches",
        sql: `ALTER TABLE matches
              ADD CONSTRAINT fk_matches_user_b
              FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_messages_match",
        table: "messages",
        sql: `ALTER TABLE messages
              ADD CONSTRAINT fk_messages_match
              FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_messages_sender",
        table: "messages",
        sql: `ALTER TABLE messages
              ADD CONSTRAINT fk_messages_sender
              FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE`,
      },
      {
        name: "fk_notifications_user",
        table: "notifications",
        sql: `ALTER TABLE notifications
              ADD CONSTRAINT fk_notifications_user
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      },
    ];

    for (const { name, table, sql } of fkSteps) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.table_constraints
         WHERE constraint_name = $1 AND table_name = $2`,
        [name, table]
      );
      if (exists.rowCount === 0) {
        await client.query(sql);
        console.log(`[migration] FK constraint ${name} applied`);
      }
    }

    // ── Indexes ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_boost_expires ON users(boost_expires_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset   ON rate_limits(reset_at);
    `);

    await client.query("COMMIT");
    console.log("[migration] Startup migrations applied successfully");
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[migration] FATAL: Startup migration failed — rolling back:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is not set. Exiting.");
  process.exit(1);
}

if (!process.env.STRIPE_PAYMENT_WEBHOOK_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: STRIPE_PAYMENT_WEBHOOK_SECRET is not set in production. Exiting.");
  process.exit(1);
}

if (!process.env.STRIPE_IDENTITY_WEBHOOK_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: STRIPE_IDENTITY_WEBHOOK_SECRET is not set in production. Exiting.");
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (process.env.NODE_ENV === "production") {
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
  }
  next();
});

// Health check registered immediately so it responds before any async setup
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_TOKEN_RE = /^[A-Za-z0-9_\-.]{25,}$/;

function sanitizeLogPath(rawPath: string): string {
  return rawPath
    .split("/")
    .map((segment) => {
      if (UUID_RE.test(segment)) return "[id]";
      if (OPAQUE_TOKEN_RE.test(segment)) return "[redacted]";
      return segment;
    })
    .join("/");
}

app.use((req, res, next) => {
  const start = Date.now();
  const rawPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (rawPath.startsWith("/api")) {
      const safePath = sanitizeLogPath(rawPath);
      const logLine = `${req.method} ${safePath} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

// Serve index.html at / immediately so deployment health checks pass
// before the async setup (routes, DB seed) finishes.
// Full static serving with catch-all is added inside the async block.
if (process.env.NODE_ENV === "production") {
  const indexPath = path.resolve(__dirname, "public", "index.html");
  app.get("/", (_req, res) => res.sendFile(indexPath));
}

// Bind the port immediately so health checks pass while setup continues
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  log(`serving on port ${port}`);
});

(async () => {
  try {
    await runStartupMigrations();

    await registerRoutes(httpServer, app);

    await seedDatabase().catch((err) => {
      console.error("Seed error (non-fatal):", err.message);
    });

    await seedInitialAdmin().catch((err) => {
      console.error("Admin seed error (non-fatal):", err.message);
    });

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // Vite dev middleware or static file serving added after routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  } catch (err) {
    console.error("Startup error (server remains live):", err);
  }
})();
