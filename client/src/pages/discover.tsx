import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AppNav from "@/components/app-nav";
import type { User, Photo, Match } from "@shared/schema";

const DEMO_PROFILES = [
  {
    id: "1",
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
  },
  {
    id: "2",
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
  },
  {
    id: "3",
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
  },
];

const BUCKET_LIST = [
  { name: "Faroe Islands", want: "3 matches want this", url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&q=80&fit=crop", count: 3 },
  { name: "Patagonia", want: "7 matches want this", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=80&fit=crop", count: 7 },
  { name: "Kyoto autumn", want: "12 matches want this", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300&q=80&fit=crop", count: 12 },
  { name: "Iceland", want: "5 matches want this", url: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=300&q=80&fit=crop", count: 5 },
  { name: "Lofoten", want: "2 matches want this", url: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=300&q=80&fit=crop", count: 2 },
];

export default function Discover() {
  const [profileIdx, setProfileIdx] = useState(0);
  const [fill, setFill] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const profile = DEMO_PROFILES[profileIdx % DEMO_PROFILES.length];

  useEffect(() => {
    setFill(0);
    const t = setTimeout(() => setFill(profile.overlap), 350);
    return () => clearTimeout(t);
  }, [profileIdx]);

  const handlePass = () => {
    setAnimKey(k => k + 1);
    setProfileIdx(i => i + 1);
  };

  return (
    <div className="min-h-screen relative" data-testid="page-discover">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-8">
          <div key={animKey} className="animate-fade-up">
            <div className="mx-3.5 mt-4 rounded-[28px] overflow-hidden"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(242,237,227,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
              <div className="relative h-[310px] overflow-hidden" style={{ userSelect: "none" }}>
                <img src={profile.hero} alt={profile.name} className="w-full h-full object-cover transition-transform duration-[6s] ease-out hover:scale-[1.04]"
                     draggable={false} onContextMenu={e => e.preventDefault()} style={{ pointerEvents: "none" }} />
                <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,26,13,0.95) 0%, rgba(14,26,13,0.3) 50%, transparent 100%)" }} />
                <div className="absolute top-3.5 left-3.5 backdrop-blur-lg rounded-full flex items-center gap-1.5 px-2.5 py-1"
                     style={{ background: "rgba(14,26,13,0.78)", border: "1px solid rgba(200,230,74,0.35)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--roam-electric)", animation: "pulse-dot 2s infinite" }} />
                  <span className="font-mono text-[9px] tracking-wider" style={{ color: "var(--roam-electric)" }}>{profile.heroBadge}</span>
                </div>
                <div className="absolute bottom-4 left-4.5 right-4.5">
                  <h2 className="font-serif text-[30px] font-black leading-none tracking-tight" data-testid={`text-name-${profile.id}`}>
                    {profile.name} <span className="text-xl font-light" style={{ color: "var(--roam-sand)" }}>{profile.age}</span>
                  </h2>
                  <p className="text-[13px] italic mt-1" style={{ color: "rgba(242,237,227,0.65)" }}>"{profile.tagline}"</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-[3px] mx-[3px]">
                {profile.strip.map((p, i) => (
                  <div key={i} className="relative h-[105px] overflow-hidden cursor-pointer group" style={{ userSelect: "none" }}>
                    <img src={p.url} alt={p.tag} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.08]"
                         draggable={false} onContextMenu={e => e.preventDefault()} style={{ pointerEvents: "none" }} />
                    <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                    <div className="absolute bottom-1.5 left-1.5 backdrop-blur-lg rounded-lg px-1.5 py-0.5 font-mono text-[8px] tracking-wider"
                         style={{ background: "rgba(14,26,13,0.82)", border: "1px solid rgba(200,230,74,0.25)", color: "var(--roam-electric)" }}>
                      {p.tag}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 pt-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {profile.sharedTags.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider flex items-center gap-1"
                          style={{ background: "rgba(200,230,74,0.1)", border: "1px solid rgba(200,230,74,0.45)", color: "var(--roam-electric)" }}
                          data-testid={`tag-shared-${t}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      {t}
                    </span>
                  ))}
                  {profile.uniqueTags.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider"
                          style={{ background: "rgba(125,184,212,0.07)", border: "1px solid rgba(125,184,212,0.3)", color: "var(--roam-sky)" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(242,237,227,0.06)" }}>
                  <div className="flex justify-between items-center font-mono text-[10px] tracking-wider uppercase mb-2" style={{ color: "rgba(242,237,227,0.38)" }}>
                    <span>Adventure DNA overlap</span>
                    <span className="text-[15px] font-medium" style={{ color: "var(--roam-electric)" }} data-testid="text-overlap">{fill}%</span>
                  </div>
                  <div className="h-[5px] rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-sm transition-all duration-[1.1s]"
                         style={{ width: `${fill}%`, background: "linear-gradient(90deg, var(--roam-electric), var(--roam-sky))" }} />
                  </div>
                </div>

                {profile.almostMet && (
                  <div className="rounded-xl p-3 mb-3 flex items-start gap-2"
                       style={{ background: "rgba(232,98,26,0.09)", border: "1px solid rgba(232,98,26,0.28)" }}
                       data-testid="alert-almost-met">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--roam-ember)" strokeWidth="2" className="flex-shrink-0 mt-0.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(242,237,227,0.72)" }}>
                      You were both at <strong style={{ color: "var(--roam-ember)" }}>{profile.almostMet.where}</strong> in {profile.almostMet.when} — you nearly crossed paths.
                    </p>
                  </div>
                )}

                <div className="flex gap-2.5 mt-3.5">
                  <button className="flex-1 py-3.5 rounded-2xl font-mono text-[11px] tracking-wider uppercase transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(242,237,227,0.5)" }}
                          onClick={handlePass}
                          data-testid="button-pass">
                    Pass
                  </button>
                  <button className="flex-[2.2] py-3.5 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5"
                          style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                          data-testid="button-roam">
                    Roam Together
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 px-3.5 animate-fade-up-1">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(242,237,227,0.35)" }}>
              Bucket list matches near you
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {BUCKET_LIST.map((b, i) => (
                <div key={i} className="flex-shrink-0 w-[120px] rounded-2xl overflow-hidden relative cursor-pointer"
                     style={{ border: "1px solid rgba(242,237,227,0.07)" }}
                     data-testid={`bucket-${b.name}`}>
                  <img src={b.url} alt={b.name} className="w-[120px] h-[120px] object-cover" loading="lazy" />
                  <div className="absolute inset-0 flex flex-col justify-end p-2"
                       style={{ background: "linear-gradient(to top, rgba(14,26,13,0.9) 0%, transparent 55%)" }}>
                    <div className="text-[11px] font-semibold leading-tight">{b.name}</div>
                    <div className="font-mono text-[9px] mt-0.5" style={{ color: "var(--roam-sky)" }}>{b.want}</div>
                  </div>
                  <div className="absolute top-1.5 right-1.5 font-mono text-[8px] font-medium px-1.5 py-0.5 rounded-lg"
                       style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                    {b.count}x
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
