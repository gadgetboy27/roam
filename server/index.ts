import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { seedInitialAdmin } from "./admin-auth";
import path from "path";
import pg from "pg";

/**
 * Idempotent startup migration.
 * Runs on every boot — safe to re-run because every step is guarded by
 * IF NOT EXISTS / existence checks. Handles:
 *   1. Orphaned record cleanup (required before FK constraints can be added)
 *   2. FK constraints with ON DELETE CASCADE
 *   3. The missing idx_users_boost_expires index
 */
async function runStartupMigrations(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      -- ── Orphan cleanup (idempotent — deletes only what's already broken) ──────
      DELETE FROM messages
        WHERE match_id  NOT IN (SELECT id FROM matches)
           OR sender_id NOT IN (SELECT id FROM users);

      DELETE FROM photos
        WHERE user_id NOT IN (SELECT id FROM users);

      DELETE FROM notifications
        WHERE user_id NOT IN (SELECT id FROM users);

      DELETE FROM matches
        WHERE user_a_id NOT IN (SELECT id FROM users)
           OR user_b_id NOT IN (SELECT id FROM users);

      DELETE FROM group_members
        WHERE user_id  NOT IN (SELECT id FROM users)
           OR group_id NOT IN (SELECT id FROM groups);

      -- ── FK constraints (each wrapped in an existence check) ──────────────────
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_photos_user' AND table_name = 'photos'
        ) THEN
          ALTER TABLE photos
            ADD CONSTRAINT fk_photos_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_matches_user_a' AND table_name = 'matches'
        ) THEN
          ALTER TABLE matches
            ADD CONSTRAINT fk_matches_user_a
            FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_matches_user_b' AND table_name = 'matches'
        ) THEN
          ALTER TABLE matches
            ADD CONSTRAINT fk_matches_user_b
            FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_messages_match' AND table_name = 'messages'
        ) THEN
          ALTER TABLE messages
            ADD CONSTRAINT fk_messages_match
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_messages_sender' AND table_name = 'messages'
        ) THEN
          ALTER TABLE messages
            ADD CONSTRAINT fk_messages_sender
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_notifications_user' AND table_name = 'notifications'
        ) THEN
          ALTER TABLE notifications
            ADD CONSTRAINT fk_notifications_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;

      -- ── Indexes (CREATE IF NOT EXISTS is always safe) ─────────────────────────
      CREATE INDEX IF NOT EXISTS idx_users_boost_expires  ON users(boost_expires_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset    ON rate_limits(reset_at);
    `);
    console.log("[migration] Startup migrations applied successfully");
  } catch (err: any) {
    console.error("[migration] Startup migration error (non-fatal):", err.message);
  } finally {
    await pool.end();
  }
}

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is not set. Exiting.");
  process.exit(1);
}

if (!process.env.STRIPE_PAYMENT_WEBHOOK_SECRET && (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1")) {
  console.error("FATAL: STRIPE_PAYMENT_WEBHOOK_SECRET is not set in production. Exiting.");
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
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

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
