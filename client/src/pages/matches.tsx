import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import {
  Send, ArrowLeft, WifiOff, Clock, MapPin,
  Bookmark, Compass, Flame, MessageCircle, Hourglass, Zap, ShieldCheck,
  Plus, X, ImagePlus, Loader2
} from "lucide-react";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fileToDataUrl } from "@/lib/file";
import { useCrewUp } from "@/lib/useCrewUp";
import { Tent } from "lucide-react";
import {
  supabase, fetchMessages, sendSupabaseMessage, markMessagesRead,
  setTyping, subscribeToMessages, subscribeToTyping,
  type SupabaseMessage,
} from "@/lib/supabase";
import {
  getCachedMessages, appendCachedMessage, cacheMessages,
  enqueuePending, loadPendingQueue, clearPendingQueue,
  type CachedMessage,
} from "@/lib/messageCache";

const BUCKET_LIST = [
  { name: "Faroe Islands", want: "3 matches want this", url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&q=80&fit=crop", count: 3 },
  { name: "Patagonia", want: "7 matches want this", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=80&fit=crop", count: 7 },
  { name: "Kyoto autumn", want: "12 matches want this", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300&q=80&fit=crop", count: 12 },
  { name: "Iceland", want: "5 matches want this", url: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=300&q=80&fit=crop", count: 5 },
  { name: "Lofoten", want: "2 matches want this", url: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=300&q=80&fit=crop", count: 2 },
];

function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
}

function formatDay(d: Date | string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short" });
}

type MomentumState = "say-hi" | "your-turn" | "their-turn";
function getMomentum(msgs: CachedMessage[], myId: string): MomentumState {
  if (!msgs.length) return "say-hi";
  const last = msgs[msgs.length - 1];
  if (last.senderId === myId) return "their-turn";
  return "your-turn";
}

// Compact relative time for inbox rows ("2h", "3d", "now").
function shortAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "now";
}

function MomentumBadge({ state, compact = false }: { state: MomentumState; compact?: boolean }) {
  const sz = compact ? "text-[9px]" : "text-[10px]";
  const icon = compact ? 9 : 11;
  if (state === "say-hi") return (
    <div className={`flex items-center gap-1 font-mono tracking-wider ${sz}`} style={{ color: "var(--roam-electric)" }}>
      <Compass size={icon} /><span>Say hi →</span>
    </div>
  );
  if (state === "your-turn") return (
    <div className={`flex items-center gap-1 font-mono tracking-wider ${sz}`} style={{ color: "#f59e0b" }}>
      <Flame size={icon} /><span>Your turn →</span>
    </div>
  );
  return (
    <div className={`flex items-center gap-1 font-mono tracking-wider ${sz}`} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
      <MessageCircle size={icon} /><span>Their turn…</span>
    </div>
  );
}

function sbToCache(msg: SupabaseMessage): CachedMessage {
  return {
    id: msg.id,
    matchId: msg.match_id,
    senderId: msg.sender_id,
    content: msg.content,
    createdAt: msg.created_at,
  };
}

function groupByDay(msgs: CachedMessage[]) {
  const groups: { day: string; messages: CachedMessage[] }[] = [];
  msgs.forEach(msg => {
    const day = formatDay(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.messages.push(msg);
    else groups.push({ day, messages: [msg] });
  });
  return groups;
}

export default function Matches() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const myId = user?.id ?? "demo-user";
  const crewUp = useCrewUp();

  const { data: bucketList = [] } = useQuery<{ id: string; destinationName: string; imageUrl: string | null }[]>({
    queryKey: ["/api/bucket-list", user?.id],
    enabled: !!user,
  });
  const { data: dbMatches = [] } = useQuery<any[]>({
    queryKey: ["/api/matches"],
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const usersById = useMemo(() => {
    const map: Record<string, any> = {};
    allUsers.forEach(u => { map[u.id] = u; });
    return map;
  }, [allUsers]);

  const realConnections = useMemo(() => {
    return dbMatches
      .filter((m: any) => m.status === "matched")
      .map((m: any) => {
        const partnerId = m.userAId === user?.id ? m.userBId : m.userAId;
        const partner = usersById[partnerId];
        if (!partner) return null;
        const age = partner.dob
          ? Math.floor((Date.now() - new Date(partner.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
          : null;
        const sharedTags: string[] = m.sharedTags || [];
        const opener = sharedTags.length > 0
          ? `You're both into ${sharedTags[0]} — what's been your best experience?`
          : `Hey ${partner.name}, where's your next adventure headed?`;
        const matchedAt = m.matchedAt ? new Date(m.matchedAt) : new Date(m.createdAt);
        const hoursAgo = Math.floor((Date.now() - matchedAt.getTime()) / 3600000);
        const when = hoursAgo < 1 ? "Matched just now"
          : hoursAgo < 24 ? `Matched ${hoursAgo}h ago`
          : hoursAgo < 48 ? "Matched yesterday"
          : `Matched ${Math.floor(hoursAgo / 24)}d ago`;
        return {
          id: m.id as string,
          partnerId: partnerId as string,
          name: partner.name as string,
          nameAge: age ? `${partner.name}, ${age}` : (partner.name as string),
          verified: !!partner.identityVerified,
          shared: sharedTags,
          when,
          img: (partner.avatarUrl || "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=150&q=80&fit=crop") as string,
          opener,
          seed: [] as CachedMessage[],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [dbMatches, user, usersById]);

  const connections = realConnections;
  const hasConnections = connections.length > 0;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, CachedMessage[]>>({});
  const [inputVal, setInputVal] = useState("");
  const [theirTyping, setTheirTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [openerUsed, setOpenerUsed] = useState<Record<string, boolean>>({});
  const [sbReady, setSbReady] = useState(false);

  // Inbox summary — latest message + unread count per conversation, for the
  // list (recency ordering, preview, unread badges). See /api/conversations/summary.
  const { data: inboxSummary = [] } = useQuery<
    { matchId: string; content: string; senderId: string; createdAt: string; unread: number }[]
  >({
    queryKey: ["/api/conversations/summary"],
    enabled: !!user,
    refetchInterval: 30000,
  });
  const summaryByMatch = useMemo(() => {
    const map: Record<string, { content: string; senderId: string; createdAt: string; unread: number }> = {};
    for (const s of inboxSummary) map[s.matchId] = s;
    return map;
  }, [inboxSummary]);

  // Most-recent conversations first (live cache wins over summary); connections
  // with no messages yet fall to the bottom.
  const sortedConnections = useMemo(() => {
    const at = (c: any) => {
      const live = conversations[c.id];
      const liveLast = live && live.length ? live[live.length - 1] : null;
      const ts = liveLast?.createdAt ?? summaryByMatch[c.id]?.createdAt ?? null;
      return ts ? new Date(ts).getTime() : 0;
    };
    return [...connections].sort((a, b) => at(b) - at(a));
  }, [connections, conversations, summaryByMatch]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const connectionStatus = useConnectionStatus();
  const isOnline = connectionStatus === "online";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dream destinations: add / upload / remove ──────────────────────────────
  const [showAddDest, setShowAddDest] = useState(false);
  const [newDestName, setNewDestName] = useState("");
  const [destImage, setDestImage] = useState<{ preview: string; dataUrl: string } | null>(null);
  const destFileRef = useRef<HTMLInputElement>(null);

  const pickDestImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Image too large", description: "Please use a photo under 8 MB.", variant: "destructive" }); return; }
    try { setDestImage({ preview: URL.createObjectURL(file), dataUrl: await fileToDataUrl(file) }); }
    catch { toast({ title: "Couldn't read that image", variant: "destructive" }); }
  };

  const addDestMutation = useMutation({
    mutationFn: async ({ name, dataUrl, imageUrl }: { name: string; dataUrl?: string; imageUrl?: string }) => {
      let finalImageUrl = imageUrl;
      if (dataUrl) {
        const up = await apiRequest("POST", "/api/bucket-list/image", { dataUrl });
        finalImageUrl = (await up.json()).url;
      }
      const res = await apiRequest("POST", "/api/bucket-list", { destinationName: name, imageUrl: finalImageUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bucket-list", user?.id] });
      setShowAddDest(false); setNewDestName(""); setDestImage(null);
      toast({ title: "Destination pinned", description: "Matches who share it will be highlighted." });
    },
    onError: (e: any) => toast({ title: "Couldn't add destination", description: e?.message?.replace(/^\d+:\s*/, "") || "Please try again.", variant: "destructive" }),
  });

  const removeDestMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bucket-list/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bucket-list", user?.id] }),
    onError: (e: any) => toast({ title: "Couldn't remove destination", description: e?.message?.replace(/^\d+:\s*/, "") || "Please try again.", variant: "destructive" }),
  });

  const submitDest = () => {
    const name = newDestName.trim();
    if (!name) { toast({ title: "Give your destination a name", variant: "destructive" }); return; }
    addDestMutation.mutate({ name, dataUrl: destImage?.dataUrl });
  };

  const quickAddPreset = (name: string, imageUrl: string) => {
    if (bucketList.some(bl => bl.destinationName.trim().toLowerCase() === name.toLowerCase())) return;
    addDestMutation.mutate({ name, imageUrl });
  };

  const selectedMatch = connections.find(m => m.id === selectedId);
  const messages = selectedId ? (conversations[selectedId] ?? []) : [];

  const waitingMatches = dbMatches.filter((m: any) =>
    (m.status === "liked_a" && m.userAId === user?.id) ||
    (m.status === "liked_b" && m.userBId === user?.id)
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, theirTyping]);

  useEffect(() => {
    if (!selectedId) return;
    setTheirTyping(false);

    if (!sbReady) {
      const cached = getCachedMessages(selectedId);
      if (cached.length > 0) {
        setConversations(prev => ({ ...prev, [selectedId]: cached }));
      }
    }

    fetchMessages(selectedId).then(rows => {
      if (rows.length > 0) {
        setSbReady(true);
        const msgs = rows.map(sbToCache);
        setConversations(prev => ({ ...prev, [selectedId]: msgs }));
        cacheMessages(selectedId, msgs);
        if (user) markMessagesRead(selectedId, myId);
      }
    });

    const msgSub = subscribeToMessages(selectedId, (newMsg) => {
      if (newMsg.sender_id === myId) return;
      const cached = sbToCache(newMsg);
      setConversations(prev => {
        const existing = prev[selectedId] ?? [];
        const updated = [...existing.filter(m => m.id !== newMsg.id), cached];
        appendCachedMessage(selectedId, cached);
        return { ...prev, [selectedId]: updated };
      });
      setTheirTyping(false);
    });

    const typSub = subscribeToTyping(selectedId, myId, (isTyping) => {
      setTheirTyping(isTyping);
      if (isTyping) {
        if (typingTimeout) clearTimeout(typingTimeout);
        const t = setTimeout(() => setTheirTyping(false), 4000);
        setTypingTimeout(t);
      }
    });

    channelRef.current = msgSub as any;
    typingChannelRef.current = typSub as any;

    const pending = loadPendingQueue().filter(m => m.matchId === selectedId);
    if (pending.length > 0 && isOnline) {
      pending.forEach(async msg => {
        const sent = await sendSupabaseMessage(msg.matchId, msg.senderId, msg.content);
        if (sent) {
          setConversations(prev => {
            const updated = (prev[selectedId] ?? []).map(m =>
              m.id === msg.id ? { ...sbToCache(sent) } : m
            );
            return { ...prev, [selectedId]: updated };
          });
        }
      });
      clearPendingQueue();
    }

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current as any);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current as any);
      setTyping(selectedId, myId, false);
    };
  }, [selectedId]);

  const handleTyping = (val: string) => {
    setInputVal(val);
    if (!selectedId || !user) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    setTyping(selectedId, myId, true);
    typingDebounceRef.current = setTimeout(() => {
      setTyping(selectedId!, myId, false);
    }, 2500);
  };

  const sendMessage = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? inputVal).trim();
    if (!content || !selectedId) return;
    setInputVal("");

    const tempId = `temp-${Date.now()}`;
    const tempMsg: CachedMessage = {
      id: tempId, matchId: selectedId, senderId: myId,
      content, createdAt: new Date().toISOString(), pending: !isOnline,
    };

    setConversations(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] ?? []), tempMsg] }));
    setTyping(selectedId, myId, false);

    if (isOnline) {
      const sent = await sendSupabaseMessage(selectedId, myId, content);
      if (sent) {
        const real = sbToCache(sent);
        setConversations(prev => {
          const updated = (prev[selectedId] ?? []).map(m => m.id === tempId ? real : m);
          cacheMessages(selectedId, updated);
          return { ...prev, [selectedId]: updated };
        });
      }
    } else {
      enqueuePending(tempMsg);
      appendCachedMessage(selectedId, tempMsg);
    }
  }, [inputVal, selectedId, myId, isOnline]);

  const useOpener = () => {
    if (!selectedMatch || !selectedId) return;
    setOpenerUsed(prev => ({ ...prev, [selectedId]: true }));
    sendMessage(selectedMatch.opener);
  };

  const openChat = (id: string) => {
    setSelectedId(id);
    setSbReady(false);
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const offlineBanner = () => {
    if (connectionStatus === "offline") return (
      <div className="mx-3.5 mb-3 rounded-xl px-3 py-2 flex items-center gap-2"
           style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.25)" }}>
        <WifiOff size={12} style={{ color: "var(--roam-ember)" }} />
        <span className="font-mono text-[10px]" style={{ color: "rgba(232,98,26,0.85)" }}>Offline — viewing cached messages</span>
      </div>
    );
    return null;
  };

  return (
    <div className="min-h-screen relative" data-testid="page-matches">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-8 pr-14">

          {!selectedId ? (
            <>
              <div className="px-4 pt-6 pb-4 animate-fade-up">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  mutual roamers
                </div>
                <h1 className="font-serif text-[28px] font-black leading-[1.05]" data-testid="text-match-count">
                  {realConnections.length} adventurers
                </h1>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  {hasConnections
                    ? "You share adventure DNA with these people. Start planning."
                    : "No connections yet — match in Discover to find your people."}
                </p>
              </div>

              {offlineBanner()}

              <div className="px-3.5 space-y-2" data-testid="connections-list">
                {!hasConnections && (
                  <div className="text-center py-10 px-6">
                    <Compass size={36} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.15)" }} />
                    <p className="font-serif text-[16px] font-bold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>No connections yet</p>
                    <p className="font-mono text-[11px] mb-5 leading-relaxed max-w-[240px] mx-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                      Roam in Discover to connect with adventurers — then message and plan trips right here.
                    </p>
                    <button onClick={() => navigate("/discover")}
                            className="font-mono text-[11px] px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5"
                            style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                            data-testid="matches-empty-discover">
                      Find adventurers →
                    </button>
                  </div>
                )}
                {sortedConnections.map((m, i) => {
                  const msgs = conversations[m.id] ?? [];
                  const liveLast = msgs[msgs.length - 1] ?? null;
                  const sum = summaryByMatch[m.id];
                  const lastContent = liveLast?.content ?? sum?.content ?? null;
                  const lastSenderId = liveLast?.senderId ?? sum?.senderId ?? null;
                  const lastAt = liveLast?.createdAt ?? sum?.createdAt ?? null;
                  const unread = m.id !== selectedId ? (sum?.unread ?? 0) : 0;
                  const hasPending = msgs.some(msg => msg.pending);
                  const momentum = getMomentum(msgs, myId);
                  return (
                    <div key={m.id}
                         className="rounded-[22px] p-3.5 flex gap-3 items-center transition-all animate-fade-up cursor-pointer"
                         style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)", animationDelay: `${i * 0.07}s` }}
                         onClick={() => openChat(m.id)}
                         data-testid={`match-row-${m.id}`}>
                      <div className="relative flex-shrink-0">
                        <div className="w-[58px] h-[58px] rounded-xl overflow-hidden relative">
                          <img src={m.img} alt={m.nameAge}
                               className="w-full h-full object-cover"
                               loading="lazy" />
                        </div>
                        {hasPending && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                               style={{ background: "rgba(245,158,11,0.9)" }}>
                            <Clock size={8} style={{ color: "white" }} />
                          </div>
                        )}
                        {momentum === "your-turn" && !hasPending && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full"
                               style={{ background: "#f59e0b", boxShadow: "0 0 6px rgba(245,158,11,0.7)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base flex items-center gap-1.5"
                             style={{ fontWeight: unread > 0 ? 800 : 600, color: unread > 0 ? "var(--roam-cream)" : undefined }}
                             data-testid={`text-match-name-${m.id}`}>
                          {m.nameAge}
                          {m.verified && (
                            <span className="flex items-center gap-0.5 font-mono text-[8px] tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}
                                  title="ID verified">
                              <ShieldCheck size={9} /> ID
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
                          {m.shared.map(t => (
                            <span key={t} className="font-mono text-[8px] tracking-wider px-1.5 py-0.5 rounded-md"
                                  style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        {lastContent ? (
                          <div className="text-[11px] truncate"
                               style={{ color: unread > 0 ? "rgba(var(--roam-cream-rgb),0.85)" : "rgba(var(--roam-cream-rgb),0.45)", fontWeight: unread > 0 ? 600 : 400 }}>
                            {lastSenderId === myId && <span style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>You: </span>}
                            {lastContent}
                          </div>
                        ) : (
                          <div className="text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{m.when}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                          {lastAt && (
                            <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{shortAgo(lastAt)}</span>
                          )}
                          {unread > 0 && (
                            <span className="min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-mono text-[9px] font-bold"
                                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                                  data-testid={`unread-${m.id}`}>
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </div>
                        <MomentumBadge state={momentum} />
                        {/* Primary: tapping the row opens the 1:1 chat — this icon signals that */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                             style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}
                             aria-hidden="true">
                          <MessageCircle size={16} />
                        </div>
                        {/* Secondary: escalate this connection into a private squad (group + campsite) */}
                        {(m as any).partnerId && (
                          <button
                            onClick={e => { e.stopPropagation(); crewUp.mutate({ id: (m as any).partnerId, name: m.name }); }}
                            disabled={crewUp.isPending}
                            className="flex items-center gap-1 text-[10px] font-mono transition-all active:scale-95 disabled:opacity-50"
                            style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}
                            title="Start a private squad you can add more people to"
                            data-testid={`button-crew-up-${m.id}`}>
                            <Tent size={11} /> Start squad
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {waitingMatches.length > 0 && (
                <div className="px-3.5 mt-5 animate-fade-up">
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2.5 flex items-center gap-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                    <Hourglass size={10} />
                    Waiting to roam back ({waitingMatches.length})
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {waitingMatches.map((m: any) => (
                      <div key={m.id} className="flex-shrink-0 rounded-2xl p-3 flex flex-col items-center gap-1.5"
                           style={{ width: 90, background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                             style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                          <Compass size={16} style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }} />
                        </div>
                        <span className="font-mono text-[8px] tracking-wider text-center leading-tight"
                              style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                          Waiting…
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[9px] mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                    When they roam you back, messaging unlocks
                  </p>
                </div>
              )}

              <div className="px-3.5 mt-5 animate-fade-up">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2.5 flex items-center gap-1.5"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  <Bookmark size={10} />
                  Dream destinations
                  {bucketList.length > 0 && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-lg ml-1"
                          style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.22)", color: "var(--roam-electric)" }}>
                      {bucketList.length} pinned
                    </span>
                  )}
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                  {/* The user's own pinned destinations — each removable */}
                  {bucketList.map((b) => (
                    <div key={b.id} className="flex-shrink-0 w-[110px] rounded-2xl overflow-hidden relative"
                         style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.65)" }}
                         data-testid={`bucket-${b.destinationName.replace(/\s+/g, "-")}`}>
                      {b.imageUrl
                        ? <img src={b.imageUrl} alt={b.destinationName} className="w-[110px] h-[110px] object-cover" loading="lazy" />
                        : <div className="w-[110px] h-[110px] flex items-center justify-center" style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                            <MapPin size={22} style={{ color: "var(--roam-electric)" }} />
                          </div>}
                      <div className="absolute inset-0 pointer-events-none"
                           style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 55%)" }} />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <div className="font-semibold text-[10px] text-white leading-tight">{b.destinationName}</div>
                      </div>
                      <button
                        onClick={() => removeDestMutation.mutate(b.id)}
                        disabled={removeDestMutation.isPending}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                        aria-label={`Remove ${b.destinationName}`}
                        data-testid={`remove-bucket-${b.destinationName.replace(/\s+/g, "-")}`}>
                        <X size={11} style={{ color: "#fff" }} />
                      </button>
                    </div>
                  ))}

                  {/* Add-your-own card */}
                  <button
                    onClick={() => setShowAddDest(true)}
                    className="flex-shrink-0 w-[110px] h-[110px] rounded-2xl flex flex-col items-center justify-center gap-1.5"
                    style={{ border: "1.5px dashed rgba(var(--roam-cream-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.03)" }}
                    data-testid="button-add-destination">
                    <Plus size={20} style={{ color: "var(--roam-electric)" }} />
                    <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>Add your own</span>
                  </button>
                </div>

                {/* Inline composer */}
                {showAddDest && (
                  <div className="mt-1 rounded-2xl p-3 animate-fade-up"
                       style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => destFileRef.current?.click()}
                        className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center relative"
                        style={{ border: "1.5px dashed rgba(var(--roam-cream-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.04)" }}
                        data-testid="button-pick-dest-image">
                        {destImage
                          ? <img src={destImage.preview} alt="" className="w-full h-full object-cover" />
                          : <ImagePlus size={18} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
                      </button>
                      <input ref={destFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                             className="hidden" onChange={e => { pickDestImage(e.target.files?.[0]); e.target.value = ""; }}
                             data-testid="input-dest-image" />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <input
                          value={newDestName}
                          onChange={e => setNewDestName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") submitDest(); }}
                          placeholder="Where do you dream of going?"
                          maxLength={80}
                          autoFocus
                          className="w-full py-2 px-3 rounded-lg text-sm outline-none"
                          style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}
                          data-testid="input-dest-name" />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={submitDest}
                            disabled={addDestMutation.isPending}
                            className="flex-1 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                            style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                            data-testid="button-submit-dest">
                            {addDestMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
                            {addDestMutation.isPending ? "Pinning…" : "Pin it"}
                          </button>
                          <button
                            onClick={() => { setShowAddDest(false); setNewDestName(""); setDestImage(null); }}
                            className="px-3 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase"
                            style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.6)" }}
                            data-testid="button-cancel-dest">
                            Cancel
                          </button>
                        </div>
                        <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Photo optional · JPEG/PNG/WebP, max 8 MB</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestions — tap to pin */}
                {BUCKET_LIST.some(b => !bucketList.some(bl => bl.destinationName.trim().toLowerCase() === b.name.toLowerCase())) && (
                  <div className="mt-2.5">
                    <div className="font-mono text-[9px] tracking-wider uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Popular — tap to pin</div>
                    <div className="flex flex-wrap gap-1.5">
                      {BUCKET_LIST.filter(b => !bucketList.some(bl => bl.destinationName.trim().toLowerCase() === b.name.toLowerCase())).map((b, i) => (
                        <button key={i}
                          onClick={() => quickAddPreset(b.name, b.url)}
                          disabled={addDestMutation.isPending}
                          className="px-2.5 py-1.5 rounded-lg font-mono text-[10px] tracking-wider flex items-center gap-1 disabled:opacity-50"
                          style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                          data-testid={`suggest-${b.name.replace(/\s+/g, "-")}`}>
                          <Plus size={10} style={{ color: "var(--roam-electric)" }} />{b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mx-3.5 mt-5 rounded-2xl p-4"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.04)", border: "1px solid rgba(var(--roam-electric-rgb),0.1)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Flame size={12} style={{ color: "var(--roam-electric)" }} />
                  <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--roam-electric)" }}>
                    Keep momentum
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Connections with messages in the first 24 hours are 4× more likely to plan a real adventure together.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col animate-fade-up" style={{ height: "calc(100vh - 64px)" }}>
              <div className="px-4 pt-4 pb-3 flex items-center gap-3 flex-shrink-0"
                   style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                <button className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(var(--roam-cream-rgb),0.06)" }}
                        onClick={() => setSelectedId(null)}
                        data-testid="button-back-matches">
                  <ArrowLeft size={15} />
                </button>
                {selectedMatch && (
                  <>
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={selectedMatch.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{selectedMatch.nameAge}</div>
                      <div className="flex items-center gap-1.5">
                        {theirTyping ? (
                          <div className="flex items-center gap-1">
                            <div className="flex gap-0.5">
                              {[0,1,2].map(i => (
                                <div key={i} className="w-1 h-1 rounded-full"
                                     style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                              ))}
                            </div>
                            <span className="font-mono text-[9px]" style={{ color: "var(--roam-electric)" }}>typing…</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full"
                                 style={{ background: isOnline ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.25)" }} />
                            <div className="font-mono text-[9px]"
                                 style={{ color: isOnline ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.3)" }}>
                              {isOnline ? selectedMatch.shared.slice(0, 2).join(" · ") : "offline — cached view"}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <MomentumBadge state={getMomentum(conversations[selectedId] ?? [], myId)} compact />
                    </div>
                  </>
                )}
                {!isOnline && <WifiOff size={14} style={{ color: "rgba(232,98,26,0.6)", flexShrink: 0 }} />}
              </div>

              {connectionStatus === "offline" && (
                <div className="mx-3.5 mt-2 rounded-xl px-3 py-2 flex items-center gap-2 flex-shrink-0"
                     style={{ background: "rgba(232,98,26,0.08)", border: "1px solid rgba(232,98,26,0.2)" }}>
                  <WifiOff size={11} style={{ color: "var(--roam-ember)" }} />
                  <span className="font-mono text-[10px]" style={{ color: "rgba(232,98,26,0.8)" }}>
                    No data — messages queue and send automatically when you're back online
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
                {messages.length === 0 && selectedMatch && (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
                      <img src={selectedMatch.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="font-serif text-base font-bold mb-1">
                      You're connected with {selectedMatch.name}!
                    </div>
                    <div className="flex flex-wrap justify-center gap-1 mb-3">
                      {selectedMatch.shared.map(t => (
                        <span key={t} className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-md"
                              style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs max-w-[220px] mx-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                      Ask about their next adventure — shared experiences start with a message.
                    </p>
                  </div>
                )}

                {groupByDay(messages).map(group => (
                  <div key={group.day}>
                    <div className="text-center my-4">
                      <span className="font-mono text-[9px] tracking-wider px-3 py-1 rounded-full"
                            style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                        {group.day}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.messages.map(msg => {
                        const isMe = msg.senderId === myId;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                            {!isMe && selectedMatch && (
                              <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                                <img src={selectedMatch.img} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="max-w-[78%]">
                              <div className={`px-3.5 py-2.5 text-[13px] leading-snug ${isMe ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"}`}
                                   style={{
                                     background: isMe ? "var(--roam-electric)" : "var(--roam-surface)",
                                     color: isMe ? "var(--roam-forest)" : "var(--roam-cream)",
                                     opacity: msg.pending ? 0.6 : 1,
                                   }}>
                                {msg.content}
                              </div>
                              <div className={`font-mono text-[9px] mt-1 flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}
                                   style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                                {formatTime(msg.createdAt)}
                                {msg.pending && <Clock size={8} style={{ color: "#f59e0b" }} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {theirTyping && selectedMatch && (
                  <div className="flex gap-2 justify-start mt-3">
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                      <img src={selectedMatch.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: "var(--roam-surface)" }}>
                      <div className="flex gap-1 items-center">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full"
                               style={{ background: "rgba(var(--roam-cream-rgb),0.4)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {selectedMatch && !openerUsed[selectedId] && messages.length === 0 && (
                <div className="px-3.5 pt-2 flex-shrink-0">
                  <button
                    className="w-full px-4 py-3 rounded-2xl text-left transition-all flex items-start gap-2.5"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.07)", border: "1px solid rgba(var(--roam-electric-rgb),0.28)" }}
                    onClick={useOpener}
                    data-testid="button-adventure-opener">
                    <Zap size={13} style={{ color: "var(--roam-electric)", flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[8px] tracking-wider uppercase mb-1" style={{ color: "rgba(var(--roam-electric-rgb),0.65)" }}>
                        Adventure opener · tap to send
                      </div>
                      <div className="text-[12px] leading-snug italic" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>
                        "{selectedMatch.opener}"
                      </div>
                    </div>
                  </button>
                </div>
              )}

              <div className="px-3.5 py-3 flex-shrink-0"
                   style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)", background: "rgba(var(--roam-forest-rgb),0.85)", backdropFilter: "blur(12px)" }}>
                <div className="flex gap-2">
                  <input ref={inputRef}
                         className="flex-1 py-3 px-4 rounded-2xl text-sm outline-none"
                         style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}
                         placeholder={isOnline ? "Say something adventurous..." : "Offline — queues and sends when back…"}
                         value={inputVal}
                         onChange={e => handleTyping(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                         data-testid="input-message" />
                  <button className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: inputVal.trim() ? (isOnline ? "var(--roam-electric)" : "#f59e0b") : "rgba(var(--roam-cream-rgb),0.06)",
                            color: inputVal.trim() ? "var(--roam-forest)" : "rgba(var(--roam-cream-rgb),0.25)",
                          }}
                          onClick={() => sendMessage()}
                          disabled={!inputVal.trim()}
                          data-testid="button-send">
                    {isOnline ? <Send size={16} /> : <Clock size={16} />}
                  </button>
                </div>
                {!isOnline && (
                  <p className="font-mono text-[9px] mt-1.5 text-center" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                    No cellular used · sends automatically when data returns
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
