import { useState } from "react";
import AppNav from "@/components/app-nav";
import { Shield, Mountain, MapPin, Ban, ImageOff, Users, Check, AlertTriangle } from "lucide-react";

const DEMO_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=300&q=80&fit=crop", label: "Person climbing", tags: ["rock climbing", "alpine"], verdict: "approved", personScore: 92, authScore: 95, adventureScore: 88 },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=300&q=80&fit=crop", label: "Hiker on trail", tags: ["hiking", "alpine trail"], verdict: "approved", personScore: 85, authScore: 90, adventureScore: 82 },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=300&q=80&fit=crop", label: "Person surfing", tags: ["surfing", "ocean"], verdict: "approved", personScore: 78, authScore: 92, adventureScore: 90 },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80&fit=crop", label: "Mountain only", tags: ["mountain", "landscape"], verdict: "needs_person", personScore: 8, authScore: 95, adventureScore: 75 },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300&q=80&fit=crop", label: "Night market", tags: ["night market", "street food"], verdict: "approved", personScore: 45, authScore: 88, adventureScore: 72 },
];

type SelectedPhoto = typeof DEMO_PHOTOS[number] | null;

export default function Upload() {
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto>(null);
  const [analysing, setAnalysing] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const runAnalysis = () => {
    if (!selectedPhoto) return;
    setAnalysing(true);
    setShowResult(false);
    setTimeout(() => {
      setAnalysing(false);
      setShowResult(true);
    }, 1800);
  };

  const getMeterClass = (val: number) => val >= 70 ? "good" : val >= 40 ? "warn" : "bad";
  const getMeterColor = (cls: string) => cls === "good" ? "var(--roam-electric)" : cls === "warn" ? "#f59e0b" : "var(--roam-ember)";
  const getGradient = (cls: string) => cls === "good" ? "linear-gradient(90deg, var(--roam-electric), #86efac)" : cls === "warn" ? "#f59e0b" : "var(--roam-ember)";

  return (
    <div className="min-h-screen relative" data-testid="page-upload">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-10">
          <div className="px-4.5 pt-6 animate-fade-up">
            <h1 className="font-serif text-[30px] font-black leading-[1.1]">
              Your <span className="italic" style={{ color: "var(--roam-electric)" }}>adventure</span><br />story
            </h1>
            <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(242,237,227,0.38)" }}>
              Post where you've been. Our AI reads places and people — not just your face. Tap a photo below to see live AI screening.
            </p>
          </div>

          <div className="mx-3.5 mt-4 rounded-2xl overflow-hidden animate-fade-up-1"
               style={{ border: "1px solid rgba(242,237,227,0.07)" }}>
            <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(242,237,227,0.05)" }}>
              <Mountain size={16} style={{ color: "var(--roam-electric)" }} />
              <span className="text-xs" style={{ color: "rgba(242,237,227,0.6)" }}>Photos with YOU in the adventure — strongly preferred</span>
            </div>
            <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(242,237,227,0.05)" }}>
              <MapPin size={16} style={{ color: "var(--roam-electric)" }} />
              <span className="text-xs" style={{ color: "rgba(242,237,227,0.6)" }}>Places, food, experiences — yes</span>
            </div>
            <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(242,237,227,0.05)" }}>
              <Ban size={14} style={{ color: "rgba(232,98,26,0.75)" }} />
              <span className="text-xs" style={{ color: "rgba(232,98,26,0.75)" }}>Quote graphics & text screenshots — auto-rejected</span>
            </div>
            <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(242,237,227,0.05)" }}>
              <ImageOff size={14} style={{ color: "rgba(232,98,26,0.75)" }} />
              <span className="text-xs" style={{ color: "rgba(232,98,26,0.75)" }}>AI-generated or heavily edited images — flagged</span>
            </div>
            <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.025)" }}>
              <Users size={14} style={{ color: "rgba(232,98,26,0.75)" }} />
              <span className="text-xs" style={{ color: "rgba(232,98,26,0.75)" }}>Generic stock / random landscapes (no you) — pushed down</span>
            </div>
          </div>

          <div className="mt-5 px-3.5 animate-fade-up-2">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(242,237,227,0.35)" }}>
              Live AI photo screener — tap to test
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_PHOTOS.map((p, i) => (
                <div key={i}
                     className="aspect-square rounded-xl overflow-hidden relative cursor-pointer transition-all"
                     style={{
                       border: selectedPhoto?.url === p.url ? "2px solid var(--roam-electric)" : "2px solid transparent",
                       boxShadow: selectedPhoto?.url === p.url ? "0 0 0 1px var(--roam-electric)" : "none",
                     }}
                     onClick={() => { setSelectedPhoto(p); setShowResult(false); setAnalysing(false); }}
                     data-testid={`photo-test-${i}`}>
                  <img src={p.url} alt={p.label} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 text-center font-mono text-[9px] tracking-wider"
                       style={{ background: "rgba(14,26,13,0.7)", color: "var(--roam-sand)" }}>
                    {p.label}
                  </div>
                </div>
              ))}
              <div className="aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                   style={{ border: "1.5px dashed rgba(242,237,227,0.15)", background: "rgba(242,237,227,0.02)" }}
                   data-testid="button-add-photo">
                <span className="text-xl opacity-30">+</span>
                <span className="font-mono text-[10px] mt-1" style={{ color: "rgba(242,237,227,0.3)" }}>add photo</span>
              </div>
            </div>
          </div>

          <div className="px-3.5 mt-3">
            <button className="w-full py-3.5 rounded-2xl font-mono text-xs tracking-wider uppercase font-medium transition-all disabled:opacity-40"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    onClick={runAnalysis}
                    disabled={!selectedPhoto || analysing}
                    data-testid="button-analyse">
              {analysing ? "analysing..." : selectedPhoto ? `Analyse "${selectedPhoto.label}"` : "select a photo above"}
            </button>
          </div>

          {analysing && (
            <div className="mx-3.5 mt-3.5 p-4 rounded-2xl flex items-center gap-3 animate-fade-up"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(242,237,227,0.07)" }}>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-[7px] h-[7px] rounded-full"
                       style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
                ))}
              </div>
              <span className="font-mono text-[11px] tracking-wider" style={{ color: "rgba(242,237,227,0.38)" }}>
                AI is reading the photo — detecting people, checking authenticity, tagging adventures...
              </span>
            </div>
          )}

          {showResult && selectedPhoto && (
            <div className="mx-3.5 mt-3.5 rounded-[22px] overflow-hidden animate-fade-up mb-5"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(242,237,227,0.13)" }}>
              <div className="px-4 py-3 flex items-center gap-2.5"
                   style={{ background: "rgba(200,230,74,0.07)", borderBottom: "1px solid rgba(242,237,227,0.07)" }}>
                <span className="font-mono text-[9px] font-medium tracking-[1px] uppercase py-0.5 px-2 rounded-lg"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                  AI Verdict
                </span>
                <span className="font-mono text-[11px] tracking-wider" style={{ color: "var(--roam-sand)" }}>
                  {selectedPhoto.verdict.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <div className="p-4">
                <div className="rounded-xl p-3 mb-3.5 flex items-start gap-2.5 text-xs leading-relaxed"
                     style={{
                       background: selectedPhoto.verdict === "approved" ? "rgba(200,230,74,0.08)" : selectedPhoto.verdict === "needs_person" ? "rgba(245,158,11,0.08)" : "rgba(232,98,26,0.08)",
                       border: `1px solid ${selectedPhoto.verdict === "approved" ? "rgba(200,230,74,0.25)" : selectedPhoto.verdict === "needs_person" ? "rgba(245,158,11,0.25)" : "rgba(232,98,26,0.25)"}`,
                       color: "rgba(242,237,227,0.8)",
                     }}
                     data-testid="text-verdict">
                  {selectedPhoto.verdict === "approved" ? (
                    <Check size={17} className="flex-shrink-0 mt-0.5" style={{ color: "var(--roam-electric)" }} />
                  ) : (
                    <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" style={{ color: selectedPhoto.verdict === "needs_person" ? "#f59e0b" : "var(--roam-ember)" }} />
                  )}
                  <span>
                    {selectedPhoto.verdict === "approved"
                      ? "This photo shows a real person in an authentic adventure setting. Approved for your profile."
                      : selectedPhoto.verdict === "needs_person"
                      ? "Beautiful landscape, but no person detected. Photos with you in them get prioritized in matching."
                      : "This photo has been flagged for review."}
                  </span>
                </div>

                <div className="space-y-2.5 mb-3.5">
                  {[
                    { label: "Person detected", val: selectedPhoto.personScore },
                    { label: "Authenticity", val: selectedPhoto.authScore },
                    { label: "Adventure relevance", val: selectedPhoto.adventureScore },
                  ].map(m => {
                    const cls = getMeterClass(m.val);
                    return (
                      <div key={m.label}>
                        <div className="flex justify-between mb-1.5 font-mono text-[10px] tracking-wider" style={{ color: "rgba(242,237,227,0.38)" }}>
                          <span>{m.label}</span>
                          <span className="font-medium" style={{ color: getMeterColor(cls) }}>{m.val}%</span>
                        </div>
                        <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-sm transition-all duration-1000" style={{ width: `${m.val}%`, background: getGradient(cls) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedPhoto.tags.length > 0 && (
                  <>
                    <div className="font-mono text-[9px] tracking-[1.2px] uppercase mb-2" style={{ color: "rgba(242,237,227,0.38)" }}>Auto-tagged as</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPhoto.tags.map(t => (
                        <span key={t} className="px-2.5 py-1 rounded-lg text-[10px] font-mono tracking-wider"
                              style={{ background: "rgba(125,184,212,0.1)", border: "1px solid rgba(125,184,212,0.3)", color: "var(--roam-sky)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
