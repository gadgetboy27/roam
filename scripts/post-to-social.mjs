// Post roam content to social via Ayrshare (Facebook / Instagram / LinkedIn).
//
// Reads AYRSHARE_API_KEY from the environment or .env.
// DRY-RUN BY DEFAULT — it only prints what it would post. Add --send to post for real.
//
// Examples:
//   node scripts/post-to-social.mjs --caption "Find people who move like you. Join free at letsroam.life" --to facebook,linkedin
//   node scripts/post-to-social.mjs --caption "..." --to instagram --image-url https://letsroam.life/og-image.png
//   node scripts/post-to-social.mjs --caption "..." --to facebook,instagram,linkedin --send
//
// Notes (Basic plan):
//   • Ayrshare media HOSTING needs Premium — so images must be a PUBLIC URL (--image-url).
//     Default image is https://letsroam.life/og-image.png (already public).
//   • Instagram REQUIRES an image; Facebook/LinkedIn can post text + link only
//     (the letsroam.life link auto-renders the OG share card).
//   • Basic plan = 20 posts/month; one /post call to N platforms counts as N posts.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getKey() {
  if (process.env.AYRSHARE_API_KEY) return process.env.AYRSHARE_API_KEY;
  try {
    const env = readFileSync(join(__dirname, "..", ".env"), "utf8");
    const m = env.match(/^AYRSHARE_API_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return null;
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const has = (name) => process.argv.includes(`--${name}`);

const KEY = getKey();
if (!KEY) { console.error("✗ AYRSHARE_API_KEY not found in env or .env"); process.exit(1); }

const caption = arg("caption");
const platforms = (arg("to", "facebook,linkedin")).split(",").map((s) => s.trim()).filter(Boolean);
const imageUrl = arg("image-url", "https://letsroam.life/og-image.png");
const send = has("send");

if (!caption) { console.error('✗ --caption "your text" is required'); process.exit(1); }

const needsImage = platforms.includes("instagram");
const body = { post: caption, platforms };
if (needsImage || has("image-url")) body.mediaUrls = [imageUrl];

console.log("──────────────────────────────────────────");
console.log(send ? "📤 SENDING POST" : "🔍 DRY RUN (add --send to post for real)");
console.log("platforms :", platforms.join(", "));
console.log("caption   :", caption);
if (body.mediaUrls) console.log("image     :", imageUrl);
console.log("──────────────────────────────────────────");

if (!send) {
  if (needsImage && !body.mediaUrls) console.log("⚠ Instagram requires an image — pass --image-url <public url>");
  console.log("No post sent. Re-run with --send to publish.");
  process.exit(0);
}

const res = await fetch("https://api.ayrshare.com/api/post", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
process.exit(json.status === "success" ? 0 : 1);
