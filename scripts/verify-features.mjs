import pg from "pg";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n").filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const q = async (label, sql, params) => {
  try { const r = await pool.query(sql, params); console.log(`\n=== ${label} ===`); console.table(r.rows); return r.rows; }
  catch (e) { console.log(`\n=== ${label} ERROR: ${e.message}`); return []; }
};

// --- Photos: is there any per-user cap? ---
await q("photos per user (any cap?)", `SELECT user_id, count(*) AS photo_count FROM photos GROUP BY user_id ORDER BY photo_count DESC LIMIT 10`);
await q("photos total", `SELECT count(*) AS total FROM photos`);

// --- Destinations / bucket list ---
await q("bucket_list per user", `SELECT user_id, count(*) AS pinned FROM bucket_list GROUP BY user_id ORDER BY pinned DESC LIMIT 10`);
await q("distinct destinations pinned", `SELECT destination_name, count(*) FROM bucket_list GROUP BY destination_name ORDER BY count DESC LIMIT 12`);

// --- Supabase storage bucket for photo uploads ---
try {
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: buckets, error } = await admin.storage.listBuckets();
  console.log(`\n=== storage buckets ===`);
  if (error) console.log("ERROR:", error.message);
  else console.table(buckets.map(b => ({ name: b.name, public: b.public })));
} catch (e) { console.log("storage check error:", e.message); }

// --- End-to-end message + notification test on a REAL match, rolled back ---
const c = await pool.connect();
try {
  await c.query("BEGIN");
  const m = (await c.query(`SELECT id, user_a_id, user_b_id FROM matches WHERE user_a_id <> user_b_id LIMIT 1`)).rows[0];
  if (m) {
    await c.query(`INSERT INTO messages (match_id, sender_id, content) VALUES ($1,$2,$3)`, [m.id, m.user_a_id, "hello from verification"]);
    // The exact read the app uses to render the chat:
    const msgs = await c.query(`SELECT sender_id, content, read FROM messages WHERE match_id=$1 ORDER BY created_at`, [m.id]);
    const notif = await c.query(`SELECT user_id, title, body FROM notifications WHERE type='message' ORDER BY id DESC LIMIT 1`);
    console.log(`\n=== E2E MESSAGE TEST (rolled back — touches no real account) ===`);
    console.log("message persisted & readable:", msgs.rows);
    console.log("notification created for recipient:", notif.rows[0]);
    console.log("recipient is the OTHER user:", notif.rows[0]?.user_id === m.user_b_id);
  }
  await c.query("ROLLBACK");
  console.log("Rolled back — nothing saved.");
} finally { c.release(); }

await pool.end();
