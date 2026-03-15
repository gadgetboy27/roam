import { useState } from "react";
import AppNav from "@/components/app-nav";
import { MapPin, Bookmark, BookmarkCheck, Heart, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const DEMO_PROFILES = [
  {
    id: "demo-p1",
    name: "Mia", age: 28,
    ethnicity: "New Zealander",
    tagline: "Chasing elevation, good coffee and anything with a summit",
    hero: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop",
    dna: ["alpine hiking", "rock climbing", "night markets"],
  },
  {
    id: "demo-p2",
    name: "Kai", age: 31,
    ethnicity: "Māori",
    tagline: "Lost in alleyways, found in barrels",
    hero: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop",
    dna: ["surfing", "night markets", "urban roaming"],
  },
  {
    id: "demo-p3",
    name: "Sam", age: 26,
    ethnicity: "Pacific Islander",
    tagline: "Every forest has a path worth getting lost on",
    hero: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop",
    dna: ["backpacking", "kayaking", "forest trails"],
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
      if (data?.isNewMatch) {
        showToast("🎉 It's a match! You can now message each other");
      } else {
        showToast("✓ Adventure request sent!");
      }
      setTimeout(() => {
        setAnimKey(k => k + 1);
        setProfileIdx(i => i + 1);
        setSelectedBucket(null);
      }, data?.isNewMatch ? 1800 : 700);
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handlePass = () => {
    setAnimKey(k => k + 1);
    setProfileIdx(i => i + 1);
    setSelectedBucket(null);
  };

  const handleRoam = () => {
    if (!user) return;
    const targetId = selectedBucket ? `bucket-${selectedBucket.name}` : profile.id;
    roamMutation.mutate(targetId);
  };

  const handleBucketClick = (b: typeof BUCKET_LIST[0]) => {
    if (selectedBucket?.name === b.name) {
      setSelectedBucket(null);
    } else {
      setSelectedBucket(b);
      setBucketAnimKey(k => k + 1);
    }
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
  const cardKey = selectedBucket ? `bucket-${selectedBucket.name}-${bucketAnimKey}` : `profile-${animKey}`;

  const currentTargetId = selectedBucket ? `bucket-${selectedBucket.name}` : profile.id;
  const alreadyRoamed = roamedIds.has(currentTargetId);

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
        <div className="max-w-lg mx-auto pb-8">
          <div key={cardKey} className="animate-fade-up">
            <div className="mx-3.5 mt-4 rounded-[28px] overflow-hidden"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(242,237,227,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
              <div className="relative h-[380px] overflow-hidden" style={{ userSelect: "none" }}>
                <img src={displayHero} alt={displayName}
                     className="w-full h-full object-cover transition-transform duration-[6s] ease-out hover:scale-[1.04]"
                     draggable={false} onContextMenu={e => e.preventDefault()} style={{ pointerEvents: "none" }} />
                <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(14,26,13,0.97) 0%, rgba(14,26,13,0.45) 55%, transparent 100%)" }} />

                {selectedBucket && (
                  <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md"
                       style={{ background: "rgba(14,26,13,0.7)", border: "1px solid rgba(125,184,212,0.35)" }}>
                    <MapPin size={10} style={{ color: "var(--roam-sky)" }} />
                    <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--roam-sky)" }}>
                      also wants {selectedBucket.name}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-baseline gap-2.5 mb-1">
                    <h2 className="font-serif text-[34px] font-black leading-none tracking-tight"
                        data-testid="text-card-name">
                      {displayName}
                    </h2>
                    <span className="font-serif text-[22px] font-light" style={{ color: "var(--roam-sand)" }}>{displayAge}</span>
                  </div>
                  <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3"
                        style={{ background: "rgba(200,230,74,0.12)", border: "1px solid rgba(200,230,74,0.35)", color: "var(--roam-electric)" }}
                        data-testid="text-card-ethnicity">
                    {displayEthnicity}
                  </span>
                  <p className="text-[13px] italic leading-snug mb-3" style={{ color: "rgba(242,237,227,0.7)" }}>"{displayTagline}"</p>
                  {displayDna.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {displayDna.map(t => (
                        <span key={t} className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-lg"
                              style={{ background: "rgba(14,26,13,0.7)", border: "1px solid rgba(200,230,74,0.25)", color: "var(--roam-electric)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 pt-4">
                <div className="flex gap-2.5">
                  <button className="flex-none w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(242,237,227,0.5)" }}
                          onClick={handlePass}
                          data-testid="button-pass">
                    <X size={18} />
                  </button>
                  <button className="flex-1 py-3.5 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{
                            background: alreadyRoamed ? "rgba(200,230,74,0.2)" : "var(--roam-electric)",
                            color: alreadyRoamed ? "var(--roam-electric)" : "var(--roam-forest)",
                            border: alreadyRoamed ? "1px solid rgba(200,230,74,0.4)" : "none",
                          }}
                          onClick={handleRoam}
                          disabled={roamMutation.isPending || alreadyRoamed}
                          data-testid="button-roam">
                    {alreadyRoamed ? (
                      <><Heart size={14} fill="currentColor" /> Requested!</>
                    ) : roamMutation.isPending ? (
                      "Sending…"
                    ) : (
                      <>Roam Together</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 px-3.5 animate-fade-up-1">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(242,237,227,0.35)" }}>
                Bucket list matches near you
              </div>
              {savedBucketList.length > 0 && (
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(200,230,74,0.1)", border: "1px solid rgba(200,230,74,0.25)", color: "var(--roam-electric)" }}>
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
                         border: isSelected ? "2px solid var(--roam-electric)" : pinned ? "2px solid rgba(125,184,212,0.5)" : "1px solid rgba(242,237,227,0.07)",
                         transform: isSelected ? "scale(1.03)" : "scale(1)",
                       }}
                       onClick={() => handleBucketClick(b)}
                       data-testid={`bucket-${b.name.replace(/\s+/g, "-")}`}>
                    <img src={b.url} alt={b.name} className="w-[120px] h-[120px] object-cover" loading="lazy" />
                    <div className="absolute inset-0 flex flex-col justify-end p-2"
                         style={{ background: "linear-gradient(to top, rgba(14,26,13,0.9) 0%, transparent 55%)" }}>
                      <div className="text-[11px] font-semibold leading-tight">{b.name}</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "var(--roam-sky)" }}>{b.want}</div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 font-mono text-[8px] font-medium px-1.5 py-0.5 rounded-lg"
                         style={{ background: isSelected ? "var(--roam-electric)" : "rgba(200,230,74,0.8)", color: "var(--roam-forest)" }}>
                      {b.count}x
                    </div>
                    <button className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                            style={{
                              background: pinned ? "rgba(125,184,212,0.25)" : "rgba(14,26,13,0.7)",
                              border: pinned ? "1px solid rgba(125,184,212,0.5)" : "1px solid rgba(242,237,227,0.2)",
                            }}
                            onClick={e => handlePinToggle(e, b)}
                            data-testid={`pin-${b.name.replace(/\s+/g, "-")}`}>
                      {pinned
                        ? <BookmarkCheck size={11} style={{ color: "var(--roam-sky)" }} />
                        : <Bookmark size={11} style={{ color: "rgba(242,237,227,0.6)" }} />}
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedBucket && (
              <p className="font-mono text-[9px] tracking-wider mt-2 text-center animate-fade-up"
                 style={{ color: "rgba(242,237,227,0.3)" }}>
                tap again to clear · tap another destination to switch
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
