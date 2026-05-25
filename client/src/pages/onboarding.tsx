import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, ChevronRight, ChevronLeft, CloudUpload, Compass } from "lucide-react";

// ─── Adventure types — tags map directly into buildFingerprint() ──────────────

const ADVENTURE_TYPES = [
  {
    emoji: "🏔️",
    label: "Mountain & Alpine",
    subtitle: "Summits, ridgelines, big elevation",
    tags: ["alpine hiking", "rock climbing", "ice climbing", "via ferrata", "canyoning", "trad / crack climbing"],
  },
  {
    emoji: "🌊",
    label: "Ocean & Water",
    subtitle: "Surf, dive, paddle, sail",
    tags: ["surfing", "kayaking", "scuba diving", "free diving", "boating / rod fishing", "spearfishing", "whale watching"],
  },
  {
    emoji: "❄️",
    label: "Snow & Ice",
    subtitle: "Powder days, frozen terrain",
    tags: ["skiing", "snowboarding", "dog sledding", "snowshoeing"],
  },
  {
    emoji: "🪂",
    label: "Sky & Air",
    subtitle: "Paragliders, base jumps, thermals",
    tags: ["paragliding", "skydiving", "base jumping"],
  },
  {
    emoji: "🌲",
    label: "Trail & Forest",
    subtitle: "Multi-day treks, hidden paths",
    tags: ["hiking", "trail running", "forest trails", "backpacking"],
  },
  {
    emoji: "🏙️",
    label: "Urban & Culture",
    subtitle: "Night markets, street food, wandering",
    tags: ["urban roaming", "night markets", "food & wine trails", "couch surfing", "parkour"],
  },
  {
    emoji: "🚵",
    label: "Extreme & Technical",
    subtitle: "Bikes, ropes, adrenaline",
    tags: ["extreme sports", "mountain biking", "bungee jumping", "horse riding"],
  },
  {
    emoji: "🏝️",
    label: "Coastal & Slow",
    subtitle: "Beaches, cliffs, slow mornings",
    tags: ["coastal walks", "photography", "yoga / wellness", "walking", "beachcombing"],
  },
];

// ─── Destinations — seed into bucket list engine on day one ──────────────────

const DESTINATIONS = [
  { name: "Patagonia",          country: "South America", seed: "patagonia-wild-mountains" },
  { name: "Norwegian Fjords",   country: "Norway",        seed: "norway-fjord-boat" },
  { name: "Milford Sound",      country: "New Zealand",   seed: "milford-sound-nz" },
  { name: "Nepal Himalayas",    country: "Nepal",         seed: "himalaya-trekking-trail" },
  { name: "Iceland",            country: "Northern Europe", seed: "iceland-waterfall-green" },
  { name: "Dolomites",          country: "Italy",         seed: "dolomites-alpine-lake" },
  { name: "Scottish Highlands", country: "Scotland",      seed: "scotland-highland-mist" },
  { name: "Raja Ampat",         country: "Indonesia",     seed: "raja-ampat-ocean" },
  { name: "Atacama Desert",     country: "Chile",         seed: "atacama-desert-salt" },
  { name: "Hokkaido",           country: "Japan",         seed: "hokkaido-winter-snow" },
  { name: "Faroe Islands",      country: "Denmark",       seed: "faroe-islands-cliffs" },
  { name: "Queenstown",         country: "New Zealand",   seed: "queenstown-lake-mountain" },
];

// ─── Photo examples ───────────────────────────────────────────────────────────

const GOOD_EXAMPLES = [
  { seed: "mountain-hiker-summit-view", label: "Summit views" },
  { seed: "surfer-ocean-wave-action",   label: "Action shots"  },
  { seed: "trail-runner-forest-path",   label: "Real moments"  },
];

const BAD_EXAMPLES = [
  { seed: "gym-fitness-indoor-person",  label: "Gym mirrors"       },
  { seed: "crowd-concert-blurry-night", label: "Invisible in crowd" },
  { seed: "posed-city-building-street", label: "No adventure context" },
];

