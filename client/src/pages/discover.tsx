import { useState } from "react";
import AppNav from "@/components/app-nav";

const DEMO_PROFILES = [
  {
    id: "1",
    name: "Mia", age: 28,
    ethnicity: "New Zealander",
    tagline: "Chasing elevation, good coffee and anything with a summit",
    hero: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop",
  },
  {
    id: "2",
    name: "Kai", age: 31,
    ethnicity: "Māori",
    tagline: "Lost in alleyways, found in barrels",
    hero: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop",
  },
  {
    id: "3",
    name: "Sam", age: 26,
    ethnicity: "Pacific Islander",
    tagline: "Every forest has a path worth getting lost on",
    hero: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop",
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
  const [animKey, setAnimKey] = useState(0);

  const profile = DEMO_PROFILES[profileIdx % DEMO_PROFILES.length];

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
              <div className="relative h-[380px] overflow-hidden" style={{ userSelect: "none" }}>
                <img src={profile.hero} alt={profile.name} className="w-full h-full object-cover transition-transform duration-[6s] ease-out hover:scale-[1.04]"
                     draggable={false} onContextMenu={e => e.preventDefault()} style={{ pointerEvents: "none" }} />
                <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,26,13,0.97) 0%, rgba(14,26,13,0.45) 55%, transparent 100%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-baseline gap-2.5 mb-1">
                    <h2 className="font-serif text-[34px] font-black leading-none tracking-tight" data-testid={`text-name-${profile.id}`}>
                      {profile.name}
                    </h2>
                    <span className="font-serif text-[22px] font-light" style={{ color: "var(--roam-sand)" }}>{profile.age}</span>
                  </div>
                  <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3"
                        style={{ background: "rgba(200,230,74,0.12)", border: "1px solid rgba(200,230,74,0.35)", color: "var(--roam-electric)" }}
                        data-testid={`text-ethnicity-${profile.id}`}>
                    {profile.ethnicity}
                  </span>
                  <p className="text-[13px] italic leading-snug" style={{ color: "rgba(242,237,227,0.7)" }}>"{profile.tagline}"</p>
                </div>
              </div>

              <div className="p-4 pt-4">
                <div className="flex gap-2.5">
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
