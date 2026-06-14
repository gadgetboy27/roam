// One-off: generate the roam "r." icon set + social share image.
// Brand: forest #0e1a0d bg, cream #f2ede3 "r", electric #c8e64a "." — Playfair Display Black.
// Run: node scripts/gen-icons.mjs [preview]
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = join(__dirname, "..", "client", "public");

const FOREST = "#0e1a0d";
const CREAM = "#f2ede3";
const ELECTRIC = "#c8e64a";
const FONT = "/tmp/Playfair900.ttf";

// Square app/favicon icon at pixel size S, full-bleed forest bg + centered "r."
function iconSvg(S) {
  const fs = Math.round(S * 0.66);      // glyph size
  const baseY = Math.round(S * 0.70);   // baseline (tuned for optical centering)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${FOREST}"/>
  <text x="${S * 0.5}" y="${baseY}" text-anchor="middle" font-family="Playfair Display" font-weight="900" font-size="${fs}" letter-spacing="${-S * 0.01}">
    <tspan fill="${CREAM}">r</tspan><tspan fill="${ELECTRIC}">.</tspan>
  </text>
</svg>`;
}

function render(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: "Playfair Display" },
    background: FOREST,
  });
  return r.render().asPng();
}

const preview = process.argv[2] === "preview";

if (preview) {
  writeFileSync("/tmp/icon-preview.png", render(iconSvg(512), 512));
  console.log("wrote /tmp/icon-preview.png");
  process.exit(0);
}

// Full icon set — matches existing filenames in client/public so nothing breaks.
const sizes = {
  "favicon.png": 64,
  "apple-touch-icon.png": 180,
  "icon-48x48.png": 48,
  "icon-72x72.png": 72,
  "icon-96x96.png": 96,
  "icon-144x144.png": 144,
  "icon-152x152.png": 152,
  "icon-180x180.png": 180,
  "icon-192x192.png": 192,
  "icon-384x384.png": 384,
  "icon-512x512.png": 512,
};
for (const [name, S] of Object.entries(sizes)) {
  writeFileSync(join(PUB, name), render(iconSvg(S), S));
  console.log("wrote", name, `(${S}px)`);
}

// favicon-32 / favicon-16 for crisp browser tabs
writeFileSync(join(PUB, "favicon-32x32.png"), render(iconSvg(32), 32));
writeFileSync(join(PUB, "favicon-16x16.png"), render(iconSvg(16), 16));
console.log("wrote favicon-32x32.png, favicon-16x16.png");

// ── Social share image (Open Graph / Twitter / FB ad link preview) ──────────
// All text (Playfair) so it stays crisp and fully on-brand — no logo box artefacts.
const OGW = 1200, OGH = 630;
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OGW}" height="${OGH}" viewBox="0 0 ${OGW} ${OGH}">
  <rect width="${OGW}" height="${OGH}" fill="${FOREST}"/>
  <text x="${OGW / 2}" y="300" text-anchor="middle" font-family="Playfair Display" font-weight="900" font-size="170" letter-spacing="-4">
    <tspan fill="${CREAM}">roam</tspan><tspan fill="${ELECTRIC}">.</tspan>
  </text>
  <text x="${OGW / 2}" y="410" text-anchor="middle" font-family="Playfair Display" font-weight="600" font-size="48" fill="${CREAM}">Find people who move like you.</text>
  <text x="${OGW / 2}" y="478" text-anchor="middle" font-family="Playfair Display" font-weight="500" font-size="29" letter-spacing="1" fill="${ELECTRIC}">Adventure matching · Aotearoa New Zealand</text>
  <text x="${OGW / 2}" y="560" text-anchor="middle" font-family="Playfair Display" font-weight="500" font-size="30" fill="rgba(242,237,227,0.55)">letsroam.life</text>
  <rect width="${OGW}" height="8" y="${OGH - 8}" fill="${ELECTRIC}"/>
</svg>`;
writeFileSync(join(PUB, "og-image.png"), render(ogSvg, OGW));
console.log("wrote og-image.png (1200x630)");
