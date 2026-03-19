import { useState, useRef, useCallback } from "react";
import AppNav from "@/components/app-nav";
import { Mountain, Ban, ImageOff, Users, Check, AlertTriangle, UploadCloud, X, Camera, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const RULES = [
  { icon: Mountain, color: "var(--roam-electric)", text: "Photos with YOU in the adventure — strongly preferred" },
  { icon: Camera, color: "var(--roam-electric)", text: "Places, food, experiences in the wild — yes" },
  { icon: Ban, color: "var(--roam-ember)", text: "Quote graphics & text screenshots — auto-rejected" },
  { icon: ImageOff, color: "var(--roam-ember)", text: "AI-generated or heavily edited images — flagged" },
  { icon: Users, color: "var(--roam-ember)", text: "Generic stock / random landscapes (no you) — pushed down" },
];

const SCORE_DEMOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=300&q=80&fit=crop", label: "Person climbing", tags: ["rock climbing", "alpine"], verdict: "approved", personScore: 92, authScore: 95, adventureScore: 88 },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=300&q=80&fit=crop", label: "Hiker on trail", tags: ["hiking", "alpine trail"], verdict: "approved", personScore: 85, authScore: 90, adventureScore: 82 },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=300&q=80&fit=crop", label: "Person surfing", tags: ["surfing", "ocean"], verdict: "approved", personScore: 78, authScore: 92, adventureScore: 90 },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80&fit=crop", label: "Mountain only", tags: ["mountain", "landscape"], verdict: "needs_person", personScore: 8, authScore: 95, adventureScore: 75 },
];

interface UploadPhoto {
  id: string;
  previewUrl: string;
  file: File;
  caption: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

function ProtectedImage({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className="relative overflow-hidden" style={{ userSelect: "none" }}>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, pointerEvents: "none", WebkitUserDrag: "none" as any }}
        draggable={false}
        onContextMenu={e => e.preventDefault()}
      />
      <div className="absolute inset-0" style={{ background: "transparent", cursor: "default" }}
           onContextMenu={e => e.preventDefault()} />
    </div>
  );
}

