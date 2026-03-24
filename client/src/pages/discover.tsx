import { useState, useRef } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { MapPin, Bookmark, BookmarkCheck, Heart, X, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { computeVibeWord, getHonestyDisplay } from "@/lib/fingerprint";
import type { HonestyTier } from "@/lib/fingerprint";

type AuthRow = { label: string; score: number; tier: "good" | "mid" | "low" };
type PioneerBadge = { place: string; location: string; tagCount: number } | null;

const DEMO_PROFILES = [
  {
    id: "demo-p1",
    name: "Mia", age: 28,
    ethnicity: "New Zealander",
    tagline: "Chasing elevation, good coffee and anything with a summit",
    hero: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop",
    dna: ["alpine hiking", "rock climbing", "night markets"],
    vibeWord: "Deep Wilderness",
    honestyTier: "verified-adventure" as HonestyTier,
    almostMet: null,
    pioneerBadge: { place: "Franz Josef Glacier", location: "West Coast, NZ", tagCount: 47 } as PioneerBadge,
    authBreakdown: [
      { label: "Person in shot", score: 96, tier: "good" },
      { label: "Real locations", score: 98, tier: "good" },
      { label: "Authenticity", score: 91, tier: "good" },
      { label: "No manipulation", score: 89, tier: "good" },
    ] as AuthRow[],
  },
  {
    id: "demo-p2",
    name: "Kai", age: 31,
    ethnicity: "Māori",
    tagline: "Lost in alleyways, found in barrels",
    hero: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop",
    dna: ["surfing", "night markets", "urban roaming"],
    vibeWord: "Coastal Drifter",
    honestyTier: "verified-adventure" as HonestyTier,
    almostMet: null,
    pioneerBadge: { place: "Raglan Left", location: "Waikato, NZ", tagCount: 83 } as PioneerBadge,
    authBreakdown: [
      { label: "Person in shot", score: 82, tier: "good" },
      { label: "Real locations", score: 94, tier: "good" },
      { label: "Authenticity", score: 90, tier: "good" },
      { label: "No manipulation", score: 86, tier: "good" },
    ] as AuthRow[],
  },
  {
    id: "demo-p3",
    name: "Sam", age: 26,
    ethnicity: "Pacific Islander",
    tagline: "Every forest has a path worth getting lost on",
    hero: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop",
    dna: ["backpacking", "kayaking", "forest trails"],
    vibeWord: "Slow Travel",
    honestyTier: "mostly-verified" as HonestyTier,
    almostMet: null,
    pioneerBadge: null as PioneerBadge,
    authBreakdown: [
      { label: "Person in shot", score: 58, tier: "mid" },
      { label: "Real locations", score: 88, tier: "good" },
      { label: "Authenticity", score: 79, tier: "good" },
      { label: "No manipulation", score: 62, tier: "mid" },
    ] as AuthRow[],
  },
  {
    id: "demo-p4",
    name: "Astrid", age: 27,
    ethnicity: "Norwegian",
    tagline: "Storm-chasing sea cliffs. Been to Faroe twice, going again",
    hero: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=85&fit=crop",
    dna: ["canyoning", "coastal walks", "photography"],
    vibeWord: "Deep Wilderness",
    honestyTier: "verified-adventure" as HonestyTier,
    almostMet: { location: "Faroe Islands", dateHint: "2024 — you were both there" },
    pioneerBadge: { place: "Milford Track", location: "Fiordland, NZ", tagCount: 31 } as PioneerBadge,
    authBreakdown: [
      { label: "Person in shot", score: 91, tier: "good" },
      { label: "Real locations", score: 95, tier: "good" },
      { label: "Authenticity", score: 88, tier: "good" },
      { label: "No manipulation", score: 92, tier: "good" },
    ] as AuthRow[],
  },
];

const BUCKET_LIST = [
  {
    name: "Faroe Islands",
    want: "3 matches want this",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&q=80&fit=crop",
    hero: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=85&fit=crop",
    count: 3,
    match: { name: "Astrid", age: 27, ethnicity: "Norwegian", tagline: "Storm-chasing sea cliffs and puffin colonies — bucket list since forever" },
  },
  {
    name: "Patagonia",
    want: "7 matches want this",
    url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=80&fit=crop",
    hero: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=85&fit=crop",
    count: 7,
    match: { name: "Luca", age: 33, ethnicity: "Chilean", tagline: "Torres del Paine or nothing. Planning my third attempt" },
  },
  {
    name: "Kyoto autumn",
    want: "12 matches want this",
    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300&q=80&fit=crop",
    hero: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=85&fit=crop",
    count: 12,
    match: { name: "Yuki", age: 30, ethnicity: "Japanese", tagline: "Moss temples at dawn before the crowds. Matcha after" },
  },
  {
    name: "Iceland",
    want: "5 matches want this",
    url: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=300&q=80&fit=crop",
    hero: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&q=85&fit=crop",
    count: 5,
    match: { name: "Björn", age: 29, ethnicity: "Scandinavian", tagline: "Geothermal hot pots, midnight sun, and wild camping. Yes please" },
  },
  {
    name: "Lofoten",
    want: "2 matches want this",
    url: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=300&q=80&fit=crop",
    hero: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=800&q=85&fit=crop",
    count: 2,
    match: { name: "Freya", age: 25, ethnicity: "Norwegian", tagline: "Fishing villages, mountain ridges, and the aurora. My dream winter" },
  },
];

export default function Discover() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [profileIdx, setProfileIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [selectedBucket, setSelectedBucket] = useState<typeof BUCKET_LIST[0] | null>(null);
  const [bucketAnimKey, setBucketAnimKey] = useState(0);
  const [roamedIds, setRoamedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [passExpanded, setPassExpanded] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(false);
  const [pioneerTipOpen, setPioneerTipOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [matchCelebration, setMatchCelebration] = useState<{
    name: string; hero: string; sharedTags: string[]; almostMet: typeof DEMO_PROFILES[0]["almostMet"];
  } | null>(null);
  const dragStartX = useRef<number | null>(null);
  const pendingMatchRef = useRef<typeof matchCelebration>(null);
  const [, navigate] = useLocation();

  const profile = DEMO_PROFILES[profileIdx % DEMO_PROFILES.length];

  const { data: savedBucketList = [] } = useQuery<{ id: string; destinationName: string }[]>({
    queryKey: ["/api/bucket-list", user?.id],
    enabled: !!user,
  });

  const isPinned = (name: string) => savedBucketList.some((b: any) => b.destinationName === name);
  const getPinnedId = (name: string) => savedBucketList.find((b: any) => b.destinationName === name)?.id;

  const pinMutation = useMutation({
    mutationFn: async (dest: typeof BUCKET_LIST[0]) => {
      const pinned = isPinned(dest.name);
      if (pinned) {
        const id = getPinnedId(dest.name);
        if (id) await apiRequest("DELETE", `/api/bucket-list/${id}`);
      } else {
        await apiRequest("POST", "/api/bucket-list", {
          userId: user!.id,
          destinationName: dest.name,
          imageUrl: dest.url,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/bucket-list", user?.id] }),
  });

  const roamMutation = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user) return null;
      const res = await apiRequest("POST", "/api/matches", {
        userAId: user.id,
        userBId: targetId,
        status: "liked_a",
      });
      return res.json();
    },
    onSuccess: (data: any, targetId: string) => {
      setRoamedIds(s => new Set([...s, targetId]));
      if (data?.isNewMatch && pendingMatchRef.current) {
        setMatchCelebration(pendingMatchRef.current);
        pendingMatchRef.current = null;
      } else {
        showToast("✓ Adventure request sent!");
        setTimeout(advanceCard, 700);
      }
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const advanceCard = () => {
    setAnimKey(k => k + 1);
    setProfileIdx(i => i + 1);
    setSelectedBucket(null);
    setPassExpanded(false);
    setAuthExpanded(false);
    setPioneerTipOpen(false);
  };

  const handlePass = () => {
    if (passExpanded) {
      advanceCard();
    } else {
      setPassExpanded(true);
    }
  };

  const handleGracefulExit = () => {
    showToast("🤙 Sent — good vibes only");
    advanceCard();
  };

  const handleRoam = () => {
    if (!user) return;
    const targetId = selectedBucket ? `bucket-${selectedBucket.name}` : profile.id;
    pendingMatchRef.current = {
      name: displayName,
      hero: displayHero,
      sharedTags: displayDna.slice(0, 4),
      almostMet: displayAlmostMet,
    };
    roamMutation.mutate(targetId);
    setPassExpanded(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return;
    setDragOffset(e.touches[0].clientX - dragStartX.current);
  };
  const handleTouchEnd = () => {
    if (dragOffset > 80) handleRoam();
    else if (dragOffset < -80) advanceCard();
    setDragOffset(0);
    dragStartX.current = null;
  };

  const handleBucketClick = (b: typeof BUCKET_LIST[0]) => {
    if (selectedBucket?.name === b.name) {
      setSelectedBucket(null);
    } else {
      setSelectedBucket(b);
      setBucketAnimKey(k => k + 1);
    }
    setPassExpanded(false);
  };

  const handlePinToggle = (e: React.MouseEvent, b: typeof BUCKET_LIST[0]) => {
    e.stopPropagation();
    if (!user) return;
    pinMutation.mutate(b);
    showToast(isPinned(b.name) ? "Unpinned" : `📌 ${b.name} pinned to your bucket list!`);
  };

  const displayHero = selectedBucket ? selectedBucket.hero : profile.hero;
  const displayName = selectedBucket ? selectedBucket.match.name : profile.name;
  const displayAge = selectedBucket ? selectedBucket.match.age : profile.age;
  const displayEthnicity = selectedBucket ? selectedBucket.match.ethnicity : profile.ethnicity;
  const displayTagline = selectedBucket ? selectedBucket.match.tagline : profile.tagline;
  const displayDna = selectedBucket ? [] : profile.dna;
  const displayVibeWord = selectedBucket ? null : profile.vibeWord;
  const displayHonestyTier = selectedBucket ? ("mostly-verified" as HonestyTier) : profile.honestyTier;
  const displayAlmostMet = selectedBucket ? null : profile.almostMet;
  const cardKey = selectedBucket ? `bucket-${selectedBucket.name}-${bucketAnimKey}` : `profile-${animKey}`;

  const currentTargetId = selectedBucket ? `bucket-${selectedBucket.name}` : profile.id;
  const alreadyRoamed = roamedIds.has(currentTargetId);

  const honesty = getHonestyDisplay(displayHonestyTier);
  const displayPioneerBadge = selectedBucket ? null : profile.pioneerBadge;
  const displayAuthBreakdown = selectedBucket ? null : profile.authBreakdown;
  const avgAuthScore = displayAuthBreakdown
    ? Math.round(displayAuthBreakdown.reduce((a, b) => a + b.score, 0) / displayAuthBreakdown.length)
    : 0;
  const authTierColor = displayHonestyTier === "verified-adventure"
    ? "var(--roam-electric)"
    : displayHonestyTier === "mostly-verified"
    ? "var(--roam-sky)"
    : "var(--roam-ember)";
  const authTierBg = displayHonestyTier === "verified-adventure"
    ? "rgba(var(--roam-electric-rgb),0.1)"
    : displayHonestyTier === "mostly-verified"
    ? "rgba(var(--roam-sky-rgb),0.1)"
    : "rgba(var(--roam-ember-rgb),0.1)";
  const authTierBorder = displayHonestyTier === "verified-adventure"
    ? "rgba(var(--roam-electric-rgb),0.32)"
    : displayHonestyTier === "mostly-verified"
    ? "rgba(var(--roam-sky-rgb),0.3)"
    : "rgba(var(--roam-ember-rgb),0.3)";

  return (
    <div className="min-h-screen relative" data-testid="page-discover">
      <div className="topo-bg" />
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl font-mono text-[11px] tracking-wider animate-fade-up shadow-lg"
             style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-36">
          <div key={cardKey} className="animate-fade-up">
            <div className="mx-3.5 mt-4 rounded-[28px] overflow-hidden"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}
                 onTouchStart={handleTouchStart}
                 onTouchMove={handleTouchMove}
                 onTouchEnd={handleTouchEnd}>
              <div className="relative h-[500px] overflow-hidden" style={{ userSelect: "none" }}
                   onContextMenu={e => e.preventDefault()}>
                <img src={displayHero} alt={displayName}
                     className="w-full h-full object-cover transition-transform duration-[6s] ease-out hover:scale-[1.04]"
                     draggable={false} style={{ pointerEvents: "none" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.38) 55%, transparent 100%)", pointerEvents: "none" }} />

                {dragOffset > 20 && (
                  <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none"
                       style={{ background: `rgba(var(--roam-electric-rgb),${Math.min(0.32, dragOffset / 300)})` }}>
                    <div className="font-serif text-[42px] font-black tracking-tight rotate-12"
                         style={{ color: "var(--roam-electric)", opacity: Math.min(1, dragOffset / 80), textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>
                      ROAM ✦
                    </div>
                  </div>
                )}
                {dragOffset < -20 && (
                  <div className="absolute inset-0 flex items-center justify-start pl-8 pointer-events-none"
                       style={{ background: `rgba(var(--roam-ember-rgb),${Math.min(0.32, Math.abs(dragOffset) / 300)})` }}>
                    <div className="font-serif text-[42px] font-black tracking-tight -rotate-12"
                         style={{ color: "var(--roam-ember)", opacity: Math.min(1, Math.abs(dragOffset) / 80), textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>
                      PASS
                    </div>
                  </div>
                )}

                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between gap-2">
                  {selectedBucket ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                         style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.25)" }}>
                      <MapPin size={10} style={{ color: "rgba(255,255,255,0.8)" }} />
                      <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.88)" }}>
                        also wants {selectedBucket.name}
                      </span>
                    </div>
                  ) : displayVibeWord ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                         style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.18)" }}>
                      <span className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.88)" }}>
                        {displayVibeWord}
                      </span>
                    </div>
                  ) : <div />}

                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                       style={{ background: "rgba(0,0,0,0.45)", border: `1px solid rgba(255,255,255,0.22)` }}
                       data-testid="badge-honesty">
                    <span style={{ color: honesty.color, fontSize: "10px" }}>{honesty.symbol}</span>
                    <span className="font-mono text-[8px] tracking-wider" style={{ color: "rgba(255,255,255,0.82)" }}>
                      {honesty.label}
                    </span>
                  </div>
                </div>

                {displayAlmostMet && (
                  <div className="absolute top-14 left-3.5 flex items-center gap-2 px-3 py-2 rounded-xl"
                       style={{ background: "rgba(var(--roam-violet-rgb),0.18)", border: "1px solid rgba(var(--roam-violet-rgb),0.45)", backdropFilter: "blur(8px)" }}
                       data-testid="badge-almost-met">
                    <span style={{ fontSize: "12px" }}>👻</span>
                    <div>
                      <div className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "rgba(var(--roam-violet-rgb),0.9)" }}>Almost Met</div>
                      <div className="font-mono text-[8px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                        {displayAlmostMet.location} · {displayAlmostMet.dateHint}
                      </div>
                    </div>
                  </div>
                )}

                {displayPioneerBadge && (
                  <div className="absolute" style={{ bottom: "130px", right: "14px", zIndex: 5 }}>
                    <button
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl backdrop-blur-md transition-all"
                      style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(var(--roam-electric-rgb),0.55)" }}
                      onClick={() => setPioneerTipOpen(o => !o)}
                      data-testid="badge-pioneer">
                      <span style={{ fontSize: "14px" }}>🏔️</span>
                      <div>
                        <div className="font-mono text-[7px] tracking-[1px] uppercase leading-none mb-0.5" style={{ color: "var(--roam-electric)" }}>Regional Pioneer</div>
                        <div className="font-semibold text-[11px] leading-none" style={{ color: "rgba(255,255,255,0.92)" }}>{displayPioneerBadge.place}</div>
                      </div>
                    </button>
                    {pioneerTipOpen && (
                      <div className="absolute bottom-full mb-2 right-0 w-52 rounded-2xl p-3.5 shadow-2xl"
                           style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}
                           data-testid="tooltip-pioneer">
                        <div className="font-mono text-[8px] tracking-[1px] uppercase mb-1.5" style={{ color: "var(--roam-electric)" }}>🏔️ Regional Pioneer</div>
                        <div className="text-[13px] font-semibold mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.95)" }}>{displayPioneerBadge.place}</div>
                        <div className="text-[11px] leading-relaxed mb-2.5" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                          First to consistently tag this location — most posts from any single adventurer here.
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--roam-electric)" }} />
                          <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                            {displayPioneerBadge.tagCount} verified posts · {displayPioneerBadge.location}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-baseline gap-2.5 mb-1">
                    <h2 className="font-serif text-[34px] font-black leading-none tracking-tight"
                        style={{ color: "rgba(255,255,255,0.96)" }}
                        data-testid="text-card-name">
                      {displayName}
                    </h2>
                    <span className="font-serif text-[22px] font-light" style={{ color: "rgba(255,255,255,0.58)" }}>{displayAge}</span>
                  </div>
                  <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3"
                        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.9)" }}
                        data-testid="text-card-ethnicity">
                    {displayEthnicity}
                  </span>
                  <p className="text-[13px] italic leading-snug mb-3" style={{ color: "rgba(255,255,255,0.68)" }}>"{displayTagline}"</p>
                  {displayDna.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {displayDna.map(t => (
                        <span key={t} className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-lg"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.88)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {displayAuthBreakdown && (
                <div className="px-3.5 pt-3 pb-3">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all text-left"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.04)", border: "1px solid rgba(var(--roam-electric-rgb),0.1)" }}
                    onClick={() => setAuthExpanded(e => !e)}
                    data-testid="button-auth-expand">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg" style={{ background: authTierBg, border: `1px solid ${authTierBorder}` }}>
                      <span className="font-mono text-[8px] tracking-wider" style={{ color: authTierColor }}>
                        {honesty.symbol} {honesty.label}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] ml-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.32)" }}>AI score</span>
                    <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${avgAuthScore}%`, background: authTierColor }} />
                    </div>
                    <span className="font-mono text-[9px] font-medium" style={{ color: authTierColor }}>{avgAuthScore}%</span>
                    <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.28)" }}>{authExpanded ? "▲" : "▼"}</span>
                  </button>
                  {authExpanded && (
                    <div className="mt-1.5 px-3 py-3 rounded-xl" style={{ background: "rgba(var(--roam-electric-rgb),0.03)", border: "1px solid rgba(var(--roam-electric-rgb),0.08)" }}
                         data-testid="panel-auth-breakdown">
                      <div className="font-mono text-[8px] tracking-[1.2px] uppercase mb-2.5" style={{ color: "var(--roam-electric)" }}>AI photo analysis</div>
                      <div className="space-y-2">
                        {displayAuthBreakdown.map((row, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] flex-shrink-0" style={{ width: "110px", color: "rgba(var(--roam-cream-rgb),0.42)" }}>{row.label}</span>
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${row.score}%`, background: row.tier === "good" ? "var(--roam-electric)" : row.tier === "mid" ? "var(--roam-sky)" : "var(--roam-ember)" }} />
                            </div>
                            <span className="font-mono text-[10px] w-7 text-right flex-shrink-0" style={{ color: row.tier === "good" ? "var(--roam-electric)" : row.tier === "mid" ? "var(--roam-sky)" : "var(--roam-ember)" }}>{row.score}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 px-3.5 animate-fade-up-1">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                Bucket list matches near you
              </div>
              {savedBucketList.length > 0 && (
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}>
                  {savedBucketList.length} pinned
                </span>
              )}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {BUCKET_LIST.map((b, i) => {
                const isSelected = selectedBucket?.name === b.name;
                const pinned = isPinned(b.name);
                return (
                  <div key={i}
                       className="flex-shrink-0 w-[120px] rounded-2xl overflow-hidden relative cursor-pointer transition-all"
                       style={{
                         border: isSelected ? "2px solid var(--roam-electric)" : pinned ? "2px solid rgba(var(--roam-sky-rgb),0.5)" : "1px solid rgba(var(--roam-cream-rgb),0.07)",
                         transform: isSelected ? "scale(1.03)" : "scale(1)",
                       }}
                       onClick={() => handleBucketClick(b)}
                       data-testid={`bucket-${b.name.replace(/\s+/g, "-")}`}>
                    <img src={b.url} alt={b.name} className="w-[120px] h-[120px] object-cover" loading="lazy" />
                    <div className="absolute inset-0 flex flex-col justify-end p-2"
                         style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }}>
                      <div className="text-[11px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>{b.name}</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "var(--roam-sky)" }}>{b.want}</div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 font-mono text-[8px] font-medium px-1.5 py-0.5 rounded-lg"
                         style={{ background: isSelected ? "var(--roam-electric)" : "rgba(var(--roam-electric-rgb),0.8)", color: "var(--roam-forest)" }}>
                      {b.count}x
                    </div>
                    <button className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                            style={{
                              background: pinned ? "rgba(var(--roam-sky-rgb),0.25)" : "rgba(var(--roam-forest-rgb),0.7)",
                              border: pinned ? "1px solid rgba(var(--roam-sky-rgb),0.5)" : "1px solid rgba(var(--roam-cream-rgb),0.2)",
                            }}
                            onClick={e => handlePinToggle(e, b)}
                            data-testid={`pin-${b.name.replace(/\s+/g, "-")}`}>
                      {pinned
                        ? <BookmarkCheck size={11} style={{ color: "var(--roam-sky)" }} />
                        : <Bookmark size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }} />}
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedBucket && (
              <p className="font-mono text-[9px] tracking-wider mt-2 text-center animate-fade-up"
                 style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                tap again to clear · tap another destination to switch
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed z-50 left-0 right-0 backdrop-blur-xl"
           style={{ bottom: "65px", background: `rgba(var(--roam-forest-rgb),0.96)`, borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
           data-testid="action-bar">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-3">
          {passExpanded ? (
            <>
              <button className="flex-none h-11 px-3 rounded-2xl flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-wider transition-all"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.08)", border: "1px solid rgba(var(--roam-cream-rgb),0.18)", color: "rgba(var(--roam-cream-rgb),0.55)" }}
                      onClick={advanceCard}
                      data-testid="button-pass-silent">
                <X size={13} /> Pass
              </button>
              <button className="flex-1 h-11 rounded-2xl flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-wider transition-all animate-fade-up"
                      style={{ background: "rgba(var(--roam-sky-rgb),0.1)", border: "1px solid rgba(var(--roam-sky-rgb),0.3)", color: "var(--roam-sky)" }}
                      onClick={handleGracefulExit}
                      data-testid="button-not-my-adventure">
                🤙 Not my adventure
              </button>
            </>
          ) : (
            <button className="flex-none w-11 h-11 rounded-2xl flex items-center justify-center transition-all"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.07)", border: "1px solid rgba(var(--roam-cream-rgb),0.14)", color: "rgba(var(--roam-cream-rgb),0.38)" }}
                    onClick={handlePass}
                    data-testid="button-pass">
              <X size={17} />
            </button>
          )}
          <button className="flex-1 py-3 rounded-2xl font-mono text-[11px] tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{
                    background: alreadyRoamed ? "rgba(var(--roam-electric-rgb),0.2)" : "var(--roam-electric)",
                    color: alreadyRoamed ? "var(--roam-electric)" : "var(--roam-forest)",
                    border: alreadyRoamed ? "1px solid rgba(var(--roam-electric-rgb),0.4)" : "none",
                  }}
                  onClick={handleRoam}
                  disabled={roamMutation.isPending || alreadyRoamed}
                  data-testid="button-roam">
            {alreadyRoamed ? (
              <><Heart size={13} fill="currentColor" /> Requested!</>
            ) : roamMutation.isPending ? "Sending…" : "Roam Together"}
          </button>
          <button className="flex-none w-11 h-11 rounded-2xl flex items-center justify-center transition-all"
                  style={{ background: "rgba(var(--roam-sky-rgb),0.08)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)", color: "var(--roam-sky)" }}
                  onClick={() => showToast("⭐ Saved to shortlist!")}
                  data-testid="button-super-roam">
            <Star size={16} />
          </button>
        </div>
        {passExpanded && (
          <p className="font-mono text-[9px] tracking-wider text-center pb-2 -mt-1"
             style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            silent pass or send a kind wave — no text needed
          </p>
        )}
      </div>

      {matchCelebration && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
             style={{ background: "rgba(var(--roam-forest-rgb),0.97)", backdropFilter: "blur(24px)" }}
             data-testid="match-celebration">
          <div className="w-full max-w-sm px-6 flex flex-col items-center gap-0 animate-fade-up">
            <div className="font-mono text-[10px] tracking-[3px] uppercase mb-3" style={{ color: "var(--roam-electric)" }}>
              ✦ adventure unlocked ✦
            </div>
            <div className="font-serif text-[40px] font-black tracking-tight leading-none mb-1" style={{ color: "var(--roam-cream)" }}>
              It's a match!
            </div>
            <div className="font-mono text-[11px] mb-8" style={{ color: `rgba(var(--roam-cream-rgb),0.45)` }}>
              You and {matchCelebration.name} both want to roam
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-28 h-36 rounded-2xl overflow-hidden border-2"
                   style={{ borderColor: "rgba(var(--roam-electric-rgb),0.4)" }}>
                <div className="w-full h-full flex items-center justify-center font-serif text-2xl"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "rgba(var(--roam-cream-rgb),0.3)" }}>you</div>
              </div>
              <div className="font-serif text-3xl" style={{ color: "var(--roam-electric)" }}>✦</div>
              <div className="w-28 h-36 rounded-2xl overflow-hidden border-2"
                   style={{ borderColor: "rgba(var(--roam-electric-rgb),0.4)" }}>
                <img src={matchCelebration.hero} alt={matchCelebration.name} className="w-full h-full object-cover" />
              </div>
            </div>

            {matchCelebration.sharedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-6">
                {matchCelebration.sharedTags.map(tag => (
                  <span key={tag} className="font-mono text-[9px] tracking-wider px-2.5 py-1 rounded-lg uppercase"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {matchCelebration.almostMet && (
              <div className="w-full mb-6 px-4 py-3 rounded-xl text-center"
                   style={{ background: "rgba(var(--roam-violet-rgb),0.1)", border: "1px solid rgba(var(--roam-violet-rgb),0.3)" }}>
                <div className="font-mono text-[9px] tracking-wider uppercase mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>👻 almost met</div>
                <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                  You were both near {matchCelebration.almostMet.location} {matchCelebration.almostMet.dateHint}
                </div>
              </div>
            )}

            <button className="w-full py-4 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-medium mb-3"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    onClick={() => { setMatchCelebration(null); navigate("/matches"); }}
                    data-testid="button-start-adventure">
              Start the adventure →
            </button>
            <button className="font-mono text-[10px] tracking-wider"
                    style={{ color: `rgba(var(--roam-cream-rgb),0.35)` }}
                    onClick={() => { setMatchCelebration(null); advanceCard(); }}
                    data-testid="button-keep-exploring">
              keep exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
