import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import AppNav from "@/components/app-nav";
import {
  Send, ArrowLeft, WifiOff, Clock, MapPin, BookmarkCheck,
  Bookmark, Compass, Flame, MessageCircle, Hourglass, Zap, Lock
} from "lucide-react";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
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

const DEMO_CONNECTIONS = [
  {
    id: "match-demo-1",
    name: "Mia",
    nameAge: "Mia, 28",
    shared: ["alpine hiking", "rock climbing", "night markets"],
    when: "Matched 2h ago",
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&q=80&fit=crop",
    opener: "You've both tagged alpine routes — who had the bigger summit this year?",
    seed: [] as CachedMessage[],
  },
  {
    id: "match-demo-2",
    name: "Kai",
    nameAge: "Kai, 31",
    shared: ["surfing", "night markets", "urban roaming"],
    when: "Matched yesterday",
    img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&q=80&fit=crop",
    opener: "You've both ridden Raglan — did you catch the right-hander or go left?",
    seed: [
      { id: "seed-k1", matchId: "match-demo-2", senderId: "kai", content: "Hey! That surf shot at Raglan looks amazing", createdAt: new Date(Date.now() - 3600000).toISOString() },
    ] as CachedMessage[],
  },
  {
    id: "match-demo-3",
    name: "Sam",
    nameAge: "Sam, 26",
    shared: ["backpacking", "kayaking", "forest trails"],
    when: "Matched 3 days ago",
    img: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=150&q=80&fit=crop",
    opener: "You're both planning Abel Tasman — full track or water taxi in?",
    seed: [
      { id: "seed-s1", matchId: "match-demo-3", senderId: "sam", content: "We should hit Abel Tasman together next summer!", createdAt: new Date(Date.now() - 86400000).toISOString() },
    ] as CachedMessage[],
  },
];

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
  const myId = user?.id ?? "demo-user";
  const isPaid = user?.tier === "adventurer";

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
          name: partner.name as string,
          nameAge: age ? `${partner.name}, ${age}` : (partner.name as string),
          shared: sharedTags,
          when,
          img: (partner.avatarUrl || "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=150&q=80&fit=crop") as string,
          opener,
          seed: [] as CachedMessage[],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [dbMatches, user, usersById]);

  const connections = realConnections.length > 0 ? realConnections : DEMO_CONNECTIONS;
  const isDemo = realConnections.length === 0 && !!user;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, CachedMessage[]>>(() => {
    const init: Record<string, CachedMessage[]> = {};
    DEMO_CONNECTIONS.forEach(m => {
      const cached = getCachedMessages(m.id);
      init[m.id] = cached.length > 0 ? cached : [...m.seed];
    });
    return init;
  });
  const [inputVal, setInputVal] = useState("");
  const [theirTyping, setTheirTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [openerUsed, setOpenerUsed] = useState<Record<string, boolean>>({});
  const [sbReady, setSbReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const connectionStatus = useConnectionStatus();
  const isOnline = connectionStatus === "online";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                  {isDemo ? "0" : realConnections.length} connections
                </h1>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  {isDemo
                    ? "No mutual matches yet — head to Discover to find your people"
                    : "You and these adventurers have both said yes. Start planning."}
                </p>
                {isDemo && (
                  <div className="mt-3 px-3 py-2 rounded-xl inline-block"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.18)" }}>
                    <span className="font-mono text-[9px] tracking-wider" style={{ color: "rgba(var(--roam-electric-rgb),0.6)" }}>
                      ↓ preview of what connections look like
                    </span>
                  </div>
                )}
              </div>

              {offlineBanner()}

              {bucketList.length > 0 && (
                <div className="px-3.5 mb-4 animate-fade-up">
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2.5 flex items-center gap-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                    <BookmarkCheck size={11} style={{ color: "var(--roam-sky)" }} />
                    Your pinned destinations
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {bucketList.map(b => (
                      <div key={b.id} className="flex-shrink-0 rounded-2xl overflow-hidden relative"
                           style={{ width: 90, height: 90, border: "1px solid rgba(var(--roam-sky-rgb),0.3)" }}>
                        {b.imageUrl
                          ? <img src={b.imageUrl} alt={b.destinationName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--roam-moss)" }}>
                              <MapPin size={18} style={{ color: "var(--roam-sky)" }} />
                            </div>
                        }
                        <div className="absolute inset-0 flex items-end p-1.5"
                             style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }}>
                          <span className="font-mono text-[8px] tracking-wider leading-tight" style={{ color: "var(--roam-sky)" }}>
                            {b.destinationName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-3.5 space-y-2" data-testid="connections-list">
                {connections.map((m, i) => {
                  const msgs = conversations[m.id] ?? [];
                  const last = msgs[msgs.length - 1] ?? null;
                  const hasPending = msgs.some(msg => msg.pending);
                  const momentum = getMomentum(msgs, myId);
                  return (
                    <div key={m.id}
                         className={`rounded-[22px] p-3.5 flex gap-3 items-center transition-all animate-fade-up ${isPaid ? "cursor-pointer" : "cursor-default select-none"}`}
                         style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)", animationDelay: `${i * 0.07}s` }}
                         onClick={() => {
                           if (!isPaid) {
                             toast({
                               title: "Adventurer tier unlocks this 🔒",
                               description: "Upgrade to see match photos and start conversations.",
                             });
                             return;
                           }
                           openChat(m.id);
                         }}
                         data-testid={`match-row-${m.id}`}>
                      <div className="relative flex-shrink-0">
                        <div className="w-[58px] h-[58px] rounded-xl overflow-hidden relative">
                          <img src={m.img} alt={m.nameAge}
                               className="w-full h-full object-cover"
                               style={!isPaid ? { filter: "blur(8px)", transform: "scale(1.1)" } : undefined}
                               loading="lazy" />
                          {!isPaid && (
                            <div className="absolute inset-0 flex items-center justify-center"
                                 style={{ background: "rgba(0,0,0,0.25)" }}>
                              <Lock size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
                            </div>
                          )}
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
                        <div className="text-base font-semibold" data-testid={`text-match-name-${m.id}`}>{m.nameAge}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
                          {m.shared.map(t => (
                            <span key={t} className="font-mono text-[8px] tracking-wider px-1.5 py-0.5 rounded-md"
                                  style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        {last ? (
                          <div className="text-[11px] truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                            {last.senderId === myId && <span style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>You: </span>}
                            {last.content}
                          </div>
                        ) : (
                          <div className="text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{m.when}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <MomentumBadge state={momentum} />
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
                  {BUCKET_LIST.map((b, i) => {
                    const pinned = bucketList.some((bl: any) => bl.destinationName === b.name);
                    return (
                      <div key={i} className="flex-shrink-0 w-[110px] rounded-2xl overflow-hidden relative"
                           style={{ border: pinned ? "2px solid rgba(var(--roam-electric-rgb),0.65)" : "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                           data-testid={`bucket-${b.name.replace(/\s+/g, "-")}`}>
                        <img src={b.url} alt={b.name} className="w-[110px] h-[110px] object-cover" loading="lazy" />
                        <div className="absolute inset-0 pointer-events-none"
                             style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 55%)" }} />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <div className="font-semibold text-[10px] text-white leading-tight">{b.name}</div>
                          <div className="font-mono text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.48)" }}>{b.want}</div>
                        </div>
                        {pinned && (
                          <div className="absolute top-1.5 right-1.5">
                            <BookmarkCheck size={12} style={{ color: "var(--roam-electric)" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