// ─── Upload state ─────────────────────────────────────────────────────────────

interface PhotoState {
  localId: string;
  preview: string;
  status: "uploading" | "analysing" | "approved" | "error";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [selectedAdventures, setSelectedAdventures] = useState<Set<number>>(new Set());
  const [selectedDests, setSelectedDests] = useState<Set<number>>(new Set());
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use server-side state as the source of truth — adventureTags being set
  // means the user has completed onboarding at least once, regardless of device.
  useEffect(() => {
    if (user && (user as any).adventureTags?.length > 0) {
      navigate("/discover");
    }
  }, [user]);

  const TOTAL_STEPS = 5;
  const progress = (step / (TOTAL_STEPS - 1)) * 100;
  // Steps 1-3 are the meaningful setup steps shown in the counter (skip intro/complete)
  const setupStep = step; // step 1=adventure, 2=destinations, 3=photos, 4=complete
  const approvedCount = photos.filter(p => p.status === "approved").length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleAdventure = (idx: number) => {
    setSelectedAdventures(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleDest = (idx: number) => {
    setSelectedDests(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const saveAdventuresAndNext = async () => {
    if (!user) { setStep(2); return; }
    if (selectedAdventures.size === 0) { setStep(2); return; }
    setSaving(true);
    try {
      const tags = [...selectedAdventures].flatMap(i => ADVENTURE_TYPES[i].tags);
      await apiRequest("PATCH", `/api/users/${user.id}`, { adventureTags: tags });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (e) {
      console.warn("[onboarding] adventure tags save failed:", e);
    } finally {
      setSaving(false);
      setStep(2);
    }
  };

  const saveDestsAndNext = async () => {
    if (!user || selectedDests.size === 0) { setStep(3); return; }
    setSaving(true);
    try {
      await Promise.all(
        [...selectedDests].map(i =>
          apiRequest("POST", "/api/bucket-list", {
            destinationName: DESTINATIONS[i].name,
            imageUrl: `https://picsum.photos/seed/${DESTINATIONS[i].seed}/300/200`,
          }).catch(() => {})
        )
      );
    } catch (e) {
      console.warn("[onboarding] bucket list save failed:", e);
    } finally {
      setSaving(false);
      setStep(3);
    }
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !user) return;
    const slots = 6 - photos.length;
    if (slots <= 0) return;
    const incoming = Array.from(files).slice(0, slots);

    const newStates: PhotoState[] = incoming.map(f => ({
      localId: `${Date.now()}-${Math.random()}`,
      preview: URL.createObjectURL(f),
      status: "uploading" as const,
    }));
    setPhotos(prev => [...prev, ...newStates]);

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      const ps = newStates[i];
      try {
        const dataUrl = await readFileAsDataUrl(file);

        setPhotos(prev => prev.map(x => x.localId === ps.localId ? { ...x, status: "analysing" } : x));

        await apiRequest("POST", "/api/upload", {
          dataUrl,
          filename: file.name,
          userId: user.id,
          displayOrder: photos.length + i,
        });

        await new Promise(r => setTimeout(r, 1400));

        setPhotos(prev => prev.map(x => x.localId === ps.localId ? { ...x, status: "approved" } : x));
        queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/photos`] });
      } catch (e) {
        console.error("[onboarding] upload error:", e);
        setPhotos(prev => prev.map(x => x.localId === ps.localId ? { ...x, status: "error" } : x));
      }
    }
  }, [user, photos.length]);

  const handleComplete = () => {
    localStorage.setItem("roam_onboarding_done", "1");
    navigate("/discover");
  };

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const electricBtn = {
    background: "var(--roam-electric)",
    color: "#0e1a0d",
  } as const;

  const dimBtn = {
    background: "rgba(var(--roam-cream-rgb), 0.07)",
    color: "rgba(var(--roam-cream-rgb), 0.4)",
  } as const;

  // ── Step 0: Intro (merged with photo guidance) ────────────────────────────────

  const step0 = (
    <div className="flex flex-col items-center text-center gap-7 px-6 py-10">
      <div>
        <h1 className="font-serif text-5xl tracking-tight mb-2" style={{ color: "var(--roam-cream)" }}>roam.</h1>
        <p className="text-[11px] tracking-[3px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb), 0.35)" }}>
          adventure matching
        </p>
      </div>

      <p className="text-lg leading-relaxed max-w-xs" style={{ color: "rgba(var(--roam-cream-rgb), 0.75)" }}>
        A space for people who collect experiences — not likes.
      </p>

      <div
        className="w-full max-w-sm rounded-2xl p-5 text-left"
        style={{ background: "rgba(var(--roam-cream-rgb), 0.04)", border: "1px solid rgba(var(--roam-cream-rgb), 0.1)" }}
      >
        <p className="text-[10px] tracking-widest uppercase mb-3 text-center" style={{ color: "rgba(var(--roam-cream-rgb), 0.35)" }}>
          3 quick steps to your adventure profile
        </p>
        <div className="flex flex-col gap-3">
          {[
            { n: "1", label: "Pick your adventure style", sub: "Seeds your matching fingerprint" },
            { n: "2", label: "Pin dream destinations", sub: "Get notified when a match shares one" },
            { n: "3", label: "Add adventure photos", sub: "You in action beats landscapes alone" },
          ].map(({ n, label, sub }) => (
            <div key={n} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "var(--roam-electric)", color: "#0e1a0d" }}
              >
                {n}
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold" style={{ color: "var(--roam-cream)" }}>{label}</div>
                <div className="text-xs" style={{ color: "rgba(var(--roam-cream-rgb), 0.38)" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-4"
        style={{ background: "rgba(var(--roam-cream-rgb), 0.03)", border: "1px solid rgba(var(--roam-cream-rgb), 0.07)" }}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] tracking-widest uppercase mb-0.5" style={{ color: "var(--roam-electric)" }}>✓ Belongs here</p>
            {["Summit moments", "Surf & ocean", "Trail runs", "Any real adventure"].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(var(--roam-cream-rgb), 0.65)" }}>
                <Check className="w-3 h-3 shrink-0 text-green-400" /> {t}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] tracking-widest uppercase mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb), 0.3)" }}>✗ Doesn't fit</p>
            {["Mirror selfies", "Club nights", "Pet portraits", "Heavy filters"].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(var(--roam-cream-rgb), 0.35)" }}>
                <X className="w-3 h-3 shrink-0 text-red-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full max-w-sm py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
        style={electricBtn}
        data-testid="button-onboarding-start"
      >
        Let's go <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );

  // ── Step 2: Adventure quiz ────────────────────────────────────────────────────

  const step2 = (
    <div className="flex flex-col gap-5 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl mb-1" style={{ color: "var(--roam-cream)" }}>What gets you out of bed?</h2>
          <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb), 0.45)" }}>
            Pick everything that fits. This seeds your adventure fingerprint.
          </p>
        </div>
        {selectedAdventures.size > 0 && (
          <span
            className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold mt-1"
            style={{ background: "var(--roam-electric)", color: "#0e1a0d" }}
          >
            {selectedAdventures.size}/8
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ADVENTURE_TYPES.map((type, idx) => {
          const selected = selectedAdventures.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggleAdventure(idx)}
              className="relative rounded-2xl p-4 text-left transition-all"
              style={{
                background: selected ? "rgba(164,230,58,0.1)" : "rgba(var(--roam-cream-rgb), 0.04)",
                border: `1.5px solid ${selected ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb), 0.09)"}`,
              }}
              data-testid={`card-adventure-${idx}`}
            >
              {selected && (
                <span
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--roam-electric)" }}
                >
                  <Check className="w-3 h-3" style={{ color: "#0e1a0d" }} />
                </span>
              )}
              <div className="text-2xl mb-2">{type.emoji}</div>
              <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--roam-cream)" }}>{type.label}</div>
              <div className="text-xs leading-tight" style={{ color: "rgba(var(--roam-cream-rgb), 0.38)" }}>{type.subtitle}</div>
            </button>
          );
        })}
      </div>

      <button
        onClick={saveAdventuresAndNext}
        disabled={saving}
        className="w-full py-4 rounded-xl font-semibold text-base"
        style={selectedAdventures.size > 0 ? electricBtn : dimBtn}
        data-testid="button-onboarding-save-adventures"
      >
        {saving ? "Saving…" : selectedAdventures.size > 0 ? "Save my adventure DNA →" : "Skip for now"}
      </button>
    </div>
  );

  // ── Step 3: Bucket list seed ──────────────────────────────────────────────────

  const step3 = (
    <div className="flex flex-col gap-5 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl mb-1" style={{ color: "var(--roam-cream)" }}>Where next?</h2>
          <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb), 0.45)" }}>
            Pin dream destinations. You'll be notified when a match shares one.
          </p>
        </div>
        {selectedDests.size > 0 && (
          <span
            className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold mt-1"
            style={{ background: "var(--roam-electric)", color: "#0e1a0d" }}
          >
            {selectedDests.size}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {DESTINATIONS.map((dest, idx) => {
          const selected = selectedDests.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggleDest(idx)}
              className="relative rounded-xl overflow-hidden text-left"
              style={{ aspectRatio: "3/4", border: `2px solid ${selected ? "var(--roam-electric)" : "transparent"}` }}
              data-testid={`card-dest-${idx}`}
            >
              <img
                src={`https://picsum.photos/seed/${dest.seed}/200/270`}
                alt={dest.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(transparent 35%, rgba(0,0,0,0.85))" }}
              />
              {selected && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "var(--roam-electric)" }}
                >
                  <Check className="w-4 h-4" style={{ color: "#0e1a0d" }} />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="text-xs font-semibold leading-tight" style={{ color: "var(--roam-cream)" }}>{dest.name}</div>
                <div className="text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb), 0.45)" }}>{dest.country}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={saveDestsAndNext}
        disabled={saving}
        className="w-full py-4 rounded-xl font-semibold text-base"
        style={selectedDests.size > 0 ? electricBtn : dimBtn}
        data-testid="button-onboarding-save-dests"
      >
        {saving
          ? "Pinning…"
          : selectedDests.size > 0
          ? `Pin ${selectedDests.size} destination${selectedDests.size !== 1 ? "s" : ""} →`
          : "Skip for now"}
      </button>
    </div>
  );

  // ── Step 4: Photo upload ──────────────────────────────────────────────────────

  const step4 = (
    <div className="flex flex-col gap-5 px-6 py-8">
      <div>
        <h2 className="font-serif text-3xl mb-1" style={{ color: "var(--roam-cream)" }}>Add your adventure proof</h2>
        <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb), 0.45)" }}>
          Upload 1–6 photos. LetsRoam.life reads context — where, what, how real.
        </p>
      </div>

      {photos.length < 6 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-all"
          style={{ borderColor: "rgba(var(--roam-cream-rgb), 0.18)", color: "rgba(var(--roam-cream-rgb), 0.38)" }}
          data-testid="button-upload-zone"
        >
          <CloudUpload className="w-8 h-8" />
          <span className="text-sm">Tap to choose photos</span>
          <span className="text-xs">{6 - photos.length} slot{6 - photos.length !== 1 ? "s" : ""} remaining</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        data-testid="input-photo-upload"
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(p => (
            <div key={p.localId} className="relative rounded-xl overflow-hidden aspect-square">
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.52)" }}>
                {p.status === "uploading" && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(var(--roam-cream-rgb),0.4)", borderTopColor: "var(--roam-cream)" }}
                    />
                    <span className="text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Uploading</span>
                  </div>
                )}
                {p.status === "analysing" && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(164,230,58,0.35)", borderTopColor: "var(--roam-electric)" }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--roam-electric)" }}>Analysing…</span>
                  </div>
                )}
                {p.status === "approved" && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--roam-electric)" }}>
                      <Check className="w-4 h-4" style={{ color: "#0e1a0d" }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: "var(--roam-electric)" }}>Confirmed</span>
                  </div>
                )}
                {p.status === "error" && (
                  <div className="flex flex-col items-center gap-1.5">
                    <X className="w-5 h-5 text-red-400" />
                    <span className="text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>Try another</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <button
          onClick={() => setStep(5)}
          disabled={approvedCount === 0}
          className="w-full py-4 rounded-xl font-semibold text-base"
          style={approvedCount > 0 ? electricBtn : dimBtn}
          data-testid="button-onboarding-upload-continue"
        >
          {approvedCount > 0
            ? `Continue with ${approvedCount} photo${approvedCount !== 1 ? "s" : ""} →`
            : "Waiting for upload…"}
        </button>
      )}

      <button
        onClick={() => setStep(5)}
        className="text-center text-sm py-2"
        style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
        data-testid="button-onboarding-upload-skip"
      >
        Skip — I'll add photos later
      </button>
    </div>
  );

  // ── Step 5: Complete ──────────────────────────────────────────────────────────

  const myTags = [...selectedAdventures].flatMap(i => ADVENTURE_TYPES[i].tags).slice(0, 9);
  const myDests = [...selectedDests].map(i => DESTINATIONS[i].name).slice(0, 6);
  const firstName = user?.name?.split(" ")[0] ?? "";

  const step5 = (
    <div className="flex flex-col items-center text-center gap-8 px-6 py-12">
      <div className="text-6xl" style={{ animation: "bounce 1s ease-in-out 3" }}>🧭</div>

      <div>
        <h2 className="font-serif text-4xl mb-2" style={{ color: "var(--roam-cream)" }}>
          {firstName ? `You're in, ${firstName}.` : "You're in."}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb), 0.55)" }}>
          Your adventure fingerprint is live. Time to find your crew.
        </p>
      </div>

      {myTags.length > 0 && (
        <div className="w-full max-w-xs">
          <p className="text-[10px] tracking-widest uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb), 0.35)" }}>
            Your adventure DNA
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {myTags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(164,230,58,0.12)", color: "var(--roam-electric)", border: "1px solid rgba(164,230,58,0.25)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {myDests.length > 0 && (
        <div className="w-full max-w-xs">
          <p className="text-[10px] tracking-widest uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb), 0.35)" }}>
            Pinned destinations
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {myDests.map(dest => (
              <span
                key={dest}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(var(--roam-cream-rgb), 0.07)", color: "rgba(var(--roam-cream-rgb), 0.65)", border: "1px solid rgba(var(--roam-cream-rgb), 0.12)" }}
              >
                📍 {dest}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleComplete}
        className="w-full max-w-xs py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
        style={electricBtn}
        data-testid="button-onboarding-complete"
      >
        <Compass className="w-5 h-5" />
        Start discovering
      </button>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────────

  const STEPS = [step0, step1, step2, step3, step4, step5];

  return (
    <div className="min-h-screen" style={{ background: "var(--roam-base, #0e1a0d)" }}>
      {/* Progress bar — hidden on intro */}
      {step > 0 && (
        <div
          className="fixed top-0 left-0 right-0 h-[3px] z-10"
          style={{ background: "rgba(var(--roam-cream-rgb), 0.07)" }}
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: "var(--roam-electric)" }}
          />
        </div>
      )}

      {/* Back button — show on steps 1-4 */}
      {step > 0 && step < 5 && (
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          className="fixed top-4 left-4 z-10 p-2 rounded-full"
          style={{ background: "rgba(var(--roam-cream-rgb), 0.07)" }}
          data-testid="button-onboarding-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "rgba(var(--roam-cream-rgb), 0.55)" }} />
        </button>
      )}

      <div className="max-w-md mx-auto min-h-screen pb-8">
        {step > 0 && <div className="h-14" />}
        {STEPS[step]}
      </div>
    </div>
  );
}
