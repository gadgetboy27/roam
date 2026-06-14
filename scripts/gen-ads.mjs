// Generate FB/Instagram ad creatives in the roam brand template.
// Forest #0e1a0d bg, cream #f2ede3 text, electric #c8e64a accent, Playfair Display.
// Run: node scripts/gen-ads.mjs
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "marketing", "ad-creatives");
mkdirSync(OUT, { recursive: true });

const FOREST = "#0e1a0d";
const CREAM = "#f2ede3";
const ELECTRIC = "#c8e64a";
const MUTED = "rgba(242,237,227,0.6)";
const FONT = "/tmp/Playfair900.ttf";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rough advance width for Playfair (per 1em) — good enough to size the CTA pill.
function textWidth(text, size) {
  return text.length * size * 0.5;
}

function bg(W, H) {
  return `
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#16301a"/>
      <stop offset="100%" stop-color="${FOREST}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="28" fill="none" stroke="rgba(242,237,227,0.12)" stroke-width="2"/>
  <rect width="${W}" height="14" y="${H - 14}" fill="${ELECTRIC}"/>`;
}

function wordmark(cx, y, size) {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Playfair Display" font-weight="900" font-size="${size}" letter-spacing="${-size * 0.02}"><tspan fill="${CREAM}">roam</tspan><tspan fill="${ELECTRIC}">.</tspan></text>`;
}

// Multi-line centered headline.
function headline(cx, y, lines, size, lh) {
  const tspans = lines
    .map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`)
    .join("");
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Playfair Display" font-weight="900" font-size="${size}" fill="${CREAM}" letter-spacing="${-size * 0.015}">${tspans}</text>`;
}

function sub(cx, y, text, size, color = MUTED) {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Playfair Display" font-weight="500" font-size="${size}" fill="${color}">${esc(text)}</text>`;
}

// Electric pill CTA with forest text, centered on cx.
function cta(cx, y, text, size) {
  const tw = textWidth(text, size);
  const padX = size * 1.4, padY = size * 0.62;
  const w = tw + padX * 2, h = size + padY * 2;
  return `
  <rect x="${cx - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${ELECTRIC}"/>
  <text x="${cx}" y="${y + size * 0.34}" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="${size}" fill="${FOREST}">${esc(text)}</text>`;
}

function url(cx, y, size) {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Playfair Display" font-weight="600" font-size="${size}" letter-spacing="2" fill="${ELECTRIC}">letsroam.life</text>`;
}

function svg(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg(W, H)}${body}</svg>`;
}

function render(svgStr, width) {
  return new Resvg(svgStr, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: "Playfair Display" },
    background: FOREST,
  }).render().asPng();
}

// ── Creatives ───────────────────────────────────────────────────────────────
const creatives = [];

// 1. Square hero (1080×1080)
{
  const W = 1080, H = 1080, cx = W / 2;
  const body =
    wordmark(cx, 230, 92) +
    headline(cx, 470, ["Find people who", "move like you."], 96, 116) +
    sub(cx, 720, "Adventure matching for hikers, surfers,", 40) +
    sub(cx, 772, "climbers & every kind of explorer.", 40) +
    cta(cx, 920, "Join free", 46);
  creatives.push(["ad-square-hero-1080x1080.png", svg(W, H, body), W]);
}

// 2. Portrait hero (1080×1350)
{
  const W = 1080, H = 1350, cx = W / 2;
  const body =
    wordmark(cx, 280, 96) +
    headline(cx, 560, ["Find people", "who move", "like you."], 112, 138) +
    sub(cx, 970, "Hikers · surfers · climbers · runners", 42) +
    sub(cx, 1028, "Aotearoa New Zealand", 42) +
    cta(cx, 1190, "Join free · letsroam.life", 44);
  creatives.push(["ad-portrait-hero-1080x1350.png", svg(W, H, body), W]);
}

// 3. Square founding-member scarcity (1080×1080)
{
  const W = 1080, H = 1080, cx = W / 2;
  const body =
    wordmark(cx, 210, 80) +
    sub(cx, 350, "Only 50 founding spots", 52, ELECTRIC) +
    headline(cx, 540, ["Free Adventurer", "— for life."], 104, 124) +
    sub(cx, 790, "Join the first crew of roamers in NZ.", 40) +
    cta(cx, 930, "Claim your spot", 46);
  creatives.push(["ad-square-founding-1080x1080.png", svg(W, H, body), W]);
}

// 4. Portrait activity angle (1080×1350)
{
  const W = 1080, H = 1350, cx = W / 2;
  const body =
    wordmark(cx, 270, 92) +
    headline(cx, 540, ["Your crew is", "already", "out there."], 116, 142) +
    sub(cx, 985, "Meet adventurers near you,", 44) +
    sub(cx, 1043, "plan trips, find your people.", 44) +
    cta(cx, 1200, "Start free · letsroam.life", 42);
  creatives.push(["ad-portrait-activity-1080x1350.png", svg(W, H, body), W]);
}

// 5. Stories / Reels (1080×1920, 9:16) — content kept in the safe middle band
{
  const W = 1080, H = 1920, cx = W / 2;
  const body =
    wordmark(cx, 540, 100) +
    headline(cx, 820, ["Find people", "who move", "like you."], 120, 148) +
    sub(cx, 1290, "Adventure matching · hikers,", 44) +
    sub(cx, 1350, "surfers, climbers & explorers", 44) +
    cta(cx, 1540, "Join free · letsroam.life", 46);
  creatives.push(["ad-story-hero-1080x1920.png", svg(W, H, body), W]);
}

for (const [name, svgStr, w] of creatives) {
  writeFileSync(join(OUT, name), render(svgStr, w));
  console.log("wrote", name);
}
console.log("→", OUT);
