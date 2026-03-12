import { useState, useEffect, useRef } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap');`;

const img  = (seed, w=800, h=1000) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const imgS = (seed, w=80,  h=80)   => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const CSS = `
:root {
  --c-bg:       #0e1a0d;
  --c-surface:  #172116;
  --c-surface2: #1e2d1c;
  --c-border:   rgba(242,237,227,0.07);
  --c-border2:  rgba(242,237,227,0.14);
  --c-cream:    #f2ede3;
  --c-sand:     #c9bfa8;
  --c-muted:    rgba(242,237,227,0.38);
  --c-electric: #c8e64a;
  --c-ember:    #e8621a;
  --c-sky:      #7db8d4;
  --f-display:  'Playfair Display', Georgia, serif;
  --f-mono:     'DM Mono', monospace;
  --f-body:     'Outfit', sans-serif;
  --r-sm:10px; --r-md:16px; --r-lg:22px; --r-xl:28px;
}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:var(--c-bg);color:var(--c-cream);font-family:var(--f-body);height:100%;}

.topo{position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:
    repeating-linear-gradient(0deg,transparent,transparent 47px,rgba(255,255,255,0.01) 48px),
    repeating-linear-gradient(90deg,transparent,transparent 47px,rgba(255,255,255,0.01) 48px);}

.app{position:relative;z-index:1;max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;padding-bottom:80px;}

/* ── NAV ── */
.nav{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px 14px;
  position:sticky;top:0;z-index:100;
  background:rgba(14,26,13,0.96);backdrop-filter:blur(16px);
  border-bottom:1px solid var(--c-border);
}
.logo{font-family:var(--f-display);font-size:26px;font-weight:900;letter-spacing:-1px;line-height:1;}
.logo em{color:var(--c-electric);font-style:normal;}
.logo sub{display:block;font-family:var(--f-mono);font-size:9px;letter-spacing:2px;color:var(--c-muted);margin-top:1px;text-transform:uppercase;}
.nav-tabs{display:flex;gap:3px;}
.ntab{
  padding:7px 13px;border-radius:20px;font-size:11px;
  font-family:var(--f-mono);letter-spacing:.5px;text-transform:uppercase;
  cursor:pointer;border:none;transition:all .2s;
  background:transparent;color:var(--c-muted);
}
.ntab.on{background:var(--c-electric);color:var(--c-bg);font-weight:500;}

/* ── STORIES RAIL ── */
.stories{
  display:flex;gap:11px;padding:14px 16px 12px;
  overflow-x:auto;scrollbar-width:none;flex-shrink:0;
  border-bottom:1px solid var(--c-border);
  background:rgba(14,26,13,.6);
}
.stories::-webkit-scrollbar{display:none;}

.sv{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;}
.sv-ring{
  width:58px;height:58px;border-radius:50%;padding:2.5px;
  background:linear-gradient(135deg,var(--c-electric),var(--c-sky));
  transition:transform .2s;position:relative;
}
.sv-ring:hover{transform:scale(1.06);}
.sv-ring.seen{background:linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,.06));}
.sv-ring.has-video::after{
  content:'▶';
  position:absolute;bottom:-2px;right:-2px;
  width:18px;height:18px;border-radius:50%;
  background:var(--c-ember);border:2px solid var(--c-bg);
  font-size:7px;display:flex;align-items:center;justify-content:center;
  line-height:18px;text-align:center;
}
.sv-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;border:2.5px solid var(--c-bg);background:var(--c-surface);}
.sv-inner img{width:100%;height:100%;object-fit:cover;display:block;}
.sv-name{font-family:var(--f-mono);font-size:9px;color:var(--c-sand);max-width:58px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.sv-add{
  width:58px;height:58px;border-radius:50%;flex-shrink:0;
  background:rgba(200,230,74,.07);border:1.5px dashed rgba(200,230,74,.35);
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:all .2s;
}
.sv-add:hover{background:rgba(200,230,74,.13);}
.sv-add-icon{font-size:22px;color:var(--c-electric);line-height:1;}

/* ── STORY VIEWER ── */
.story-overlay{
  position:fixed;inset:0;z-index:200;background:#000;
  display:flex;flex-direction:column;
}
.s-bars{display:flex;gap:3px;padding:14px 14px 0;flex-shrink:0;}
.s-bar{flex:1;height:2px;background:rgba(255,255,255,.2);border-radius:1px;overflow:hidden;}
.s-bar-fill{height:100%;background:white;border-radius:1px;}
.s-head{
  display:flex;align-items:center;gap:10px;
  padding:10px 14px 6px;flex-shrink:0;
}
.s-av{width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid white;background:var(--c-surface);flex-shrink:0;}
.s-av img{width:100%;height:100%;object-fit:cover;}
.s-meta{flex:1;}
.s-name{font-size:14px;font-weight:600;line-height:1.2;}
.s-sub{font-family:var(--f-mono);font-size:10px;color:rgba(255,255,255,.45);margin-top:2px;}
.s-close{font-size:22px;cursor:pointer;color:rgba(255,255,255,.6);padding:6px;}

.s-media{flex:1;position:relative;overflow:hidden;cursor:pointer;}
.s-media img{width:100%;height:100%;object-fit:cover;display:block;}

/* Fake video player overlay for story video */
.s-video-wrap{width:100%;height:100%;position:relative;background:#000;display:flex;align-items:center;justify-content:center;}
.s-video-bg{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;filter:brightness(.5);}
.s-video-ui{
  position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:12px;
}
.s-video-play{
  width:64px;height:64px;border-radius:50%;
  background:rgba(200,230,74,.2);border:2px solid var(--c-electric);
  display:flex;align-items:center;justify-content:center;
  font-size:26px;animation:vpulse 2s infinite;
}
@keyframes vpulse{0%,100%{box-shadow:0 0 0 0 rgba(200,230,74,.4);}50%{box-shadow:0 0 0 14px rgba(200,230,74,0);}}
.s-video-label{font-family:var(--f-mono);font-size:11px;letter-spacing:1px;color:var(--c-electric);text-transform:uppercase;}
.s-video-bar{
  width:200px;height:3px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden;
}
.s-video-prog{
  height:100%;background:var(--c-electric);border-radius:2px;
  animation:vidprog 20s linear forwards;
}
@keyframes vidprog{from{width:0;}to{width:100%;}}
.s-video-duration{font-family:var(--f-mono);font-size:10px;color:rgba(255,255,255,.4);}

.s-loc{
  position:absolute;bottom:88px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,.65);backdrop-filter:blur(10px);
  border:1px solid rgba(200,230,74,.4);color:var(--c-electric);
  font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;
  padding:6px 16px;border-radius:20px;white-space:nowrap;
}
.s-cap{
  position:absolute;bottom:18px;left:16px;right:16px;text-align:center;
  font-size:14px;line-height:1.55;color:rgba(255,255,255,.85);
  text-shadow:0 2px 14px rgba(0,0,0,.85);
}
.s-footer{
  display:flex;gap:10px;padding:12px 14px 20px;background:rgba(0,0,0,.55);flex-shrink:0;
}
.s-input{
  flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
  border-radius:22px;padding:10px 16px;color:white;font-family:var(--f-body);font-size:13px;outline:none;
}
.s-input::placeholder{color:rgba(255,255,255,.4);}
.s-react-btn{
  width:42px;height:42px;border-radius:50%;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);
  display:flex;align-items:center;justify-content:center;font-size:20px;
  cursor:pointer;transition:all .2s;flex-shrink:0;
}
.s-react-btn:hover{background:rgba(255,255,255,.18);}

/* ── DISCOVER CARD ── */
.discover-wrap{padding:16px 14px 0;}

.match-card{
  border-radius:var(--r-xl);overflow:hidden;
  background:var(--c-surface);
  border:1px solid var(--c-border);
  box-shadow:0 12px 48px rgba(0,0,0,.5);
}

/* Hero image — full bleed, tall */
.card-hero{
  position:relative;height:340px;overflow:hidden;
}
.card-hero img{
  width:100%;height:100%;object-fit:cover;display:block;
  transition:transform 7s ease;
}
.card-hero:hover img{transform:scale(1.04);}
.card-hero-grad{
  position:absolute;inset:0;
  background:linear-gradient(to top, rgba(14,26,13,.95) 0%, rgba(14,26,13,.2) 55%, transparent 100%);
}

/* Has video badge */
.card-video-badge{
  position:absolute;top:14px;left:14px;
  background:var(--c-ember);
  border-radius:8px;padding:4px 10px;
  display:flex;align-items:center;gap:6px;
  font-family:var(--f-mono);font-size:9px;font-weight:500;letter-spacing:1px;text-transform:uppercase;
}
.cvb-dot{width:6px;height:6px;border-radius:50%;background:white;animation:blink 1.6s infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:.3;}}

.card-verified{
  position:absolute;top:14px;right:14px;
  background:rgba(14,26,13,.78);backdrop-filter:blur(10px);
  border:1px solid rgba(200,230,74,.35);
  border-radius:20px;padding:5px 11px;
  display:flex;align-items:center;gap:6px;
  font-family:var(--f-mono);font-size:9px;letter-spacing:.5px;color:var(--c-electric);
}
.verified-dot{width:7px;height:7px;border-radius:50%;background:var(--c-electric);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.45;transform:scale(.7);}}

.card-name-block{
  position:absolute;bottom:16px;left:18px;right:18px;
}
.card-name{font-family:var(--f-display);font-size:32px;font-weight:900;line-height:1;letter-spacing:-.5px;}
.card-age{font-family:var(--f-body);font-weight:300;font-size:20px;margin-left:10px;color:var(--c-sand);}
.card-tagline{font-size:13px;color:rgba(242,237,227,.6);margin-top:6px;font-style:italic;line-height:1.4;}

/* Sub-photo strip */
.card-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:3px 0;}
.strip-cell{
  position:relative;height:110px;overflow:hidden;cursor:pointer;
  background:var(--c-surface2);
}
.strip-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
.strip-cell:hover img{transform:scale(1.08);}
.strip-tag{
  position:absolute;bottom:6px;left:6px;
  background:rgba(14,26,13,.82);backdrop-filter:blur(8px);
  color:var(--c-electric);font-family:var(--f-mono);font-size:8px;letter-spacing:.3px;
  padding:3px 7px;border-radius:8px;border:1px solid rgba(200,230,74,.22);
}
/* Video strip cell */
.strip-cell.is-video{cursor:pointer;}
.strip-video-overlay{
  position:absolute;inset:0;
  background:rgba(14,26,13,.45);
  display:flex;align-items:center;justify-content:center;
  transition:background .2s;
}
.strip-cell.is-video:hover .strip-video-overlay{background:rgba(14,26,13,.25);}
.strip-play{
  width:38px;height:38px;border-radius:50%;
  background:rgba(232,98,26,.85);
  display:flex;align-items:center;justify-content:center;
  font-size:14px;
  box-shadow:0 2px 12px rgba(0,0,0,.4);
}
.strip-video-dur{
  position:absolute;bottom:6px;right:6px;
  background:rgba(0,0,0,.7);color:white;
  font-family:var(--f-mono);font-size:8px;letter-spacing:.3px;
  padding:2px 6px;border-radius:6px;
}

/* Card body */
.card-body{padding:16px 18px 18px;}

/* DNA tags */
.dna{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 13px;}
.dtag{padding:5px 10px;border-radius:10px;font-size:11px;font-family:var(--f-mono);letter-spacing:.2px;border:1px solid;}
.dtag.shared{background:rgba(200,230,74,.1);border-color:rgba(200,230,74,.45);color:var(--c-electric);}
.dtag.unique{background:rgba(125,184,212,.07);border-color:rgba(125,184,212,.3);color:var(--c-sky);}

/* Overlap bar */
.overlap{
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
.almost em{font-size:18px;flex-shrink:0;margin-top:1px;font-style:normal;}
.almost-text{font-size:12px;color:rgba(242,237,227,.72);line-height:1.55;}
.almost-text strong{color:var(--c-ember);}

/* Watch clip CTA */
.watch-clip{
  background:rgba(232,98,26,.08);border:1px solid rgba(232,98,26,.28);
  border-radius:var(--r-sm);padding:11px 13px;margin-bottom:12px;
  display:flex;align-items:center;gap:10px;cursor:pointer;transition:all .2s;
}
.watch-clip:hover{background:rgba(232,98,26,.14);border-color:rgba(232,98,26,.45);}
.wc-icon{font-size:22px;flex-shrink:0;}
.wc-text{}
.wc-label{font-size:13px;font-weight:600;color:var(--c-cream);}
.wc-sub{font-family:var(--f-mono);font-size:10px;color:rgba(232,98,26,.8);letter-spacing:.3px;margin-top:2px;}
.wc-badge{
  margin-left:auto;background:var(--c-ember);color:white;
  font-family:var(--f-mono);font-size:9px;letter-spacing:.5px;
  padding:3px 8px;border-radius:8px;flex-shrink:0;
}

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
.btn-roam:hover{background:#d4f050;transform:translateY(-2px);box-shadow:0 6px 22px rgba(200,230,74,.3);}

/* ── BUCKET LIST ── */
.section{padding:18px 14px 0;}
.sec-label{font-family:var(--f-mono);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--c-muted);margin-bottom:12px;}
.hscroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
.hscroll::-webkit-scrollbar{display:none;}
.bcard{flex-shrink:0;width:118px;border-radius:var(--r-md);overflow:hidden;position:relative;cursor:pointer;border:1px solid var(--c-border);}
.bcard img{width:118px;height:118px;object-fit:cover;display:block;}
.bcard-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(14,26,13,.88) 0%,transparent 55%);display:flex;flex-direction:column;justify-content:flex-end;padding:8px;}
.bcard-name{font-size:11px;font-weight:600;line-height:1.25;}
.bcard-sub{font-size:9px;font-family:var(--f-mono);color:var(--c-sky);margin-top:2px;}
.bcard-badge{position:absolute;top:7px;right:7px;background:var(--c-electric);color:var(--c-bg);font-family:var(--f-mono);font-size:8px;font-weight:500;padding:2px 6px;border-radius:8px;}

/* ── VIDEO VIEWER ── */
.video-overlay{
  position:fixed;inset:0;z-index:300;background:#000;
  display:flex;flex-direction:column;
}
.vid-head{
  display:flex;align-items:center;gap:10px;padding:16px 14px 10px;
  position:absolute;top:0;left:0;right:0;z-index:10;
  background:linear-gradient(to bottom,rgba(0,0,0,.7) 0%,transparent 100%);
}
.vid-av{width:38px;height:38px;border-radius:50%;overflow:hidden;border:2px solid var(--c-ember);flex-shrink:0;}
.vid-av img{width:100%;height:100%;object-fit:cover;}
.vid-meta{flex:1;}
.vid-name{font-size:14px;font-weight:600;}
.vid-loc{font-family:var(--f-mono);font-size:10px;color:rgba(255,255,255,.5);margin-top:2px;}
.vid-close{font-size:24px;cursor:pointer;color:rgba(255,255,255,.65);padding:4px;}

/* Simulated video — image with scanline + progress */
.vid-media{flex:1;position:relative;overflow:hidden;}
.vid-media img{width:100%;height:100%;object-fit:cover;display:block;}
.scanline{
  position:absolute;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px);
  pointer-events:none;
}
.vid-prog-bar{
  position:absolute;bottom:0;left:0;right:0;height:3px;
  background:rgba(255,255,255,.15);
}
.vid-prog-fill{
  height:100%;background:var(--c-ember);
  border-radius:0 2px 2px 0;
}
.vid-duration{
  position:absolute;top:14px;right:14px;margin-top:60px;
  background:rgba(0,0,0,.65);color:rgba(255,255,255,.8);
  font-family:var(--f-mono);font-size:10px;letter-spacing:.5px;
  padding:3px 8px;border-radius:6px;
}
.vid-tag{
  position:absolute;bottom:24px;left:16px;
  background:rgba(14,26,13,.75);backdrop-filter:blur(10px);
  border:1px solid rgba(200,230,74,.3);color:var(--c-electric);
  font-family:var(--f-mono);font-size:10px;letter-spacing:.3px;
  padding:4px 10px;border-radius:10px;
}
.vid-match-badge{
  position:absolute;bottom:24px;right:16px;
  background:var(--c-electric);color:var(--c-bg);
  font-family:var(--f-mono);font-size:10px;font-weight:500;letter-spacing:.5px;
  padding:4px 10px;border-radius:10px;cursor:pointer;
  transition:all .2s;
}
.vid-match-badge:hover{background:#d4f050;}

/* ── MATCHES TAB ── */
.match-list{padding:16px 14px;display:flex;flex-direction:column;gap:10px;}
.mrow{
  background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);
  padding:14px;display:flex;gap:13px;align-items:center;
  cursor:pointer;transition:all .2s;
}
.mrow:hover{border-color:rgba(200,230,74,.22);background:var(--c-surface2);}
.mrow-av{width:56px;height:56px;border-radius:var(--r-sm);overflow:hidden;flex-shrink:0;background:var(--c-surface2);}
.mrow-av img{width:100%;height:100%;object-fit:cover;}
.mrow-info{flex:1;min-width:0;}
.mrow-name{font-size:15px;font-weight:600;}
.mrow-tags{font-size:10px;font-family:var(--f-mono);color:var(--c-electric);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mrow-time{font-size:11px;color:var(--c-muted);margin-top:3px;}
.mrow-pct{
  width:44px;height:44px;border-radius:50%;flex-shrink:0;
  background:rgba(200,230,74,.08);border:1.5px solid rgba(200,230,74,.4);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--f-mono);font-size:12px;font-weight:500;color:var(--c-electric);
}
.has-video-tag{
  display:inline-flex;align-items:center;gap:4px;
  background:rgba(232,98,26,.12);border:1px solid rgba(232,98,26,.3);
  color:var(--c-ember);font-family:var(--f-mono);font-size:9px;letter-spacing:.4px;
  padding:2px 6px;border-radius:6px;margin-top:4px;
}

/* ── BOTTOM NAV ── */
.bottomnav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:430px;
  display:flex;align-items:center;justify-content:space-around;
  padding:10px 0 18px;
  background:rgba(14,26,13,.96);backdrop-filter:blur(20px);
  border-top:1px solid var(--c-border);z-index:100;
}
.bn{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;background:none;border:none;padding:4px 12px;transition:all .2s;}
.bn:hover .bn-ic{transform:translateY(-2px);}
.bn-ic{font-size:22px;transition:transform .2s;}
.bn-lb{font-family:var(--f-mono);font-size:8px;letter-spacing:.8px;text-transform:uppercase;color:var(--c-muted);transition:color .2s;}
.bn.on .bn-lb{color:var(--c-electric);}
.bn.on .bn-ic{filter:drop-shadow(0 0 5px rgba(200,230,74,.5));}
.bn-post{
  width:48px;height:48px;border-radius:50%;
  background:var(--c-electric);border:none;
  display:flex;align-items:center;justify-content:center;
  font-size:24px;cursor:pointer;transition:all .25s;color:var(--c-bg);font-weight:700;
  box-shadow:0 4px 18px rgba(200,230,74,.38);
}
.bn-post:hover{transform:scale(1.1) translateY(-3px);box-shadow:0 8px 28px rgba(200,230,74,.5);}

/* Anims */
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
.a1{animation:fadeUp .4s ease both;}
.a2{animation:fadeUp .4s .08s ease both;}
.a3{animation:fadeUp .4s .16s ease both;}
`;