export default function Upload() {
  const [photos, setPhotos] = useState<UploadPhoto[]>([]);
  const [demoSelected, setDemoSelected] = useState<typeof SCORE_DEMOS[0] | null>(null);
  const [demoAnalysing, setDemoAnalysing] = useState(false);
  const [demoResult, setDemoResult] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMeterColor = (val: number) => val >= 70 ? "var(--roam-electric)" : val >= 40 ? "#f59e0b" : "var(--roam-ember)";
  const getGradient = (val: number) => val >= 70 ? "linear-gradient(90deg, var(--roam-electric), #86efac)" : val >= 40 ? "#f59e0b" : "var(--roam-ember)";

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const newPhotos: UploadPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) continue;
      if (file.size > 12 * 1024 * 1024) continue;
      const previewUrl = URL.createObjectURL(file);
      newPhotos.push({ id: Math.random().toString(36).slice(2), previewUrl, file, caption: "", status: "pending" });
    }
    setPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  };

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const uploadAll = async () => {
    const pending = photos.filter(p => p.status === "pending");
    if (!pending.length) return;

    for (const photo of pending) {
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: "uploading" } : p));
      try {
        const dataUrl = await fileToDataUrl(photo.file);
        await apiRequest("POST", "/api/upload", {
          dataUrl,
          filename: photo.file.name,
          userId: "demo",
          caption: photo.caption,
          displayOrder: photos.indexOf(photo),
        });
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: "done" } : p));
      } catch (err: any) {
        const msg = err.message?.includes("413") ? "Too large (max 12 MB)" : err.message || "Upload failed";
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: "error", errorMsg: msg } : p));
      }
    }
  };

  const runDemoAnalysis = () => {
    if (!demoSelected) return;
    setDemoAnalysing(true);
    setDemoResult(false);
    setTimeout(() => { setDemoAnalysing(false); setDemoResult(true); }, 1800);
  };

  const hasPending = photos.some(p => p.status === "pending");

  return (
    <div className="min-h-screen relative" data-testid="page-upload">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-12">
          <div className="px-4.5 pt-6 animate-fade-up">
            <h1 className="font-serif text-[28px] font-black leading-[1.1]">
              Your <span className="italic" style={{ color: "var(--roam-electric)" }}>adventure</span><br />story
            </h1>
            <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Upload real photos from your travels and adventures. Our AI checks every photo before it goes live.
            </p>
          </div>

          <div className="mx-3.5 mt-4 rounded-2xl overflow-hidden animate-fade-up-1"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            {RULES.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3"
                   style={{ background: "rgba(255,255,255,0.02)", borderBottom: i < RULES.length - 1 ? "1px solid rgba(var(--roam-cream-rgb),0.05)" : "none" }}>
                <r.icon size={14} style={{ color: r.color, flexShrink: 0 }} />
                <span className="text-xs" style={{ color: r.color === "var(--roam-electric)" ? "rgba(var(--roam-cream-rgb),0.6)" : "rgba(232,98,26,0.85)" }}>
                  {r.text}
                </span>
              </div>
            ))}
          </div>

          <div className="px-3.5 mt-5 animate-fade-up-2">
            <div
              className="rounded-2xl transition-all"
              style={{
                background: dragOver ? "rgba(var(--roam-electric-rgb),0.08)" : "rgba(var(--roam-cream-rgb),0.02)",
                border: dragOver ? "2px dashed var(--roam-electric)" : "2px dashed rgba(var(--roam-cream-rgb),0.15)",
                padding: "24px 16px",
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              data-testid="drop-zone">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
                  <UploadCloud size={24} style={{ color: "var(--roam-electric)" }} />
                </div>
                <p className="text-sm font-medium mb-1">Drop photos here</p>
                <p className="text-xs mb-4" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>JPEG, PNG, WebP · max 12 MB each</p>
                <button
                  className="px-5 py-2.5 rounded-xl font-mono text-xs tracking-wider uppercase font-medium transition-all"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-files">
                  Choose photos
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                       multiple className="hidden" onChange={e => addFiles(e.target.files)} data-testid="input-files" />
              </div>
            </div>

            {photos.length > 0 && (
              <div className="mt-4 space-y-3">
                {photos.map((p, idx) => (
                  <div key={p.id} className="rounded-2xl overflow-hidden animate-fade-up"
                       style={{ background: "var(--roam-moss)", border: p.status === "error" ? "1px solid rgba(232,98,26,0.4)" : p.status === "done" ? "1px solid rgba(var(--roam-electric-rgb),0.25)" : "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                    <div className="flex gap-3 p-3">
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative"
                           style={{ userSelect: "none" }} onContextMenu={e => e.preventDefault()}>
                        <img src={p.previewUrl} alt="" className="w-full h-full object-cover"
                             draggable={false} style={{ pointerEvents: "none" }} />
                        {p.status === "uploading" && (
                          <div className="absolute inset-0 flex items-center justify-center"
                               style={{ background: "rgba(var(--roam-forest-rgb),0.7)" }}>
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full"
                                     style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
                              ))}
                            </div>
                          </div>
                        )}
                        {p.status === "done" && (
                          <div className="absolute inset-0 flex items-center justify-center"
                               style={{ background: "rgba(var(--roam-forest-rgb),0.5)" }}>
                            <Check size={22} style={{ color: "var(--roam-electric)" }} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs truncate font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                            {p.file.name}
                          </p>
                          {p.status !== "done" && (
                            <button onClick={() => removePhoto(p.id)}
                                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{ background: "rgba(232,98,26,0.15)" }}
                                    data-testid={`button-remove-${idx}`}>
                              <X size={12} style={{ color: "var(--roam-ember)" }} />
                            </button>
                          )}
                        </div>

                        {p.status === "error" && (
                          <div className="text-[11px] font-mono mt-1" style={{ color: "var(--roam-ember)" }}>
                            <AlertTriangle size={10} className="inline mr-1" />{p.errorMsg}
                          </div>
                        )}

                        {p.status === "done" && (
                          <div className="text-[11px] font-mono mt-1" style={{ color: "var(--roam-electric)" }}>
                            <Check size={10} className="inline mr-1" />Uploaded — AI screening in progress
                          </div>
                        )}

                        {(p.status === "pending" || p.status === "error") && (
                          <div className="mt-2">
                            <input className="w-full py-1.5 px-3 rounded-lg text-xs outline-none"
                                   style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}
                                   placeholder="Short caption — where was this? (optional)"
                                   value={p.caption}
                                   maxLength={80}
                                   onChange={e => updateCaption(p.id, e.target.value)}
                                   data-testid={`input-caption-${idx}`} />
                          </div>
                        )}

                        {p.status === "uploading" && (
                          <div className="text-[11px] font-mono mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                            Uploading…
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-2">
                  <button
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs tracking-wider uppercase transition-all"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1.5px dashed rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.45)" }}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-add-more">
                    <Plus size={14} /> Add more
                  </button>
                  <button
                    className="flex-1 py-2.5 rounded-xl font-mono text-xs tracking-wider uppercase font-medium transition-all disabled:opacity-40"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    disabled={!hasPending}
                    onClick={uploadAll}
                    data-testid="button-upload-all">
                    {hasPending ? `Upload ${photos.filter(p => p.status === "pending").length} photo${photos.filter(p => p.status === "pending").length !== 1 ? "s" : ""}` : "All uploaded ✓"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="px-3.5 mt-8">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              See how AI scoring works
            </div>
            <p className="text-xs mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              Tap a sample photo to see what the AI checks
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {SCORE_DEMOS.map((p, i) => (
                <div key={i}
                     className="aspect-square rounded-xl overflow-hidden relative cursor-pointer transition-all"
                     style={{
                       border: demoSelected?.url === p.url ? "2px solid var(--roam-electric)" : "2px solid transparent",
                     }}
                     onClick={() => { setDemoSelected(p); setDemoResult(false); setDemoAnalysing(false); }}
                     data-testid={`photo-demo-${i}`}>
                  <ProtectedImage src={p.url} alt={p.label} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 text-center font-mono text-[8px] py-1 px-1"
                       style={{ background: "rgba(var(--roam-forest-rgb),0.75)", color: "var(--roam-sand)" }}>
                    {p.label}
                  </div>
                </div>
              ))}
            </div>

            {demoSelected && (
              <button className="w-full mt-3 py-3 rounded-2xl font-mono text-xs tracking-wider uppercase font-medium transition-all disabled:opacity-40"
                      style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}
                      onClick={runDemoAnalysis}
                      disabled={demoAnalysing}
                      data-testid="button-analyse">
                {demoAnalysing ? "Analysing…" : `See AI score for "${demoSelected.label}"`}
              </button>
            )}

            {demoAnalysing && (
              <div className="mt-3 p-4 rounded-2xl flex items-center gap-3 animate-fade-up"
                   style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-[7px] h-[7px] rounded-full"
                         style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
                <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  Detecting people · checking authenticity · tagging adventures…
                </span>
              </div>
            )}

            {demoResult && demoSelected && (
              <div className="mt-3 rounded-[22px] overflow-hidden animate-fade-up mb-5"
                   style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.13)" }}>
                <div className="px-4 py-3 flex items-center gap-2.5"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.07)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                  <span className="font-mono text-[9px] font-medium tracking-[1px] uppercase py-0.5 px-2 rounded-lg"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>AI Verdict</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--roam-sand)" }}>
                    {demoSelected.verdict.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <div className="p-4">
                  <div className="rounded-xl p-3 mb-3.5 flex items-start gap-2.5 text-xs leading-relaxed"
                       style={{
                         background: demoSelected.verdict === "approved" ? "rgba(var(--roam-electric-rgb),0.08)" : "rgba(245,158,11,0.08)",
                         border: `1px solid ${demoSelected.verdict === "approved" ? "rgba(var(--roam-electric-rgb),0.25)" : "rgba(245,158,11,0.25)"}`,
                         color: "rgba(var(--roam-cream-rgb),0.8)",
                       }}
                       data-testid="text-verdict">
                    {demoSelected.verdict === "approved"
                      ? <Check size={17} className="flex-shrink-0 mt-0.5" style={{ color: "var(--roam-electric)" }} />
                      : <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />}
                    <span>
                      {demoSelected.verdict === "approved"
                        ? "Real person in an authentic adventure setting. Approved."
                        : "Beautiful landscape, but no person detected. Photos with you get prioritised in matching."}
                    </span>
                  </div>

                  <div className="space-y-2.5 mb-3.5">
                    {[
                      { label: "Person detected", val: demoSelected.personScore },
                      { label: "Authenticity", val: demoSelected.authScore },
                      { label: "Adventure relevance", val: demoSelected.adventureScore },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="flex justify-between mb-1.5 font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                          <span>{m.label}</span>
                          <span className="font-medium" style={{ color: getMeterColor(m.val) }}>{m.val}%</span>
                        </div>
                        <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-sm transition-all duration-1000"
                               style={{ width: `${m.val}%`, background: getGradient(m.val) }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="font-mono text-[9px] tracking-[1.2px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>Auto-tagged as</div>
                  <div className="flex flex-wrap gap-1.5">
                    {demoSelected.tags.map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-lg text-[10px] font-mono tracking-wider"
                            style={{ background: "rgba(var(--roam-sky-rgb),0.1)", border: "1px solid rgba(var(--roam-sky-rgb),0.3)", color: "var(--roam-sky)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
