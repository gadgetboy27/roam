import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Camera, Edit3, Settings, Star, X, Check, Bell, Shield, LogOut, ChevronRight, Plus, Upload, Loader2 } from "lucide-react";
import { computeVibeWord } from "@/lib/fingerprint";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80&fit=crop";

const PROFILE_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80&fit=crop", tags: ["rock climbing", "alpine"] },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=80&fit=crop", tags: ["hiking", "alpine trail"] },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80&fit=crop", tags: ["surfing", "ocean"] },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80&fit=crop", tags: ["night market", "street food"] },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&fit=crop", tags: ["mountain", "landscape"] },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80&fit=crop", tags: ["aerial", "coast"] },
];

const ALL_DNA_TAGS = [
  // water
  "surfing", "kayaking", "scuba diving", "free diving", "kitesurfing",
  "stand up paddle", "boating / fishing", "wild swimming", "coastal walks",
  // mountain & vertical
  "rock climbing", "alpine hiking", "bouldering", "canyoning", "via ferrata",
  "mountain biking", "skiing", "snowboarding", "paragliding",
  // trail & land
  "trail running", "forest trails", "backpacking", "camping & bushcraft",
  "cycling", "horse riding", "slacklining",
  // extreme
  "skydiving", "bungee jumping", "extreme sports", "caving",
  // urban & social
  "skateboarding", "urban roaming", "night markets", "food & wine trails",
  "pub games", "couch surfing",
  // fitness
  "gym / fitness", "crossfit", "yoga / wellness", "martial arts",
  "dance / movement", "swimming",
  // sports (grouped)
  "team sports", "field sports", "racquet sports",
  // indoor & creative
  "geocaching", "chess", "board games", "escape rooms", "photography",
  "cooking / food", "music", "art & galleries", "astronomy",
  // nature
  "foraging", "wildlife watching",
];

