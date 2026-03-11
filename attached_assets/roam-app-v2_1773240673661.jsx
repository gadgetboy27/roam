import { useState, useEffect, useRef } from "react";

/* ============================================================
   ROAM — DESIGN TOKENS (locked)
   Forest-dark palette · Playfair + DM Mono + Outfit
   ============================================================ */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap');`;

const CSS = `
:root {
  /* — Core palette — */
  --c-bg:        #0e1a0d;
  --c-surface:   #172116;
  --c-surface2:  #1e2d1c;
  --c-border:    rgba(242,237,227,0.07);
  --c-border2:   rgba(242,237,227,0.13);
  /* — Text — */
  --c-cream:     #f2ede3;
  --c-sand:      #c9bfa8;
  --c-muted:     rgba(242,237,227,0.38);
  /* — Accents — */
  --c-electric:  #c8e64a;
  --c-ember:     #e8621a;
  --c-sky:       #7db8d4;
  --c-violet:    #a78bfa;
  /* — Fonts — */
  --f-display:   'Playfair Display', Georgia, serif;
  --f-mono:      'DM Mono', 'Courier New', monospace;
  --f-body:      'Outfit', system-ui, sans-serif;
  /* — Radii — */
  --r-sm: 10px; --r-md: 16px; --r-lg: 22px; --r-xl: 28px;
  /* — Shadows — */
  --shadow-card: 0 8px 32px rgba(0,0,0,0.45);
}

*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--c-bg);color:var(--c-cream);font-family:var(--f-body);min-height:100vh;overflow-x:hidden;}

/* Topographic background */
.topo{position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 47px,rgba(255,255,255,0.012) 48px),
  repeating-linear-gradient(90deg,transparent,transparent 47px,rgba(255,255,255,0.012) 48px);}

.app{position:relative;z-index:1;max-width:430px;margin:0 auto;min-height:100vh;padding-bottom:30px;}

/* ── NAV ── */
.nav{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px 14px;
  position:sticky;top:0;z-index:100;
  background:rgba(14,26,13,0.94);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--c-border);
}
.logo{font-family:var(--f-display);font-size:26px;font-weight:900;letter-spacing:-1px;line-height:1;}
.logo span{color:var(--c-electric);}
.logo sub{font-family:var(--f-mono);font-size:9px;color:var(--c-muted);letter-spacing:2px;display:block;margin-top:1px;}
.tabs{display:flex;gap:3px;}
.tab{
  padding:7px 13px;border-radius:20px;font-size:11px;
  font-family:var(--f-mono);letter-spacing:.5px;text-transform:uppercase;
  cursor:pointer;border:none;transition:all .2s;
  background:transparent;color:var(--c-muted);
}
.tab.on{background:var(--c-electric);color:var(--c-bg);font-weight:500;}

/* ── DISCOVER ── */
.card{
  margin:18px 14px;border-radius:var(--r-xl);overflow:hidden;
  background:var(--c-surface);border:1px solid var(--c-border);
  box-shadow:var(--shadow-card);
}

/* Hero photo - large */
.hero-photo{position:relative;height:310px;overflow:hidden;}
.hero-photo img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 6s ease;}
.hero-photo:hover img{transform:scale(1.04);}
.hero-gradient{
  position:absolute;inset:0;
  background:linear-gradient(to top, rgba(14,26,13,0.95) 0%, rgba(14,26,13,0.3) 50%, transparent 100%);
}
.hero-badge{
  position:absolute;top:14px;left:14px;
  background:rgba(14,26,13,0.78);backdrop-filter:blur(10px);
  border:1px solid rgba(200,230,74,0.35);
  color:var(--c-electric);font-family:var(--f-mono);font-size:9px;letter-spacing:.6px;
  padding:4px 9px;border-radius:20px;display:flex;align-items:center;gap:5px;
}
.hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--c-electric);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(.8);}}

.hero-name{
  position:absolute;bottom:16px;left:18px;right:18px;
}
.hero-name h2{font-family:var(--f-display);font-size:30px;font-weight:900;line-height:1;letter-spacing:-.5px;}
.hero-name h2 span{font-weight:300;font-size:20px;margin-left:8px;color:var(--c-sand);}
.hero-tagline{font-size:13px;color:rgba(242,237,227,.65);margin-top:5px;font-style:italic;}

/* Sub-photo strip */
.photo-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin:3px 0;}
.strip-cell{position:relative;height:105px;overflow:hidden;cursor:pointer;}
.strip-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
.strip-cell:hover img{transform:scale(1.08);}
.strip-tag{
  position:absolute;bottom:6px;left:6px;
  background:rgba(14,26,13,.82);backdrop-filter:blur(8px);
  color:var(--c-electric);font-family:var(--f-mono);font-size:8px;letter-spacing:.4px;
  padding:3px 6px;border-radius:8px;border:1px solid rgba(200,230,74,.25);
}

/* Card body */
.card-body{padding:16px 18px 18px;}

/* DNA tags */
.dna{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px;}
.dna-tag{padding:5px 10px;border-radius:10px;font-size:11px;font-family:var(--f-mono);letter-spacing:.2px;border:1px solid;}
.dna-tag.shared{background:rgba(200,230,74,.1);border-color:rgba(200,230,74,.45);color:var(--c-electric);}
.dna-tag.unique{background:rgba(125,184,212,.07);border-color:rgba(125,184,212,.3);color:var(--c-sky);}

/* Overlap bar */
.overlap-wrap{
  background:rgba(255,255,255,.04);border-radius:var(--r-sm);
  padding:12px 14px;border:1px solid var(--c-border);margin-bottom:12px;
}
.overlap-head{display:flex;justify-content:space-between;align-items:center;
  font-family:var(--f-mono);font-size:10px;text-transform:uppercase;letter-spacing:.8px;
  color:var(--c-muted);margin-bottom:8px;}
.overlap-pct{color:var(--c-electric);font-size:15px;font-weight:500;}
.bar-track{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;}
.bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--c-electric),var(--c-sky));transition:width 1.1s cubic-bezier(.4,0,.2,1);}

/* Almost met */
.almost{
  background:rgba(232,98,26,.09);border:1px solid rgba(232,98,26,.28);
  border-radius:var(--r-sm);padding:11px 13px;margin-bottom:12px;
  display:flex;align-items:flex-start;gap:9px;
}
.almost-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.almost-text{font-size:12px;color:rgba(242,237,227,.72);line-height:1.55;}
.almost-text strong{color:var(--c-ember);}

/* Actions */
.actions{display:flex;gap:10px;margin-top:14px;}
.btn-pass{
  flex:1;padding:14px;border-radius:var(--r-md);
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  color:rgba(242,237,227,.5);font-family:var(--f-mono);font-size:11px;
  text-transform:uppercase;letter-spacing:1px;cursor:pointer;transition:all .2s;
}
.btn-pass:hover{background:rgba(255,255,255,.1);color:var(--c-cream);}
.btn-roam{
  flex:2.2;padding:14px;border-radius:var(--r-md);
  background:var(--c-electric);border:none;color:var(--c-bg);
  font-family:var(--f-mono);font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:500;
  cursor:pointer;transition:all .2s;
}
.btn-roam:hover{background:#d4f050;transform:translateY(-2px);box-shadow:0 6px 20px rgba(200,230,74,.3);}

/* ── BUCKET LIST ── */
.section{padding:18px 14px 0;}
.section-label{font-family:var(--f-mono);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--c-muted);margin-bottom:12px;}
.hscroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
.hscroll::-webkit-scrollbar{display:none;}
.bucket-card{flex-shrink:0;width:120px;border-radius:var(--r-md);overflow:hidden;position:relative;cursor:pointer;border:1px solid var(--c-border);}
.bucket-card img{width:120px;height:120px;object-fit:cover;display:block;}
.bucket-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(14,26,13,.9) 0%,transparent 55%);display:flex;flex-direction:column;justify-content:flex-end;padding:8px;}
.bucket-name{font-size:11px;font-weight:600;line-height:1.25;}
.bucket-sub{font-size:9px;font-family:var(--f-mono);color:var(--c-sky);margin-top:2px;}
.bucket-badge{position:absolute;top:7px;right:7px;background:var(--c-electric);color:var(--c-bg);font-family:var(--f-mono);font-size:8px;font-weight:500;padding:2px 6px;border-radius:8px;}

/* ── UPLOAD / AI ANALYSER ── */
.upload-head{padding:24px 18px 0;}
.upload-title{font-family:var(--f-display);font-size:30px;font-weight:900;line-height:1.1;}
.upload-title em{color:var(--c-electric);font-style:italic;}
.upload-sub{font-size:13px;color:var(--c-muted);margin-top:8px;line-height:1.6;}

.rules{margin:16px 14px 0;border-radius:var(--r-md);overflow:hidden;border:1px solid var(--c-border);}
.rule{display:flex;align-items:center;gap:11px;padding:11px 14px;background:rgba(255,255,255,.025);border-bottom:1px solid var(--c-border);font-size:12px;color:rgba(242,237,227,.6);}
.rule:last-child{border:none;}
.rule.bad{color:rgba(232,98,26,.75);}
.rule-icon{font-size:16px;flex-shrink:0;}

/* Test photos grid */
.test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:16px 14px 0;}
.test-cell{
  aspect-ratio:1;border-radius:var(--r-sm);overflow:hidden;position:relative;cursor:pointer;
  border:2px solid transparent;transition:all .2s;
}
.test-cell:hover{border-color:rgba(200,230,74,.4);transform:scale(1.02);}
.test-cell.selected{border-color:var(--c-electric);box-shadow:0 0 0 1px var(--c-electric);}
.test-cell img{width:100%;height:100%;object-fit:cover;display:block;}
.test-label{position:absolute;bottom:0;left:0;right:0;padding:5px;background:rgba(14,26,13,.7);font-size:9px;font-family:var(--f-mono);color:var(--c-sand);text-align:center;letter-spacing:.3px;}

.analyse-btn{
  margin:12px 14px 0;width:calc(100% - 28px);padding:14px;
  background:var(--c-electric);border:none;border-radius:var(--r-md);
  color:var(--c-bg);font-family:var(--f-mono);font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:500;
  cursor:pointer;transition:all .2s;
}
.analyse-btn:hover:not(:disabled){background:#d4f050;}
.analyse-btn:disabled{opacity:.45;cursor:default;}

/* AI Result card */
.ai-result{
  margin:14px 14px 0;
  border-radius:var(--r-lg);border:1px solid var(--c-border2);
  overflow:hidden;background:var(--c-surface);
}
.ai-result-header{
  padding:14px 16px;background:rgba(200,230,74,.07);
  border-bottom:1px solid var(--c-border);
  display:flex;align-items:center;gap:10px;
}
.ai-chip{
  background:var(--c-electric);color:var(--c-bg);
  font-family:var(--f-mono);font-size:9px;font-weight:500;letter-spacing:1px;
  padding:3px 8px;border-radius:8px;
}
.ai-title{font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;color:var(--c-sand);}
.ai-body{padding:14px 16px;}

.ai-meters{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;}
.ai-meter{}
.ai-meter-head{display:flex;justify-content:space-between;margin-bottom:5px;font-family:var(--f-mono);font-size:10px;color:var(--c-muted);letter-spacing:.4px;}
.ai-meter-val{font-weight:500;}
.ai-meter-val.good{color:var(--c-electric);}
.ai-meter-val.warn{color:#f59e0b;}
.ai-meter-val.bad{color:var(--c-ember);}
.mini-bar{height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;}
.mini-fill{height:100%;border-radius:2px;transition:width 1s ease .2s;}
.mini-fill.good{background:linear-gradient(90deg,var(--c-electric),#86efac);}
.mini-fill.warn{background:#f59e0b;}
.mini-fill.bad{background:var(--c-ember);}

.ai-verdict{
  padding:10px 12px;border-radius:var(--r-sm);margin-bottom:12px;
  display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.55;
}
.ai-verdict.pass{background:rgba(200,230,74,.08);border:1px solid rgba(200,230,74,.25);color:rgba(242,237,227,.8);}
.ai-verdict.warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);color:rgba(242,237,227,.8);}
.ai-verdict.fail{background:rgba(232,98,26,.08);border:1px solid rgba(232,98,26,.25);color:rgba(242,237,227,.8);}
.verdict-icon{font-size:17px;flex-shrink:0;margin-top:1px;}

.ai-tags{display:flex;flex-wrap:wrap;gap:6px;}
.ai-tag{padding:4px 9px;border-radius:9px;font-size:10px;font-family:var(--f-mono);letter-spacing:.3px;background:rgba(125,184,212,.1);border:1px solid rgba(125,184,212,.3);color:var(--c-sky);}

.thinking{
  margin:14px 14px 0;padding:16px;
  border-radius:var(--r-md);background:var(--c-surface);border:1px solid var(--c-border);
  display:flex;align-items:center;gap:12px;
}
.thinking-dots{display:flex;gap:5px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--c-electric);animation:bounce .9s infinite;}
.dot:nth-child(2){animation-delay:.15s;}
.dot:nth-child(3){animation-delay:.3s;}
@keyframes bounce{0%,100%{transform:translateY(0);opacity:.4;}50%{transform:translateY(-5px);opacity:1;}}
.thinking-text{font-family:var(--f-mono);font-size:11px;color:var(--c-muted);letter-spacing:.4px;}

/* ── MATCHES ── */
.matches-head{padding:24px 18px 16px;}
.matches-eyebrow{font-family:var(--f-mono);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--c-muted);margin-bottom:6px;}
.matches-title{font-family:var(--f-display);font-size:28px;font-weight:900;line-height:1.05;}
.match-list{padding:0 14px;display:flex;flex-direction:column;gap:10px;}
.match-row{
  background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);
  padding:14px;display:flex;gap:13px;align-items:center;
  cursor:pointer;transition:all .2s;
}
.match-row:hover{border-color:rgba(200,230,74,.22);background:var(--c-surface2);}
.match-thumb{width:58px;height:58px;border-radius:var(--r-sm);overflow:hidden;flex-shrink:0;}
.match-thumb img{width:100%;height:100%;object-fit:cover;}
.match-info{flex:1;min-width:0;}
.match-name{font-size:16px;font-weight:600;}
.match-shared{font-size:10px;font-family:var(--f-mono);color:var(--c-electric);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.match-when{font-size:11px;color:var(--c-muted);margin-top:3px;}
.match-pct{
  width:44px;height:44px;border-radius:50%;flex-shrink:0;
  background:rgba(200,230,74,.08);border:1.5px solid rgba(200,230,74,.4);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--f-mono);font-size:12px;font-weight:500;color:var(--c-electric);
}

/* Anims */
@keyframes up{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
.a1{animation:up .4s ease both;}
.a2{animation:up .4s .08s ease both;}
.a3{animation:up .4s .16s ease both;}
.a4{animation:up .4s .24s ease both;}
`;

