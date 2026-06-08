import pg from "pg";
import { readFileSync, mkdirSync, writeFileSync } from "fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = env.split("\n").find(l => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = new URL(`../backups/${stamp}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

const tables = (await pool.query(`
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
`)).rows.map(r => r.tablename);

const manifest = { created_at: new Date().toISOString(), database: url.replace(/:\/\/[^@]+@/, "://***@"), tables: {} };
let grand = 0;

for (const t of tables) {
  const rows = (await pool.query(`SELECT * FROM "${t}"`)).rows;
  writeFileSync(new URL(`${t}.json`, dir), JSON.stringify(rows, null, 2));
  manifest.tables[t] = rows.length;
  grand += rows.length;
  console.log(`  ${t.padEnd(28)} ${rows.length} rows`);
}

writeFileSync(new URL("_manifest.json", dir), JSON.stringify(manifest, null, 2));
console.log(`\nBacked up ${tables.length} tables, ${grand} total rows`);
console.log(`Location: backups/${stamp}/  (gitignored — stays local only)`);
await pool.end();