/* ── DATA ── */
const PEOPLE = [
  {
    id:1, name:"Mia", age:28,
    tagline:"Chasing elevation, good coffee, anything with a summit",
    overlap:78,
    heroSeed:"mia-glacier-hero",
    stripSeeds:[
      {seed:"mia-trail-1",tag:"alpine trail"},
      {seed:"mia-summit-camp",tag:"summit camp"},
      {seed:"mia-video-thumb",tag:"20s clip",isVideo:true,duration:"0:18"},
    ],
    sharedTags:["climbing","alpine hiking","night markets"],
    uniqueTags:["via ferrata","glacier tours"],
    almostMet:{where:"Milford Sound",when:"Jan 2024"},
    hasVideo:true,
    videoSeed:"mia-glacier-hero",
    videoTag:"glacier hiking · Franz Josef",
    av:imgS("mia-av"),
    storyBig:img("mia-story-big",800,1200),
    storyLoc:"Franz Josef Glacier, NZ",
    storyCap:"Finally made it to the ice 🧊 Six hours and every metre worth it.",
    storyIsVideo:false,
  },
  {
    id:2, name:"Kai", age:31,
    tagline:"Lost in alleyways, found in barrels",
    overlap:64,
    heroSeed:"kai-surf-hero",
    stripSeeds:[
      {seed:"kai-alley",tag:"tokyo night"},
      {seed:"kai-video-thumb",tag:"20s clip",isVideo:true,duration:"0:20"},
      {seed:"kai-desert",tag:"desert camp"},
    ],
    sharedTags:["surfing","night markets","urban roaming"],
    uniqueTags:["freediving","desert camping"],
    almostMet:null,
    hasVideo:true,
    videoSeed:"kai-surf-hero",
    videoTag:"dawn patrol · Raglan",
    av:imgS("kai-av"),
    storyBig:img("kai-story-big",800,1200),
    storyLoc:"Raglan, Waikato NZ",
    storyCap:"Dawn glass ▶ 20 sec clip — see why I live here",
    storyIsVideo:true,
  },
  {
    id:3, name:"Sam", age:26,
    tagline:"Every forest has a path worth getting lost on",
    overlap:59,
    heroSeed:"sam-forest-hero",
    stripSeeds:[
      {seed:"sam-trail",tag:"coastal trail"},
      {seed:"sam-kayak",tag:"kayaking"},
      {seed:"sam-waterfall",tag:"waterfall"},
    ],
    sharedTags:["backpacking","kayaking","forest trails"],
    uniqueTags:["foraging","wilderness photography"],
    almostMet:{where:"Abel Tasman",when:"Nov 2023"},
    hasVideo:false,
    av:imgS("sam-av"),
    storyBig:img("sam-story-big",800,1200),
    storyLoc:"Abel Tasman Track",
    storyCap:"Day 3 of 5. Blisters: 3. Regrets: 0.",
    storyIsVideo:false,
  },
];

