import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { HonestyTier } from "@/lib/fingerprint";
import AdCard, { type LiveAd } from "@/components/ad-card";
import {
  Mountain, Waves, Camera, ShoppingBag, Building2,
  Backpack, TreePine, Bike, Tent, Compass, Footprints,
  Sunset, Fish, Wind, MapPin,
} from "lucide-react";

const TAG_ICON_MAP: Record<string, React.ReactNode> = {
  "alpine hiking":   <Mountain size={12} />,
  "rock climbing":   <Mountain size={12} />,
  "night markets":   <ShoppingBag size={12} />,
  "surfing":         <Waves size={12} />,
  "urban roaming":   <Building2 size={12} />,
  "backpacking":     <Backpack size={12} />,
  "kayaking":        <Waves size={12} />,
  "forest trails":   <TreePine size={12} />,
  "canyoning":       <Mountain size={12} />,
  "coastal walks":   <Footprints size={12} />,
  "photography":     <Camera size={12} />,
  "cycling":         <Bike size={12} />,
  "camping":         <Tent size={12} />,
  "sailing":         <Wind size={12} />,
  "fishing":         <Fish size={12} />,
  "travel":          <Compass size={12} />,
  "sunsets":         <Sunset size={12} />,
};
function tagIcon(tag: string) {
  return TAG_ICON_MAP[tag.toLowerCase()] ?? <MapPin size={12} />;
}

type PioneerBadge = { place: string; location: string; tagCount: number } | null;

const DEMO_PROFILES = [
  {
    id: "demo-p1",
    name: "Mia", age: 28,
    ethnicity: "New Zealander",
    tagline: "Chasing elevation, good coffee and anything with a summit",
    hero: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop",
    dna: ["alpine hiking", "rock climbing", "night markets"],
    honestyTier: "unverified" as HonestyTier,
    almostMet: null,
    pioneerBadge: { place: "Franz Josef Glacier", location: "West Coast, NZ", tagCount: 47 } as PioneerBadge,
    hasNewMatch: true,
  },
  {
    id: "demo-p2",
    name: "Kai", age: 31,
    ethnicity: "Māori",
    tagline: "Lost in alleyways, found in barrels",
    hero: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop",
    dna: ["surfing", "night markets", "urban roaming"],
    honestyTier: "unverified" as HonestyTier,
    almostMet: null,
    pioneerBadge: { place: "Raglan Left", location: "Waikato, NZ", tagCount: 83 } as PioneerBadge,
    hasNewMatch: false,
  },
  {
    id: "demo-p3",
    name: "Sam", age: 26,
    ethnicity: "Pacific Islander",
    tagline: "Every forest has a path worth getting lost on",
    hero: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop",
    dna: ["backpacking", "kayaking", "forest trails"],
    honestyTier: "unverified" as HonestyTier,
    almostMet: null,
    pioneerBadge: null as PioneerBadge,
    hasNewMatch: false,
  },
  {
    id: "demo-p4",
    name: "Astrid", age: 27,
    ethnicity: "Norwegian",
    tagline: "Storm-chasing sea cliffs. Been to Faroe twice, going again",
    hero: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=85&fit=crop",
    dna: ["canyoning", "coastal walks", "photography"],
    honestyTier: "unverified" as HonestyTier,
    almostMet: { location: "Faroe Islands", dateHint: "2024 — you were both there" },
    pioneerBadge: { place: "Milford Track", location: "Fiordland, NZ", tagCount: 31 } as PioneerBadge,
    hasNewMatch: true,
  },
];