/* ============================================================
   DATA — curated Unsplash photos (people IN the shot)
   ============================================================ */
const PROFILES = [
  {
    id: 1,
    name: "Mia", age: 28,
    tagline: "Chasing elevation, good coffee and anything with a summit",
    overlap: 78,
    hero: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop",
    heroBadge: "rock climbing · via ferrata",
    strip: [
      { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=80&fit=crop", tag: "alpine trail" },
      { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&fit=crop", tag: "summit camp" },
      { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80&fit=crop", tag: "mountain hut" },
    ],
    sharedTags: ["climbing", "alpine hiking", "night markets"],
    uniqueTags: ["via ferrata", "glacier tours"],
    almostMet: { where: "Milford Sound", when: "Jan 2024" },
    bucketPhoto: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&q=80&fit=crop",
  },
  {
    id: 2,
    name: "Kai", age: 31,
    tagline: "Lost in alleyways, found in barrels",
    overlap: 64,
    hero: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop",
    heroBadge: "surfing · big wave",
    strip: [
      { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80&fit=crop", tag: "tokyo alley" },
      { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80&fit=crop", tag: "aerial coast" },
      { url: "https://images.unsplash.com/photo-1533591895-e49eee94e765?w=400&q=80&fit=crop", tag: "desert camp" },
    ],
    sharedTags: ["surfing", "night markets", "urban roaming"],
    uniqueTags: ["freediving", "desert camping"],
    almostMet: null,
    bucketPhoto: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&q=80&fit=crop",
  },
  {
    id: 3,
    name: "Sam", age: 26,
    tagline: "Every forest has a path worth getting lost on",
    overlap: 59,
    hero: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop",
    heroBadge: "forest trail · backpacking",
    strip: [
      { url: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=400&q=80&fit=crop", tag: "forest trail" },
      { url: "https://images.unsplash.com/photo-1497449493050-aad1e7cad165?w=400&q=80&fit=crop", tag: "kayaking" },
      { url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=400&q=80&fit=crop", tag: "waterfall" },
    ],
    sharedTags: ["backpacking", "kayaking", "forest trails"],
    uniqueTags: ["foraging", "wilderness photography"],
    almostMet: { where: "Abel Tasman", when: "Nov 2023" },
    bucketPhoto: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=200&q=80&fit=crop",
  },
];

const BUCKET = [
  { name: "Faroe Islands", want: "3 matches want this", url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&q=80&fit=crop", count: 3 },
  { name: "Patagonia", want: "7 matches want this", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=80&fit=crop", count: 7 },
  { name: "Kyoto autumn", want: "12 matches want this", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300&q=80&fit=crop", count: 12 },
  { name: "Iceland", want: "5 matches want this", url: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=300&q=80&fit=crop", count: 5 },
  { name: "Lofoten", want: "2 matches want this", url: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=300&q=80&fit=crop", count: 2 },
];

const MATCHES = [
  { name: "Mia, 28", shared: "climbing · alpine hiking · night markets", when: "Matched 2h ago", pct: 78, url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&q=80&fit=crop" },
  { name: "Kai, 31", shared: "surfing · night markets · urban roaming", when: "Matched yesterday", pct: 64, url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&q=80&fit=crop" },
  { name: "Sam, 26", shared: "backpacking · kayaking · forest trails", when: "Matched 3 days ago", pct: 59, url: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=150&q=80&fit=crop" },
];

/* Test photos for the AI analyser demo — mix of good, borderline, and bad */
const TEST_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=300&q=80&fit=crop", label: "person climbing" },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=300&q=80&fit=crop", label: "hiker on trail" },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=300&q=80&fit=crop", label: "person surfing" },
  { url: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=300&q=80&fit=crop", label: "forest selfie" },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80&fit=crop", label: "mountain only" },
  { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&q=80&fit=crop", label: "landscape only" },
];

/* ============================================================
   AI ANALYSER — calls Claude vision via Anthropic API
   ============================================================ */
async function analysePhoto(imageUrl) {
  const prompt = `You are the photo moderation AI for ROAM, an adventure-matching dating app.
Analyse this photo and respond ONLY with a JSON object (no markdown, no explanation).

Return exactly this shape:
{
  "personDetected": <0-100 confidence that a real human is visibly present>,
  "authenticityScore": <0-100 where 100 = genuine candid photo, 0 = AI-generated or heavily manipulated>,
  "adventureScore": <0-100 relevance to real adventure / travel / experience>,
  "isQuoteOrText": <true/false — is this primarily text, a quote graphic, or a screenshot?>,
  "isStockOrGeneric": <true/false — does this look like stock photography or a random nature shot with no personal presence?>,
  "manipulationFlags": <array of strings describing any suspicious edits, or empty array>,
  "adventureTags": <array of 2-4 short tags describing what adventure/place type this shows, e.g. "alpine hiking", "night market", "surf break">,
  "verdict": <"approved" | "needs_person" | "rejected_quote" | "rejected_manipulated" | "rejected_stock">,
  "verdictReason": <one sentence explaining the verdict>
}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  const data = await resp.json();
  const raw = data.content?.map(b => b.text || "").join("").trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function RoamApp() {
  const [tab, setTab] = useState("discover");
  const [pidx, setPidx] = useState(0);
  const [fill, setFill] = useState(0);
  const [selectedTest, setSelectedTest] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const profile = PROFILES[pidx % PROFILES.length];

  useEffect(() => {
    setFill(0);
    const t = setTimeout(() => setFill(profile.overlap), 350);
    return () => clearTimeout(t);
  }, [pidx, tab]);

  const runAnalysis = async () => {
    if (!selectedTest) return;
    setAnalysing(true);
    setAiResult(null);
    try {
      const result = await analysePhoto(selectedTest.url);
      setAiResult({ ...result, photoUrl: selectedTest.url });
    } catch (e) {
      setAiResult({ error: true, msg: e.message });
    }
    setAnalysing(false);
  };

  const getVerdictStyle = (v) => {
    if (!v) return "pass";
    if (v === "approved") return "pass";
    if (v === "needs_person") return "warn";
    return "fail";
  };
  const getVerdictIcon = (v) => {
    if (v === "approved") return "✅";
    if (v === "needs_person") return "⚠️";
    if (v === "rejected_quote") return "🚫";
    if (v === "rejected_manipulated") return "🔍";
    return "❌";
  };
  const getMeterClass = (val) => val >= 70 ? "good" : val >= 40 ? "warn" : "bad";

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div className="topo" />
      <div className="app">

        {/* NAV */}
        <nav className="nav">
          <div className="logo">
            roam<span>.</span>
            <sub>adventure matching</sub>
          </div>
          <div className="tabs">
            {[["discover","🧭"],["upload","📸"],["matches","💬"]].map(([t,ic]) => (
              <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{ic} {t}</button>
            ))}
          </div>
        </nav>

        {/* ── DISCOVER ── */}
        {tab === "discover" && (
          <div className="a1">
            <div className="card">
              {/* Hero */}
              <div className="hero-photo">
                <img src={profile.hero} alt={profile.name} />
                <div className="hero-gradient" />
                <div className="hero-badge">
                  <span className="hero-badge-dot" />
                  {profile.heroBadge}
                </div>
                <div className="hero-name">
                  <h2>{profile.name} <span>{profile.age}</span></h2>
                  <div className="hero-tagline">"{profile.tagline}"</div>
                </div>
              </div>

              {/* Strip */}
              <div className="photo-strip">
                {profile.strip.map((p, i) => (
                  <div className="strip-cell" key={i}>
                    <img src={p.url} alt={p.tag} />
                    <div className="strip-tag">📍 {p.tag}</div>
                  </div>
                ))}
              </div>

              {/* Body */}
              <div className="card-body">
                <div className="dna">
                  {profile.sharedTags.map(t => <span key={t} className="dna-tag shared">✓ {t}</span>)}
                  {profile.uniqueTags.map(t => <span key={t} className="dna-tag unique">{t}</span>)}
                </div>

                <div className="overlap-wrap">
                  <div className="overlap-head">
                    <span>Adventure DNA overlap</span>
                    <span className="overlap-pct">{fill}%</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{width:`${fill}%`}} /></div>
                </div>

                {profile.almostMet && (
                  <div className="almost">
                    <span className="almost-icon">⚡</span>
                    <div className="almost-text">
                      You were both at <strong>{profile.almostMet.where}</strong> in {profile.almostMet.when} — you nearly crossed paths.
                    </div>
                  </div>
                )}

                <div className="actions">
                  <button className="btn-pass" onClick={() => { setFill(0); setPidx(i => i+1); }}>Pass</button>
                  <button className="btn-roam" onClick={() => setTab("matches")}>✦ Roam Together</button>
                </div>
              </div>
            </div>

            {/* Bucket list */}
            <div className="section a2">
              <div className="section-label">🗺️ Bucket list matches near you</div>
              <div className="hscroll">
                {BUCKET.map((b, i) => (
                  <div className="bucket-card" key={i}>
                    <img src={b.url} alt={b.name} />
                    <div className="bucket-overlay">
                      <div className="bucket-name">{b.name}</div>
                      <div className="bucket-sub">{b.want}</div>
                    </div>
                    <div className="bucket-badge">{b.count}×</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOAD / AI ANALYSER ── */}
        {tab === "upload" && (
          <div>
            <div className="upload-head a1">
              <div className="upload-title">Your <em>adventure</em><br/>story</div>
              <div className="upload-sub">Post where you've been. Our AI reads places and people — not just your face. Tap a photo below to see live AI screening.</div>
            </div>

            <div className="rules a2">
              <div className="rule"><span className="rule-icon">🧗</span> Photos with YOU in the adventure — strongly preferred</div>
              <div className="rule"><span className="rule-icon">🏝️</span> Places, food, experiences — yes</div>
              <div className="rule bad"><span className="rule-icon">🚫</span> Quote graphics & text screenshots — auto-rejected</div>
              <div className="rule bad"><span className="rule-icon">🚫</span> AI-generated or heavily edited images — flagged</div>
              <div className="rule bad"><span className="rule-icon">🚫</span> Generic stock / random landscapes (no you) — pushed down</div>
            </div>

            {/* Test photo picker */}
            <div className="section a3">
              <div className="section-label">🤖 Live AI photo screener — tap to test</div>
              <div className="test-grid">
                {TEST_PHOTOS.map((p, i) => (
                  <div
                    key={i}
                    className={`test-cell ${selectedTest?.url === p.url ? "selected" : ""}`}
                    onClick={() => { setSelectedTest(p); setAiResult(null); }}
                  >
                    <img src={p.url} alt={p.label} />
                    <div className="test-label">{p.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="analyse-btn a3"
              onClick={runAnalysis}
              disabled={!selectedTest || analysing}
            >
              {analysing ? "analysing…" : selectedTest ? `✦ analyse "${selectedTest.label}"` : "select a photo above"}
            </button>

            {/* Thinking indicator */}
            {analysing && (
              <div className="thinking a1">
                <div className="thinking-dots">
                  <div className="dot" /><div className="dot" /><div className="dot" />
                </div>
                <div className="thinking-text">Claude is reading the photo — detecting people, checking authenticity, tagging adventures…</div>
              </div>
            )}

            {/* AI Result */}
            {aiResult && !aiResult.error && (
              <div className="ai-result a1" style={{marginBottom:20}}>
                <div className="ai-result-header">
                  <span className="ai-chip">AI VERDICT</span>
                  <span className="ai-title">{aiResult.verdict?.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <div className="ai-body">
                  <div className="ai-verdict {getVerdictStyle(aiResult.verdict)}" style={{
                    background: aiResult.verdict==="approved" ? "rgba(200,230,74,.08)" : aiResult.verdict==="needs_person" ? "rgba(245,158,11,.08)" : "rgba(232,98,26,.08)",
                    border: `1px solid ${aiResult.verdict==="approved" ? "rgba(200,230,74,.3)" : aiResult.verdict==="needs_person" ? "rgba(245,158,11,.3)" : "rgba(232,98,26,.3)"}`,
                    borderRadius:"var(--r-sm)",padding:"10px 12px",marginBottom:"12px",
                    display:"flex",gap:"9px",alignItems:"flex-start",fontSize:"12px",lineHeight:"1.55",
                    color:"rgba(242,237,227,.8)"
                  }}>
                    <span style={{fontSize:17,flexShrink:0}}>{getVerdictIcon(aiResult.verdict)}</span>
                    <span>{aiResult.verdictReason}</span>
                  </div>

                  <div className="ai-meters">
                    {[
                      { label: "Person detected", val: aiResult.personDetected },
                      { label: "Authenticity", val: aiResult.authenticityScore },
                      { label: "Adventure relevance", val: aiResult.adventureScore },
                    ].map(m => (
                      <div className="ai-meter" key={m.label}>
                        <div className="ai-meter-head">
                          <span>{m.label}</span>
                          <span className={`ai-meter-val ${getMeterClass(m.val)}`}>{m.val}%</span>
                        </div>
                        <div className="mini-bar">
                          <div className={`mini-fill ${getMeterClass(m.val)}`} style={{width:`${m.val}%`}} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {aiResult.manipulationFlags?.length > 0 && (
                    <div style={{marginBottom:12,fontSize:11,fontFamily:"var(--f-mono)",color:"var(--c-ember)",letterSpacing:".3px"}}>
                      ⚠ {aiResult.manipulationFlags.join(" · ")}
                    </div>
                  )}

                  {aiResult.adventureTags?.length > 0 && (
                    <>
                      <div style={{fontFamily:"var(--f-mono)",fontSize:9,letterSpacing:"1.2px",textTransform:"uppercase",color:"var(--c-muted)",marginBottom:7}}>Auto-tagged as</div>
                      <div className="ai-tags">
                        {aiResult.adventureTags.map(t => <span key={t} className="ai-tag">{t}</span>)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {aiResult?.error && (
              <div style={{margin:"14px",padding:"14px",borderRadius:"var(--r-md)",background:"rgba(232,98,26,.1)",border:"1px solid rgba(232,98,26,.3)",fontSize:12,fontFamily:"var(--f-mono)",color:"var(--c-ember)"}}>
                Analysis failed: {aiResult.msg}
              </div>
            )}
          </div>
        )}

        {/* ── MATCHES ── */}
        {tab === "matches" && (
          <div>
            <div className="matches-head a1">
              <div className="matches-eyebrow">adventures aligned</div>
              <div className="matches-title">{MATCHES.length} new<br/>connections ✦</div>
            </div>
            <div className="match-list">
              {MATCHES.map((m, i) => (
                <div className="match-row a1" key={i} style={{animationDelay:`${i*.07}s`}}>
                  <div className="match-thumb"><img src={m.url} alt={m.name} /></div>
                  <div className="match-info">
                    <div className="match-name">{m.name}</div>
                    <div className="match-shared">{m.shared}</div>
                    <div className="match-when">{m.when}</div>
                  </div>
                  <div className="match-pct">{m.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