const BUCKET = [
  {name:"Faroe Islands",seed:"bucket-faroe",want:"3 want this",count:3},
  {name:"Patagonia",seed:"bucket-patagonia",want:"7 want this",count:7},
  {name:"Kyoto autumn",seed:"bucket-kyoto",want:"12 want this",count:12},
  {name:"Iceland",seed:"bucket-iceland",want:"5 want this",count:5},
  {name:"Lofoten",seed:"bucket-lofoten",want:"2 want this",count:2},
];

const MATCHES = [
  {name:"Mia, 28",tags:"climbing · alpine hiking · night markets",when:"Matched 2h ago",pct:78,seed:"mia-av",hasVideo:true},
  {name:"Kai, 31",tags:"surfing · night markets · urban roaming",when:"Matched yesterday",pct:64,seed:"kai-av",hasVideo:true},
  {name:"Sam, 26",tags:"backpacking · kayaking · forest trails",when:"Matched 3 days ago",pct:59,seed:"sam-av",hasVideo:false},
];

/* ── COMPONENT ── */
export default function RoamApp() {
  const [tab,setTab]           = useState("discover");
  const [pidx,setPidx]         = useState(0);
  const [fill,setFill]         = useState(0);
  const [openStory,setOpenStory] = useState(null);
  const [seenStories,setSeenStories] = useState(new Set());
  const [storyProg,setStoryProg]   = useState(0);
  const [openVideo,setOpenVideo]   = useState(null); // person object
  const [vidProg,setVidProg]       = useState(0);
  const vidRef = useRef(null);

  const profile = PEOPLE[pidx % PEOPLE.length];

  // Overlap bar animate
  useEffect(() => {
    setFill(0);
    const t = setTimeout(() => setFill(profile.overlap), 350);
    return () => clearTimeout(t);
  },[pidx,tab]);

  // Story timer
  useEffect(() => {
    if (openStory === null) return;
    setStoryProg(0);
    const duration = PEOPLE[openStory]?.storyIsVideo ? 20000 : 5000;
    const steps = 100;
    const iv = setInterval(() => {
      setStoryProg(p => {
        if (p >= 100) {
          clearInterval(iv);
          setSeenStories(s => new Set([...s,openStory]));
          const next = openStory + 1;
          setOpenStory(next < PEOPLE.length ? next : null);
          return 0;
        }
        return p + (100 / (duration / (duration / steps)));
      });
    }, duration / steps);
    return () => clearInterval(iv);
  },[openStory]);

  // Video timer
  useEffect(() => {
    if (!openVideo) return;
    setVidProg(0);
    const iv = setInterval(() => {
      setVidProg(p => {
        if (p >= 100) { clearInterval(iv); return 100; }
        return p + 0.5; // 20s at 100 ticks
      });
    }, 100);
    return () => clearInterval(iv);
  },[openVideo]);

  const pass = () => { setFill(0); setPidx(i => i+1); };

  const elapsed = Math.round(vidProg * 0.2); // seconds out of 20

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div className="topo"/>

      {/* ── STORY VIEWER ── */}
      {openStory !== null && (
        <div className="story-overlay">
          <div className="s-bars">
            {PEOPLE.map((_,i) => (
              <div className="s-bar" key={i}>
                <div className="s-bar-fill" style={{
                  width: i < openStory ? "100%" : i === openStory ? `${storyProg}%` : "0%",
                  transition: i === openStory ? "none" : undefined
                }}/>
              </div>
            ))}
          </div>
          <div className="s-head">
            <div className="s-av"><img src={PEOPLE[openStory].av} alt=""/></div>
            <div className="s-meta">
              <div className="s-name">{PEOPLE[openStory].name}</div>
              <div className="s-sub">
                {PEOPLE[openStory].storyIsVideo ? "▶ 20 sec clip · " : ""}{PEOPLE[openStory].storyLoc}
              </div>
            </div>
            <div className="s-close" onClick={() => setOpenStory(null)}>✕</div>
          </div>
          <div className="s-media" onClick={() => {
            setSeenStories(s => new Set([...s,openStory]));
            const next = openStory + 1;
            setOpenStory(next < PEOPLE.length ? next : null);
          }}>
            {PEOPLE[openStory].storyIsVideo ? (
              <div className="s-video-wrap">
                <img className="s-video-bg" src={PEOPLE[openStory].storyBig} alt=""/>
                <div className="s-video-ui">
                  <div className="s-video-play">▶</div>
                  <div className="s-video-label">Playing 20s clip</div>
                  <div className="s-video-bar">
                    <div className="s-video-prog"/>
                  </div>
                  <div className="s-video-duration">20 seconds · {PEOPLE[openStory].storyLoc}</div>
                </div>
              </div>
            ) : (
              <img src={PEOPLE[openStory].storyBig} alt=""/>
            )}
            <div className="s-loc">📍 {PEOPLE[openStory].storyLoc}</div>
            <div className="s-cap">{PEOPLE[openStory].storyCap}</div>
          </div>
          <div className="s-footer" onClick={e => e.stopPropagation()}>
            <input className="s-input" placeholder={`Reply to ${PEOPLE[openStory].name}…`}/>
            <div className="s-react-btn">🔥</div>
            <div className="s-react-btn">❤️</div>
          </div>
        </div>
      )}

      {/* ── VIDEO VIEWER ── */}
      {openVideo && (
        <div className="video-overlay">
          <div className="vid-head">
            <div className="vid-av"><img src={openVideo.av} alt=""/></div>
            <div className="vid-meta">
              <div className="vid-name">{openVideo.name}</div>
              <div className="vid-loc">📍 {openVideo.videoTag}</div>
            </div>
            <div className="vid-close" onClick={() => setOpenVideo(null)}>✕</div>
          </div>
          <div className="vid-media">
            <img src={img(openVideo.videoSeed, 800, 1200)} alt=""/>
            <div className="scanline"/>
            <div className="vid-duration">{elapsed}s / 20s</div>
            <div className="vid-prog-bar">
              <div className="vid-prog-fill" style={{width:`${vidProg}%`,transition:"width .1s linear"}}/>
            </div>
            <div className="vid-tag">📍 {openVideo.videoTag}</div>
            <div className="vid-match-badge" onClick={() => { setOpenVideo(null); setTab("discover"); }}>
              {openVideo.overlap}% match · Roam ✦
            </div>
          </div>
        </div>
      )}

      <div className="app">
        {/* NAV */}
        <nav className="nav">
          <div className="logo">roam<em>.</em><sub>adventure matching</sub></div>
          <div className="nav-tabs">
            {[["discover","🧭"],["upload","📸"],["matches","💬"]].map(([id,ic]) => (
              <button key={id} className={`ntab ${tab===id?"on":""}`} onClick={() => setTab(id)}>
                {ic} {id}
              </button>
            ))}
          </div>
        </nav>

        {/* STORIES RAIL */}
        <div className="stories">
          <div className="sv" onClick={() => {}}>
            <div className="sv-add"><div className="sv-add-icon">＋</div></div>
            <div className="sv-name" style={{color:"var(--c-electric)"}}>Your story</div>
          </div>
          {PEOPLE.map((p, i) => (
            <div className="sv" key={i} onClick={() => setOpenStory(i)}>
              <div className={`sv-ring ${seenStories.has(i) ? "seen" : ""} ${p.storyIsVideo ? "has-video" : ""}`}>
                <div className="sv-inner"><img src={p.av} alt={p.name}/></div>
              </div>
              <div className="sv-name">{p.name}</div>
            </div>
          ))}
        </div>

        {/* ── DISCOVER TAB ── */}
        {tab === "discover" && (
          <div>
            <div className="discover-wrap a1">
              <div className="match-card">
                {/* Hero */}
                <div className="card-hero">
                  <img src={img(profile.heroSeed)} alt={profile.name}/>
                  <div className="card-hero-grad"/>
                  {profile.hasVideo && (
                    <div className="card-video-badge">
                      <div className="cvb-dot"/>&nbsp;20s clip
                    </div>
                  )}
                  <div className="card-verified">
                    <div className="verified-dot"/>
                    {profile.overlap}% match
                  </div>
                  <div className="card-name-block">
                    <div className="card-name">{profile.name}<span className="card-age">{profile.age}</span></div>
                    <div className="card-tagline">"{profile.tagline}"</div>
                  </div>
                </div>

                {/* Strip */}
                <div className="card-strip">
                  {profile.stripSeeds.map((s, i) => (
                    <div key={i} className={`strip-cell ${s.isVideo ? "is-video" : ""}`}
                      onClick={() => s.isVideo && setOpenVideo(profile)}>
                      <img src={img(s.seed, 400, 300)} alt={s.tag}/>
                      {s.isVideo ? (
                        <>
                          <div className="strip-video-overlay">
                            <div className="strip-play">▶</div>
                          </div>
                          <div className="strip-video-dur">{s.duration}</div>
                        </>
                      ) : (
                        <div className="strip-tag">📍 {s.tag}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div className="card-body">
                  <div className="dna">
                    {profile.sharedTags.map(t => <span key={t} className="dtag shared">✓ {t}</span>)}
                    {profile.uniqueTags.map(t => <span key={t} className="dtag unique">{t}</span>)}
                  </div>

                  <div className="overlap">
                    <div className="overlap-head">
                      <span>Adventure DNA overlap</span>
                      <span className="overlap-pct">{fill}%</span>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{width:`${fill}%`}}/></div>
                  </div>

                  {profile.hasVideo && (
                    <div className="watch-clip" onClick={() => setOpenVideo(profile)}>
                      <div className="wc-icon">🎬</div>
                      <div className="wc-text">
                        <div className="wc-label">Watch {profile.name}'s 20s adventure clip</div>
                        <div className="wc-sub">📍 {profile.videoTag}</div>
                      </div>
                      <div className="wc-badge">▶ PLAY</div>
                    </div>
                  )}

                  {profile.almostMet && (
                    <div className="almost">
                      <em>⚡</em>
                      <div className="almost-text">
                        You were both at <strong>{profile.almostMet.where}</strong> in {profile.almostMet.when} — you nearly crossed paths.
                      </div>
                    </div>
                  )}

                  <div className="actions">
                    <button className="btn-pass" onClick={pass}>Pass</button>
                    <button className="btn-roam" onClick={() => setTab("matches")}>✦ Roam Together</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bucket list */}
            <div className="section a2">
              <div className="sec-label">🗺️ Bucket list matches</div>
              <div className="hscroll">
                {BUCKET.map((b, i) => (
                  <div className="bcard" key={i}>
                    <img src={img(b.seed, 240, 240)} alt={b.name}/>
                    <div className="bcard-ov">
                      <div className="bcard-name">{b.name}</div>
                      <div className="bcard-sub">{b.want}</div>
                    </div>
                    <div className="bcard-badge">{b.count}×</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOAD TAB ── */}
        {tab === "upload" && (
          <div style={{padding:"24px 16px"}}>
            <div className="a1" style={{fontFamily:"var(--f-display)",fontSize:28,fontWeight:900,marginBottom:8}}>
              Your <em style={{color:"var(--c-electric)",fontStyle:"italic"}}>adventure</em> story
            </div>
            <div className="a2" style={{fontSize:13,color:"var(--c-muted)",lineHeight:1.7,marginBottom:20}}>
              Photos AND 20-second clips. AI reads where you are and what you're doing — not just your face.
            </div>

            {/* Upload type cards */}
            {[
              {icon:"📸",title:"Photo",sub:"Up to 12 photos · AI auto-tagged",color:"var(--c-electric)"},
              {icon:"🎬",title:"20 Second Clip",sub:"Short adventure video · max 20s · AI location-tagged",color:"var(--c-ember)"},
            ].map((u,i) => (
              <div key={i} className="a2" style={{
                background:"var(--c-surface)",border:`1px solid ${u.color}30`,
                borderRadius:"var(--r-lg)",padding:"16px",marginBottom:12,
                display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"all .2s",
                animationDelay:`${i*.08}s`
              }}>
                <div style={{fontSize:32}}>{u.icon}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:15,marginBottom:3}}>{u.title}</div>
                  <div style={{fontFamily:"var(--f-mono)",fontSize:10,color:u.color,letterSpacing:".3px"}}>{u.sub}</div>
                </div>
                <div style={{marginLeft:"auto",background:u.color,color:"var(--c-bg)",fontFamily:"var(--f-mono)",fontSize:10,padding:"6px 12px",borderRadius:20,fontWeight:500}}>Add</div>
              </div>
            ))}

            {/* Rules */}
            <div className="a3" style={{background:"var(--c-surface)",border:"1px solid var(--c-border2)",borderRadius:"var(--r-md)",overflow:"hidden",marginTop:8}}>
              {[
                {ic:"🧗",t:"Photos or clips with YOU in them — always preferred",ok:true},
                {ic:"🎬",t:"Videos: must show real adventure, not a posed selfie video",ok:true},
                {ic:"🚫",t:"Clips over 20 seconds — hard trimmed to 20s",ok:false},
                {ic:"🚫",t:"Quote graphics, stock footage, AI-generated content",ok:false},
              ].map((r,i) => (
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:11,padding:"11px 14px",
                  borderBottom: i<3 ? "1px solid var(--c-border)" : "none",
                  fontSize:12,color: r.ok ? "rgba(242,237,227,.65)" : "rgba(232,98,26,.75)"
                }}>
                  <span style={{fontSize:16,flexShrink:0}}>{r.ic}</span>{r.t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MATCHES TAB ── */}
        {tab === "matches" && (
          <div>
            <div style={{padding:"24px 18px 10px"}} className="a1">
              <div style={{fontFamily:"var(--f-mono)",fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"var(--c-muted)",marginBottom:6}}>adventures aligned</div>
              <div style={{fontFamily:"var(--f-display)",fontSize:28,fontWeight:900,lineHeight:1.05}}>3 connections ✦</div>
            </div>
            <div className="match-list">
              {MATCHES.map((m,i) => (
                <div className="mrow a1" key={i} style={{animationDelay:`${i*.07}s`}}>
                  <div className="mrow-av"><img src={imgS(m.seed)} alt={m.name}/></div>
                  <div className="mrow-info">
                    <div className="mrow-name">{m.name}</div>
                    <div className="mrow-tags">{m.tags}</div>
                    {m.hasVideo && <div className="has-video-tag">🎬 20s clip posted</div>}
                    <div className="mrow-time">{m.when}</div>
                  </div>
                  <div className="mrow-pct">{m.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM NAV */}
        <div className="bottomnav">
          {[["🏠","discover","Discover"],["🧭","matches","Matches"],null,["🗺️","places","Places"],["👤","profile","Profile"]].map((item,i) => {
            if (!item) return <button key="post" className="bn-post" onClick={() => setTab("upload")}>＋</button>;
            const [ic,id,lb] = item;
            return (
              <button key={id} className={`bn ${tab===id?"on":""}`} onClick={() => setTab(id)}>
                <span className="bn-ic">{ic}</span>
                <span className="bn-lb">{lb}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