export default function Discover() {
  const { user } = useAuth();

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
    refetchInterval: 60000,
  });

  const [profileIdx, setProfileIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [roamedIds, setRoamedIds] = useState<Set<string>>(new Set());
  const [swipedCount, setSwipedCount] = useState(0);
  const [showingAd, setShowingAd] = useState(false);
  const [adExitDir, setAdExitDir] = useState<"left" | "right" | "up" | null>(null);
  const [adDragOffset, setAdDragOffset] = useState(0);
  const [adDragOffsetY, setAdDragOffsetY] = useState(0);

  const { data: liveAd } = useQuery<LiveAd | null>({
    queryKey: ["/api/ads/live"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [pioneerTipOpen, setPioneerTipOpen] = useState(false);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [exitDir, setExitDir] = useState<"up" | "left" | "right" | null>(null);
  const [matchCelebration, setMatchCelebration] = useState<{
    name: string; hero: string; sharedTags: string[]; almostMet: typeof DEMO_PROFILES[0]["almostMet"];
  } | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isMouseDown = useRef(false);
  const pendingMatchRef = useRef<typeof matchCelebration>(null);
  const [, navigate] = useLocation();

  const realDeck = useMemo(() => {
    if (!user) return null;
    return allUsers
      .filter(u => u.id !== user.id)
      .map(u => {
        const age = u.dob
          ? Math.floor((Date.now() - new Date(u.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
          : null;
        return {
          id: u.id as string,
          name: u.name as string,
          age: age as number | null,
          ethnicity: (u.ethnicity || "") as string,
          tagline: (u.tagline || "Adventure awaits") as string,
          hero: (u.avatarUrl || "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=85&fit=crop") as string,
          dna: ((u.adventureTags || []) as string[]),
          honestyTier: (u.identityVerified ? "verified-adventure" : "unverified") as HonestyTier,
          almostMet: null as { location: string; dateHint: string } | null,
          pioneerBadge: null as PioneerBadge,
          hasNewMatch: false,
        };
      });
  }, [allUsers, user]);

  const deck = realDeck ?? DEMO_PROFILES;
  const deckExhausted = user != null && !loadingUsers && deck.length > 0 && profileIdx >= deck.length;
  const noUsersYet = user != null && !loadingUsers && deck.length === 0;

  const profile = deck[Math.min(profileIdx, Math.max(deck.length - 1, 0))];
  const isVerifiedUser = profile?.honestyTier === "verified-adventure";
  const cardKey = `profile-${animKey}`;

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
      }
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const dismissAd = () => {
    setAdExitDir("up");
    setTimeout(() => {
      setShowingAd(false);
      setAdExitDir(null);
      setAdDragOffset(0);
      setAdDragOffsetY(0);
    }, 360);
  };

  const evaluateAdGesture = () => {
    const absX = Math.abs(adDragOffset);
    const absY = Math.abs(adDragOffsetY);
    if ((absY > absX && adDragOffsetY < -60) || absX > 80) {
      const dir: "left" | "right" | "up" = absY > absX ? "up" : adDragOffset > 0 ? "right" : "left";
      setAdExitDir(dir);
      setTimeout(() => {
        setShowingAd(false);
        setAdExitDir(null);
        setAdDragOffset(0);
        setAdDragOffsetY(0);
      }, 360);
    } else {
      setAdDragOffset(0);
      setAdDragOffsetY(0);
    }
  };

  const advanceCard = () => {
    setAnimKey(k => k + 1);
    setProfileIdx(i => i + 1);
    setPioneerTipOpen(false);
    setExpandedTag(null);
    setSwipedCount(c => {
      const next = c + 1;
      if (next % 7 === 0 && liveAd) {
        setShowingAd(true);
      }
      return next;
    });
  };

  const handleRoam = () => {
    if (!profile) return;
    if (!user) {
      showToast("Sign up free to connect with adventurers like " + profile.name + " →");
      setTimeout(() => navigate("/signup"), 1800);
      return;
    }
    pendingMatchRef.current = {
      name: profile.name,
      hero: profile.hero,
      sharedTags: profile.dna.slice(0, 4),
      almostMet: profile.almostMet,
    };
    roamMutation.mutate(profile.id);
  };

  const resetDrag = () => {
    setDragOffset(0);
    setDragOffsetY(0);
    dragStartX.current = null;
    dragStartY.current = null;
  };

  const triggerExit = (dir: "up" | "left" | "right", action: "advance" | "roam") => {
    setExitDir(dir);
    setDragOffset(0);
    setDragOffsetY(0);
    dragStartX.current = null;
    dragStartY.current = null;
    if (action === "roam") handleRoam();
    setTimeout(() => {
      if (action === "advance") advanceCard();
      else advanceCard();
      setExitDir(null);
    }, 320);
  };

  const evaluateGesture = () => {
    const absX = Math.abs(dragOffset);
    const absY = Math.abs(dragOffsetY);
    if (absY > absX && dragOffsetY < -80) {
      triggerExit("up", "advance");
    } else if (absX > absY) {
      if (dragOffset > 80) triggerExit("right", "roam");
      else if (dragOffset < -80) triggerExit("left", "advance");
      else resetDrag();
    } else {
      resetDrag();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (exitDir) return;
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (exitDir || dragStartX.current === null) return;
    setDragOffset(e.touches[0].clientX - dragStartX.current);
    if (dragStartY.current !== null) setDragOffsetY(e.touches[0].clientY - dragStartY.current);
  };
  const handleTouchEnd = () => {
    if (exitDir) return;
    evaluateGesture();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (exitDir) return;
    isMouseDown.current = true;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (exitDir || !isMouseDown.current || dragStartX.current === null) return;
    setDragOffset(e.clientX - dragStartX.current);
    if (dragStartY.current !== null) setDragOffsetY(e.clientY - dragStartY.current);
  };
  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    if (exitDir) return;
    evaluateGesture();
  };
  const handleMouseLeave = () => {
    if (isMouseDown.current) {
      isMouseDown.current = false;
      if (!exitDir) evaluateGesture();
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden" data-testid="page-discover"
         style={{ background: "var(--roam-forest)" }}>

      <AppNav />

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl font-mono text-[11px] tracking-wider animate-fade-up shadow-lg"
             style={{ top: "74px", background: "var(--roam-electric)", color: "var(--roam-forest)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {showingAd && liveAd && (
        <div className="absolute inset-0 z-30" style={{ padding: "16px 16px 90px" }}>
          <AdCard
            ad={liveAd}
            onDismiss={dismissAd}
            dragOffset={adDragOffset}
            dragOffsetY={adDragOffsetY}
            exitDir={adExitDir}
            onDragMove={(dx, dy) => { setAdDragOffset(dx); setAdDragOffsetY(dy); }}
            onDragEnd={evaluateAdGesture}
          />
        </div>
      )}

      {loadingUsers && user && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <Compass size={32} style={{ color: "var(--roam-electric)", opacity: 0.5, animation: "spin 2s linear infinite" }} />
            <div className="font-mono text-[11px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Finding adventurers…</div>
          </div>
        </div>
      )}

      {(deckExhausted || noUsersYet) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-8 text-center">
          <Compass size={52} style={{ color: "var(--roam-electric)", marginBottom: 20, opacity: 0.7 }} />
          <div className="font-serif text-[26px] font-black mb-3 leading-tight" style={{ color: "rgba(var(--roam-cream-rgb),0.95)" }}>
            {noUsersYet ? "You're first here!" : "All caught up"}
          </div>
          <div className="font-mono text-[11px] leading-relaxed max-w-[260px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
            {noUsersYet
              ? "No other adventurers yet — share roam. to grow the community and discover your first match"
              : "You've seen everyone for now. More adventurers are joining every day — check back soon."}
          </div>
          {deckExhausted && (
            <button
              className="mt-6 px-5 py-2.5 rounded-2xl font-mono text-[11px] tracking-wider"
              style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}
              onClick={() => setProfileIdx(0)}
              data-testid="button-restart-deck">
              Start over
            </button>
          )}
        </div>
      )}

      {!deckExhausted && !noUsersYet && profile && (
      <div key={cardKey}
           className="absolute inset-0"
           style={{
             userSelect: "none",
             zIndex: 10,
             cursor: isMouseDown.current ? "grabbing" : "grab",
             transform: exitDir === "up"
               ? "translateY(-115vh)"
               : exitDir === "left"
                 ? "translateX(-115vw) rotate(-12deg)"
                 : exitDir === "right"
                   ? "translateX(115vw) rotate(12deg)"
                   : `translate(${dragOffset * 0.55}px, ${Math.min(0, dragOffsetY * 0.45)}px) rotate(${dragOffset * 0.018}deg)`,
             transition: exitDir
               ? "transform 0.32s cubic-bezier(0.4,0,0.2,1)"
               : dragOffset === 0 && dragOffsetY === 0
                 ? "transform 0.28s cubic-bezier(0.34,1.56,0.64,1)"
                 : "none",
             animation: !exitDir ? "fadeUp 0.35s ease-out both" : undefined,
           }}
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseLeave}
           onContextMenu={e => e.preventDefault()}>

        <img src={profile.hero} alt={profile.name}
             className="absolute inset-0 w-full h-full object-cover transition-transform duration-[6s] ease-out"
             draggable={false} style={{ pointerEvents: "none" }} />

        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.1) 58%, transparent 72%)" }} />

        {dragOffset > 20 && (
          <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none"
               style={{ background: `rgba(var(--roam-electric-rgb),${Math.min(0.28, dragOffset / 300)})` }}>
            <div className="font-serif text-[52px] font-black tracking-tight rotate-12"
                 style={{ color: "var(--roam-electric)", opacity: Math.min(1, dragOffset / 80), textShadow: "0 2px 24px rgba(0,0,0,0.8)" }}>
              ROAM ✦
            </div>
          </div>
        )}
        {dragOffset < -20 && (
          <div className="absolute inset-0 flex items-center justify-start pl-8 pointer-events-none"
               style={{ background: `rgba(var(--roam-ember-rgb),${Math.min(0.28, Math.abs(dragOffset) / 300)})` }}>
            <div className="font-serif text-[52px] font-black tracking-tight -rotate-12"
                 style={{ color: "var(--roam-ember)", opacity: Math.min(1, Math.abs(dragOffset) / 80), textShadow: "0 2px 24px rgba(0,0,0,0.8)" }}>
              PASS
            </div>
          </div>
        )}
        {dragOffsetY < -20 && Math.abs(dragOffsetY) > Math.abs(dragOffset) && (
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-20 pointer-events-none"
               style={{ background: `rgba(0,0,0,${Math.min(0.22, Math.abs(dragOffsetY) / 320)})` }}>
            <div style={{ opacity: Math.min(1, Math.abs(dragOffsetY) / 80) }}>
              <div className="font-mono text-[11px] tracking-[2px] uppercase" style={{ color: "rgba(255,255,255,0.65)" }}>▲ next</div>
            </div>
          </div>
        )}

        <div className="absolute flex flex-col items-end gap-5" style={{ top: "80px", right: "14px" }}>
          {isVerifiedUser && (
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                    style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(var(--roam-electric-rgb),0.42)" }}
                    onClick={() => navigate("/profile")}
                    data-testid="badge-verified">
              <span className="font-mono text-[11px] font-bold" style={{ color: "var(--roam-electric)" }}>✓</span>
              <span className="font-mono text-[8px] tracking-wider" style={{ color: "rgba(255,255,255,0.8)" }}>verified</span>
            </button>
          )}

          {profile.hasNewMatch && (
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                    style={{ background: "rgba(0,0,0,0.55)", border: "1.5px solid rgba(var(--roam-electric-rgb),0.85)", animation: "pulse 2s infinite" }}
                    onClick={() => navigate("/matches")}
                    data-testid="badge-new-match">
              <span style={{ fontSize: "10px", color: "var(--roam-electric)" }}>✦</span>
              <span className="font-mono text-[9px] tracking-wider font-bold" style={{ color: "var(--roam-electric)" }}>new match!</span>
            </button>
          )}

          {profile.pioneerBadge && (
            <div className="relative">
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md transition-all"
                      style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(var(--roam-electric-rgb),0.42)" }}
                      onClick={() => setPioneerTipOpen(o => !o)}
                      data-testid="badge-pioneer">
                <span style={{ fontSize: "12px" }}>🏔️</span>
                <div>
                  <div className="font-mono text-[7px] tracking-[1px] uppercase leading-none mb-0.5" style={{ color: "var(--roam-electric)" }}>Pioneer</div>
                  <div className="font-semibold text-[10px] leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>{profile.pioneerBadge.place}</div>
                </div>
              </button>
              {pioneerTipOpen && (
                <div className="absolute top-full mt-2 right-0 w-52 rounded-2xl p-3.5 shadow-2xl z-20"
                     style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}
                     data-testid="tooltip-pioneer">
                  <div className="font-mono text-[8px] tracking-[1px] uppercase mb-1.5" style={{ color: "var(--roam-electric)" }}>🏔️ Regional Pioneer</div>
                  <div className="text-[13px] font-semibold mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.95)" }}>{profile.pioneerBadge.place}</div>
                  <div className="text-[11px] leading-relaxed mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                    First to consistently tag this location — most posts from any single adventurer here.
                  </div>
                  <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                    {profile.pioneerBadge.tagCount} posts · {profile.pioneerBadge.location}
                  </div>
                </div>
              )}
            </div>
          )}

          {profile.almostMet && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                 style={{ background: "rgba(var(--roam-violet-rgb),0.18)", border: "1px solid rgba(var(--roam-violet-rgb),0.45)" }}
                 data-testid="badge-almost-met">
              <span style={{ fontSize: "11px" }}>👻</span>
              <div>
                <div className="font-mono text-[7px] tracking-widest uppercase leading-none mb-0.5" style={{ color: "rgba(var(--roam-violet-rgb),0.9)" }}>Almost Met</div>
                <div className="font-mono text-[8px] leading-none" style={{ color: "rgba(255,255,255,0.6)" }}>{profile.almostMet.location}</div>
              </div>
            </div>
          )}

        </div>

        <div className="absolute left-0 right-0 px-5" style={{ bottom: "144px" }}>
          <div className="flex items-baseline gap-2.5 mb-2">
            <h2 className="font-serif text-[38px] font-black leading-none tracking-tight"
                style={{ color: "rgba(255,255,255,0.97)" }}
                data-testid="text-card-name">
              {profile.name}
            </h2>
            <span className="font-serif text-[24px] font-light" style={{ color: "rgba(255,255,255,0.52)" }}>{profile.age}</span>
          </div>
          <p className="text-[13px] italic leading-snug" style={{ color: "rgba(255,255,255,0.62)" }}>"{profile.tagline}"</p>
        </div>

        <div className="absolute left-0 right-0 px-4" style={{ bottom: "78px" }}>
          <div className="flex flex-wrap gap-2" data-testid="dna-tags-row">
            {profile.dna.map(tag => {
              const isOpen = expandedTag === tag;
              return (
                <button
                  key={tag}
                  className="flex items-center backdrop-blur-md rounded-xl transition-all duration-200"
                  style={{
                    background: "rgba(0,0,0,0.48)",
                    border: `1px solid ${isOpen ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.18)"}`,
                    padding: "6px 8px",
                    gap: isOpen ? "5px" : "0px",
                  }}
                  onMouseEnter={() => setExpandedTag(tag)}
                  onMouseLeave={() => setExpandedTag(null)}
                  onPointerDown={e => { e.stopPropagation(); setExpandedTag(isOpen ? null : tag); }}
                  data-testid={`tag-${tag.replace(/\s+/g, "-")}`}
                >
                  <span style={{ color: "rgba(255,255,255,0.82)", display: "flex", alignItems: "center" }}>
                    {tagIcon(tag)}
                  </span>
                  <span
                    className="font-mono text-[9px] tracking-wider whitespace-nowrap overflow-hidden"
                    style={{
                      maxWidth: isOpen ? "110px" : "0px",
                      opacity: isOpen ? 1 : 0,
                      transition: "max-width 0.2s ease, opacity 0.15s ease",
                      color: "rgba(255,255,255,0.86)",
                    }}
                  >
                    {tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {matchCelebration && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
             style={{ background: "rgba(var(--roam-forest-rgb),0.97)", backdropFilter: "blur(24px)" }}
             data-testid="match-celebration">
          <div className="w-full max-w-sm px-6 flex flex-col items-center animate-fade-up">
            <div className="font-mono text-[10px] tracking-[3px] uppercase mb-3" style={{ color: "var(--roam-electric)" }}>
              ✦ adventure unlocked ✦
            </div>
            <div className="font-serif text-[40px] font-black tracking-tight leading-none mb-1" style={{ color: "var(--roam-cream)" }}>
              It's a match!
            </div>
            <div className="font-mono text-[11px] mb-8" style={{ color: "rgba(var(--roam-cream-rgb),0.42)" }}>
              You and {matchCelebration.name} both want to roam
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-28 h-36 rounded-2xl overflow-hidden border-2"
                   style={{ borderColor: "rgba(var(--roam-electric-rgb),0.4)" }}>
                <div className="w-full h-full flex items-center justify-center font-serif text-2xl"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.08)", color: "rgba(var(--roam-cream-rgb),0.3)" }}>you</div>
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
                <div className="font-mono text-[9px] tracking-wider uppercase mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>👻 almost met</div>
                <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                  You were both near {matchCelebration.almostMet.location} — {matchCelebration.almostMet.dateHint}
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
                    style={{ color: "rgba(var(--roam-cream-rgb),0.32)" }}
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
