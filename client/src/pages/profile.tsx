import AppNav from "@/components/app-nav";
import { MapPin, Camera, Mountain, Edit3, Settings, Star } from "lucide-react";

const PROFILE_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80&fit=crop", tags: ["rock climbing", "alpine"] },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=80&fit=crop", tags: ["hiking", "alpine trail"] },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80&fit=crop", tags: ["surfing", "ocean"] },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80&fit=crop", tags: ["night market", "street food"] },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&fit=crop", tags: ["mountain", "landscape"] },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80&fit=crop", tags: ["aerial", "coast"] },
];

const ADVENTURE_TAGS = ["climbing", "alpine hiking", "surfing", "night markets", "urban roaming", "kayaking", "forest trails", "coastal walks"];

export default function Profile() {
  return (
    <div className="min-h-screen relative" data-testid="page-profile">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-10">
          <div className="relative h-56 overflow-hidden" style={{ userSelect: "none" }}>
            <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80&fit=crop"
                 alt="Profile hero"
                 className="w-full h-full object-cover"
                 draggable={false}
                 onContextMenu={e => e.preventDefault()}
                 style={{ pointerEvents: "none" }} />
            <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,26,13,0.95) 0%, rgba(14,26,13,0.3) 50%, transparent 100%)" }} />

            <div className="absolute top-3 right-3 flex gap-2">
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg"
                      style={{ background: "rgba(14,26,13,0.6)", border: "1px solid rgba(242,237,227,0.15)" }}
                      data-testid="button-edit-profile">
                <Edit3 size={14} />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg"
                      style={{ background: "rgba(14,26,13,0.6)", border: "1px solid rgba(242,237,227,0.15)" }}
                      data-testid="button-settings">
                <Settings size={14} />
              </button>
            </div>

            <div className="absolute bottom-4 left-5">
              <h1 className="font-serif text-3xl font-black" data-testid="text-profile-name">You, 28</h1>
              <p className="text-[13px] italic mt-1" style={{ color: "rgba(242,237,227,0.65)" }}>
                "Chasing elevation and good coffee"
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} style={{ color: "var(--roam-sky)" }} />
                <span className="font-mono text-[10px]" style={{ color: "var(--roam-sky)" }}>Auckland, NZ</span>
              </div>
            </div>
          </div>

          <div className="px-4 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(242,237,227,0.35)" }}>
                  Your tier
                </span>
                <span className="font-mono text-[9px] tracking-wider uppercase py-0.5 px-2 rounded-lg"
                      style={{ background: "rgba(200,230,74,0.15)", color: "var(--roam-electric)" }}>
                  Adventurer
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <div className="text-center">
                  <div className="font-semibold" style={{ color: "var(--roam-electric)" }}>3</div>
                  <div className="text-[9px]" style={{ color: "rgba(242,237,227,0.35)" }}>matches</div>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(242,237,227,0.1)" }} />
                <div className="text-center">
                  <div className="font-semibold" style={{ color: "var(--roam-electric)" }}>6</div>
                  <div className="text-[9px]" style={{ color: "rgba(242,237,227,0.35)" }}>photos</div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(242,237,227,0.35)" }}>
                Adventure DNA
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ADVENTURE_TAGS.map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider"
                        style={{ background: "rgba(200,230,74,0.1)", border: "1px solid rgba(200,230,74,0.3)", color: "var(--roam-electric)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(242,237,227,0.35)" }}>
                Your photos
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PROFILE_PHOTOS.map((p, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden relative" style={{ userSelect: "none" }} data-testid={`profile-photo-${i}`}>
                    <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy"
                         draggable={false} onContextMenu={e => e.preventDefault()} style={{ pointerEvents: "none" }} />
                    <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 2).map(t => (
                          <span key={t} className="font-mono text-[7px] tracking-wider px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(14,26,13,0.85)", border: "1px solid rgba(200,230,74,0.25)", color: "var(--roam-electric)" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4"
                 style={{ background: "rgba(200,230,74,0.05)", border: "1px solid rgba(200,230,74,0.12)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} style={{ color: "var(--roam-electric)" }} />
                <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--roam-electric)" }}>Profile tip</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(242,237,227,0.5)" }}>
                Photos with you in them get 3x more matches. Add more adventure shots where you're visible — the AI
                prioritizes photos that show the real you in real places.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
