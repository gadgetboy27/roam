import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import pg from "pg";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

/**
 * Cleans orphaned rows from the production database before the build
 * so any subsequent schema migration step finds no FK violations.
 * Uses NOT EXISTS (not NOT IN) so NULL foreign-key values are caught too.
 * Non-fatal: a failure here logs a warning but does not abort the build.
 */
async function cleanProductionOrphans() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[build] No DATABASE_URL — skipping pre-build orphan cleanup");
    return;
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    const steps: Array<{ label: string; sql: string }> = [
      {
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
                 OR NOT EXISTS (SELECT 1 FROM users  WHERE users.id  = group_members.user_id)
                 OR NOT EXISTS (SELECT 1 FROM groups WHERE groups.id = group_members.group_id)`,
      },
    ];

    for (const { label, sql } of steps) {
      const res = await pool.query(sql);
      const n = res.rowCount ?? 0;
      if (n > 0) console.log(`[build] Deleted ${n} ${label}`);
    }
    console.log("[build] Pre-build orphan cleanup complete");
  } catch (err: any) {
    console.warn("[build] Pre-build cleanup warning (non-fatal):", err.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

cleanProductionOrphans()
  .then(() => buildAll())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