const inputStyle: React.CSSProperties = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-overlay">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative rounded-t-[28px] max-h-[90vh] overflow-y-auto"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-4"
             style={{ background: "var(--roam-surface)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
          <h2 className="font-serif text-xl font-black">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }} data-testid="button-close-sheet">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showYearCard, setShowYearCard] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySubmitted, setVerifySubmitted] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setVerifySubmitted(true);
      window.history.replaceState({}, "", "/profile");
      refresh();
    }
  }, []);

  useEffect(() => {
    if (!user?.identityVerificationId || user?.identityVerified) return;
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      await refresh();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.identityVerificationId, user?.identityVerified]);

  const handleStartVerification = async () => {
    if (!user) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await apiRequest("POST", "/api/verify/start");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setVerifyError("Could not start verification. Please try again.");
      }
    } catch (err: any) {
      setVerifyError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const calcAge = (dob: string | null) => {
    if (!dob) return "—";
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return String(age);
  };

  const [profileData, setProfileData] = useState({
    name: user?.name || "You",
    age: calcAge(user?.dob ?? null),
    tagline: user?.tagline || "Chasing elevation and good coffee",
    location: user?.location || "Auckland, NZ",
    dna: user?.adventureTags?.length ? user.adventureTags : ["alpine hiking", "surfing", "night markets", "kayaking", "coastal walks"],
    avatarUrl: user?.avatarUrl || FALLBACK_HERO,
  });

  const [editForm, setEditForm] = useState({ ...profileData });
  const [notifications, setNotifications] = useState({ matches: true, messages: true, bucketList: false });

  const openEdit = () => { setEditForm({ ...profileData }); setSaveError(""); setEditOpen(true); };

  const saveEdit = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError("");
    try {
      await apiRequest("PATCH", `/api/users/${user.id}`, {
        name: editForm.name,
        tagline: editForm.tagline,
        location: editForm.location,
        avatarUrl: editForm.avatarUrl,
        adventureTags: editForm.dna,
      });
      await refresh();
      setProfileData({ ...editForm });
      setEditOpen(false);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDnaTag = (tag: string) => {
    setEditForm(f => ({
      ...f,
      dna: f.dna.includes(tag) ? f.dna.filter(t => t !== tag) : [...f.dna, tag],
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setEditForm(f => ({ ...f, avatarUrl: dataUrl }));
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="min-h-screen relative" data-testid="page-profile">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-32">
          <div className="relative h-56 overflow-hidden" style={{ userSelect: "none" }}
               onContextMenu={e => e.preventDefault()}>
            <img src={profileData.avatarUrl || FALLBACK_HERO}
                 alt="Profile hero"
                 className="w-full h-full object-cover"
                 draggable={false}
                 style={{ pointerEvents: "none" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.28) 50%, transparent 100%)", pointerEvents: "none" }} />

            <div className="absolute top-3 right-3 flex gap-2">
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg transition-all hover:scale-105"
                      style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)" }}
                      onClick={openEdit}
                      data-testid="button-edit-profile">
                <Edit3 size={14} />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg transition-all hover:scale-105"
                      style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)" }}
                      onClick={() => setSettingsOpen(true)}
                      data-testid="button-settings">
                <Settings size={14} />
              </button>
            </div>

            <div className="absolute bottom-4 left-5">
              <h1 className="font-serif text-3xl font-black" style={{ color: "rgba(255,255,255,0.96)" }} data-testid="text-profile-name">{profileData.name}, {profileData.age}</h1>
              <p className="text-[13px] italic mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                "{profileData.tagline}"
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} style={{ color: "var(--roam-sky)" }} />
                <span className="font-mono text-[10px]" style={{ color: "var(--roam-sky)" }} data-testid="text-location">{profileData.location}</span>
              </div>
            </div>
          </div>

          <div className="px-4 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  Your tier
                </span>
                <span className="font-mono text-[9px] tracking-wider uppercase py-0.5 px-2 rounded-lg"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
                  Adventurer
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <div className="text-center">
                  <div className="font-semibold" style={{ color: "var(--roam-electric)" }}>3</div>
                  <div className="text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>matches</div>
                </div>
                <div className="w-px h-6" style={{ background: "rgba(var(--roam-cream-rgb),0.12)" }} />
                <div className="text-center">
                  <div className="font-semibold" style={{ color: "var(--roam-electric)" }}>6</div>
                  <div className="text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>photos</div>
                </div>
              </div>
            </div>

            {(() => {
              const vibeWord = computeVibeWord(profileData.dna);
              return (
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
                       data-testid="badge-vibe-word">
                    <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Vibe</span>
                    <span className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>{vibeWord}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.35)" }}
                       data-testid="badge-verified-user">
                    <span className="font-mono text-[11px] font-bold" style={{ color: "var(--roam-electric)" }}>✓</span>
                    <span className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>Verified User</span>
                  </div>
                </div>
              );
            })()}

            <div className="mb-5 rounded-2xl overflow-hidden"
                 id="verified"
                 data-testid="section-verified-user"
                 style={{ border: user?.identityVerified ? "1px solid rgba(var(--roam-electric-rgb),0.35)" : "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>

              {user?.identityVerified ? (
                <div className="px-4 py-4 flex items-start gap-3"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.18)", border: "1px solid rgba(var(--roam-electric-rgb),0.45)" }}>
                    <span className="font-mono text-[16px] font-bold" style={{ color: "var(--roam-electric)" }}>✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-[11px] tracking-wider font-semibold mb-1" style={{ color: "var(--roam-electric)" }}>
                      Identity Verified
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                      Government-issued ID + selfie confirmed. The ✓ means you're a real person — not a judgement of your adventures.
                    </div>
                    {user.identityVerifiedAt && (
                      <div className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                        Verified {new Date(user.identityVerifiedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    )}
                  </div>
                </div>
              ) : user?.identityVerificationId && !user?.identityVerified ? (
                <div className="px-4 py-4 flex items-start gap-3"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.03)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 animate-spin"
                       style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.2)", borderTopColor: "var(--roam-electric)" }}>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] tracking-wider font-semibold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                      Verification in progress
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                      We're confirming your identity. This usually takes less than a minute.
                    </div>
                  </div>
                </div>
              ) : verifySubmitted ? (
                <div className="px-4 py-4 flex items-start gap-3"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.04)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                    <span style={{ fontSize: "16px" }}>⏳</span>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] tracking-wider font-semibold mb-1" style={{ color: "var(--roam-electric)" }}>
                      Verification submitted
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                      Your documents are being reviewed. You'll get your ✓ badge shortly — usually under a minute.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
                  <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }}>
                      <Shield size={16} style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-[11px] tracking-wider font-semibold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                        Verify your identity
                      </div>
                      <div className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.42)" }}>
                        Takes 2 minutes. Upload a government ID + selfie. Your documents go directly to Stripe's secure servers — we never see or store them.
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {["Driver's licence", "Passport", "Selfie liveness check"].map(item => (
                          <span key={item} className="font-mono text-[8px] tracking-wider px-2 py-0.5 rounded-lg"
                                style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                            {item}
                          </span>
                        ))}
                      </div>
                      {verifyError && (
                        <div className="font-mono text-[10px] mb-2" style={{ color: "var(--roam-ember)" }}>
                          {verifyError}
                        </div>
                      )}
                      <button
                        className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase font-semibold px-4 py-2.5 rounded-xl transition-all"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", opacity: verifying ? 0.7 : 1 }}
                        onClick={handleStartVerification}
                        disabled={verifying}
                        data-testid="button-start-verification">
                        {verifying ? (
                          <><Loader2 size={11} className="animate-spin" /> Starting…</>
                        ) : (
                          <><Shield size={11} /> Get Verified</>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 flex items-center gap-2"
                       style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)", background: "rgba(var(--roam-cream-rgb),0.02)" }}>
                    <span className="font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                      Powered by Stripe Identity · Documents never stored on roam. servers
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Adventure DNA
                </div>
                <button className="flex items-center gap-1 font-mono text-[9px] tracking-wider uppercase py-1 px-2.5 rounded-lg transition-all"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                        onClick={openEdit}
                        data-testid="button-edit-dna">
                  <Plus size={10} /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="dna-tags">
                {profileData.dna.map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                Your photos
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PROFILE_PHOTOS.map((p, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden relative" style={{ userSelect: "none" }}
                       onContextMenu={e => e.preventDefault()} data-testid={`profile-photo-${i}`}>
                    <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy"
                         draggable={false} style={{ pointerEvents: "none" }} />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 2).map(t => (
                          <span key={t} className="font-mono text-[7px] tracking-wider px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(var(--roam-forest-rgb),0.85)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}>
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
                 style={{ background: "rgba(var(--roam-electric-rgb),0.05)", border: "1px solid rgba(var(--roam-electric-rgb),0.12)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} style={{ color: "var(--roam-electric)" }} />
                <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--roam-electric)" }}>Profile tip</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                Photos with you in them get 3x more matches. Add more adventure shots where you're visible — the AI
                prioritizes photos that show the real you in real places.
              </p>
            </div>

            <button
              className="w-full flex items-center gap-3.5 p-4 rounded-2xl mt-4 text-left transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, rgba(var(--roam-electric-rgb),0.08), rgba(var(--roam-sky-rgb),0.06))", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
              onClick={() => setShowYearCard(true)}
              data-testid="button-year-in-adventure">
              <span style={{ fontSize: "26px" }}>🌍</span>
              <div className="flex-1">
                <div className="font-semibold text-[14px] mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.9)" }}>Your 2025 in Adventure</div>
                <div className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>47 adventures · 12 locations · 3 matches</div>
              </div>
              <div className="font-mono text-[10px] font-medium px-3 py-1.5 rounded-xl flex-shrink-0"
                   style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                View &amp; Share
              </div>
            </button>
          </div>
        </div>
      </div>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Profile photo
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <img src={editForm.avatarUrl || FALLBACK_HERO} alt="Avatar preview"
                     className="w-full h-full object-cover" />
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                     onChange={handleAvatarChange} data-testid="input-avatar-file" />
              <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-[12px] font-mono tracking-wider"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      data-testid="button-upload-avatar">
                {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Name
              </label>
              <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                     value={editForm.name}
                     onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                     data-testid="input-edit-name" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Age
              </label>
              <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none"
                     style={{ ...inputStyle, opacity: 0.5 }}
                     value={editForm.age} type="number" min="18" max="99" disabled
                     data-testid="input-edit-age" />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Tagline
            </label>
            <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                   value={editForm.tagline} maxLength={60}
                   placeholder="e.g. Chasing summits and night markets"
                   onChange={e => setEditForm(f => ({ ...f, tagline: e.target.value }))}
                   data-testid="input-edit-tagline" />
            <p className="text-[10px] font-mono mt-1 text-right" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              {60 - editForm.tagline.length} left
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Base location
            </label>
            <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                   value={editForm.location}
                   placeholder="e.g. Auckland, NZ"
                   onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                   data-testid="input-edit-location" />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Adventure DNA — tap to select your activities
            </label>
            <p className="text-[11px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              These are also auto-detected from your photos. Your manual picks always show first.
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="dna-selector">
              {ALL_DNA_TAGS.map(tag => {
                const active = editForm.dna.includes(tag);
                return (
                  <button key={tag}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider transition-all"
                          style={{
                            background: active ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.04)",
                            border: active ? "1px solid rgba(var(--roam-electric-rgb),0.45)" : "1px solid rgba(var(--roam-cream-rgb),0.1)",
                            color: active ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.45)",
                          }}
                          onClick={() => toggleDnaTag(tag)}
                          data-testid={`dna-tag-${tag.replace(/[\s/]+/g, "-")}`}>
                    {active && <Check size={9} className="inline mr-1" />}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && (
            <div className="text-xs font-mono py-2.5 px-4 rounded-xl"
                 style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}
                 data-testid="text-save-error">
              {saveError}
            </div>
          )}

          <button className="w-full py-3.5 rounded-2xl font-mono text-sm tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                  onClick={saveEdit}
                  disabled={saving}
                  data-testid="button-save-profile">
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <>
                <Check size={14} /> Save changes
              </>
            )}
          </button>
        </div>
      </Sheet>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            Notifications
          </div>

          {[
            { key: "matches" as const, label: "New matches", desc: "When someone's adventure DNA aligns with yours" },
            { key: "messages" as const, label: "Messages", desc: "When a match sends you a message" },
            { key: "bucketList" as const, label: "Bucket list alerts", desc: "When matches share a destination you've pinned" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{item.desc}</div>
              </div>
              <button className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                      style={{ background: notifications[item.key] ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.12)" }}
                      onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
                      data-testid={`toggle-notif-${item.key}`}>
                <div className="w-4 h-4 rounded-full absolute top-1 transition-all"
                     style={{ background: "white", left: notifications[item.key] ? "calc(100% - 20px)" : "4px" }} />
              </button>
            </div>
          ))}

          <div className="pt-4">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              Account
            </div>
            <div className="space-y-2">
              {[
                { icon: Shield, label: "Privacy settings", desc: "Who can see your profile" },
                { icon: Camera, label: "Photo licensing", desc: "Manage your contributor licence" },
                { icon: Bell, label: "Email preferences", desc: "Adventure inspiration & updates" },
              ].map((item, i) => (
                <button key={i} className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                        style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                        data-testid={`settings-item-${i}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-cream-rgb),0.06)" }}>
                    <item.icon size={15} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{item.desc}</div>
                  </div>
                  <ChevronRight size={15} style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }} />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 pb-1">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2 pt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.35)", borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              Signed in as
            </div>
            <div className="font-mono text-[11px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
              {user?.email}
            </div>
          </div>
          <div className="pt-1">
            <button className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                    style={{ background: "rgba(232,98,26,0.06)", border: "1px solid rgba(232,98,26,0.15)" }}
                    onClick={async () => { await logout(); navigate("/login"); }}
                    data-testid="button-logout">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: "rgba(232,98,26,0.1)" }}>
                <LogOut size={15} style={{ color: "var(--roam-ember)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--roam-ember)" }}>Sign out</span>
            </button>
          </div>
        </div>
      </Sheet>

      {showYearCard && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: "var(--roam-forest)" }} data-testid="overlay-year-in-adventure">
          <div className="flex justify-end p-4 pt-5">
            <button className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.07)", border: "1px solid rgba(var(--roam-cream-rgb),0.13)" }}
                    onClick={() => setShowYearCard(false)}
                    data-testid="button-close-year">
              <X size={16} style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }} />
            </button>
          </div>

          <div className="mx-3.5 mb-8 rounded-[24px] overflow-hidden"
               style={{ background: "linear-gradient(160deg, var(--roam-moss) 0%, var(--roam-forest) 100%)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)", boxShadow: "0 16px 48px rgba(0,0,0,0.55)" }}>

            <div className="p-6 pb-5" style={{ background: "linear-gradient(135deg, rgba(var(--roam-electric-rgb),0.07), rgba(var(--roam-sky-rgb),0.04))", borderBottom: "1px solid rgba(var(--roam-electric-rgb),0.1)" }}>
              <div className="font-mono text-[10px] tracking-[2px] uppercase mb-1.5" style={{ color: "var(--roam-electric)" }}>🌍 Your 2025 in adventure</div>
              <div className="font-serif text-[30px] font-black leading-[1.05] mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.95)" }}>
                What a <span style={{ color: "var(--roam-electric)", fontStyle: "italic" }}>year</span><br />on the road.
              </div>
              <div className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                {profileData.name.toLowerCase().replace(/\s/g, "")} on roam.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[2px]" style={{ gridTemplateRows: "145px 145px", gridTemplateColumns: "1fr 1fr" }}>
              {PROFILE_PHOTOS.slice(0, 3).map((p, i) => (
                <div key={i} className={`relative overflow-hidden ${i === 0 ? "row-span-2" : ""}`} style={{ background: "var(--roam-moss)" }}>
                  <img src={p.url} alt={p.tags[0]} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-2 left-2">
                    <span className="font-mono text-[8px] tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                      📍 {p.tags[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2" style={{ gap: "1px", background: "rgba(var(--roam-cream-rgb),0.04)", marginTop: "2px" }}>
              {[
                { val: "47", label: "Adventures posted" },
                { val: "12", label: "Locations tagged" },
                { val: "3",  label: "Matches made" },
                { val: "1",  label: "Almost met" },
              ].map((s, i) => (
                <div key={i} className="p-4" style={{ background: "var(--roam-moss)" }}>
                  <div className="font-serif text-[28px] font-black leading-none mb-1" style={{ color: "var(--roam-electric)" }}>{s.val}</div>
                  <div className="font-mono text-[9px] tracking-[0.8px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3.5 p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=96&q=80&fit=crop" alt="Top match" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[9px] tracking-[0.8px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>Top match of the year</div>
                <div className="text-[15px] font-semibold mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.92)" }}>Mia</div>
                <div className="text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.42)" }}>78% adventure overlap · Franz Josef almost-met</div>
              </div>
              <div className="font-serif text-[26px] font-black flex-shrink-0" style={{ color: "var(--roam-electric)" }}>78%</div>
            </div>

            <div className="flex items-start gap-3 p-5" style={{ background: "rgba(var(--roam-ember-rgb),0.06)", borderTop: "1px solid rgba(var(--roam-ember-rgb),0.14)" }}>
              <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "1px" }}>⚡</span>
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.68)" }}>
                <span style={{ color: "var(--roam-ember)", fontWeight: 600 }}>Almost met.</span>{" "}
                You and Mia were both at Milford Sound in November — 3 days apart.
              </p>
            </div>

            <div className="p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="font-mono text-[9px] tracking-[0.8px] uppercase mb-2.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>Places you adventured</div>
              <div className="flex flex-wrap gap-1.5">
                {["Milford Sound", "Raglan", "Franz Josef", "Abel Tasman", "Tongariro", "Coromandel", "Bay of Islands", "Fiordland"].map(p => (
                  <span key={p} className="font-mono text-[10px] px-2.5 py-1 rounded-xl"
                        style={{ background: "rgba(var(--roam-sky-rgb),0.08)", border: "1px solid rgba(var(--roam-sky-rgb),0.22)", color: "var(--roam-sky)" }}>
                    📍 {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="font-serif text-[20px] font-black tracking-tight" style={{ color: "rgba(var(--roam-cream-rgb),0.92)" }}>
                roam<span style={{ color: "var(--roam-electric)" }}>.</span>
              </div>
              <button
                className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-wider px-4 py-2.5 rounded-xl transition-all hover:scale-105"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                onClick={async () => {
                  const text = `My 2025 in Adventure on roam. ⛰️\n47 adventures · 12 locations · 3 matches\nTop match: Mia (78% overlap)\nAlmost met at Milford Sound 👻\n\nroam.app`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    try { await navigator.share({ title: "My 2025 in Adventure", text }); } catch {}
                  } else {
                    navigator.clipboard?.writeText(text);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                data-testid="button-share-year">
                {shareCopied ? "✓ Copied!" : "📤 Share my year"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
