import { useState, useRef, useEffect, useCallback } from "react";
import AppNav from "@/components/app-nav";
import { Send, ArrowLeft, Wifi, WifiOff, Clock, MapPin, BookmarkCheck } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  getCachedMessages, appendCachedMessage, cacheMessages,
  enqueuePending, loadPendingQueue, clearPendingQueue,
  type CachedMessage,
} from "@/lib/messageCache";

const MY_USER_ID = "demo-user";

const DEMO_MATCHES = [
  {
    id: "match-1",
    name: "Mia",
    nameAge: "Mia, 28",
    shared: "climbing · alpine hiking · night markets",
    when: "Matched 2h ago",
    pct: 78,
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&q=80&fit=crop",
    autoReplies: [
      "Hey! I noticed you hike too — what's your favourite trail in the South Island?",
      "That sounds amazing! I've been meaning to do the Routeburn. Have you done it?",
      "We should plan something! I'm free most weekends in March.",
    ],
    seed: [] as CachedMessage[],
  },
  {
    id: "match-2",
    name: "Kai",
    nameAge: "Kai, 31",
    shared: "surfing · night markets · urban roaming",
    when: "Matched yesterday",
    pct: 64,
    img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&q=80&fit=crop",
    autoReplies: [
      "Yeah Raglan is my favourite break in NZ! Do you surf?",
      "Nice, we should hit it together sometime. I go most weekends when there's swell.",
      "Check the forecast this Saturday — looking solid 👊",
    ],
    seed: [
      { id: "seed-k1", matchId: "match-2", senderId: "kai", content: "Hey! That surf shot at Raglan looks amazing", createdAt: new Date(Date.now() - 3600000).toISOString() },
    ] as CachedMessage[],
  },
  {
    id: "match-3",
    name: "Sam",
    nameAge: "Sam, 26",
    shared: "backpacking · kayaking · forest trails",
    when: "Matched 3 days ago",
    pct: 59,
    img: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=150&q=80&fit=crop",
    autoReplies: [
      "Abel Tasman is on my list! Are you thinking the full track or just water taxi + hike?",
      "Full track sounds epic. Maybe late Jan when the weather is perfect?",
      "I'll start looking at booking the huts. Great chatting!",
    ],
    seed: [
      { id: "seed-s1", matchId: "match-3", senderId: "sam", content: "We should hit Abel Tasman together next summer!", createdAt: new Date(Date.now() - 86400000).toISOString() },
    ] as CachedMessage[],
  },
];

function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
}

export default function Matches() {
  const { user } = useAuth();
  const { data: bucketList = [] } = useQuery<{ id: string; destinationName: string; imageUrl: string | null }[]>({
    queryKey: ["/api/bucket-list", user?.id],
    enabled: !!user,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, CachedMessage[]>>(() => {
    const init: Record<string, CachedMessage[]> = {};
    DEMO_MATCHES.forEach(m => {
      const cached = getCachedMessages(m.id);
      init[m.id] = cached.length > 0 ? cached : [...m.seed];
    });
    return init;
  });
  const [inputVal, setInputVal] = useState("");
  const [typing, setTyping] = useState(false);
  const [replyIdx, setReplyIdx] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const connectionStatus = useConnectionStatus();
  const isOnline = connectionStatus === "online";

  const selectedMatch = DEMO_MATCHES.find(m => m.id === selectedId);
  const messages = selectedId ? (conversations[selectedId] || []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("new_message", (msg: CachedMessage & { tempId?: string }) => {
      setConversations(prev => {
        const existing = prev[msg.matchId] ?? [];
        const deduped = existing.filter(m => m.id !== msg.tempId && m.id !== msg.id);
        const updated = [...deduped, { ...msg }];
        appendCachedMessage(msg.matchId, { ...msg });
        return { ...prev, [msg.matchId]: updated };
      });
      setTyping(false);
    });

    return () => { socket.off("new_message"); };
  }, []);

  useEffect(() => {
    if (selectedId) {
      const socket = getSocket();
      socket.emit("join_match", selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!isOnline) return;
    const queue = loadPendingQueue();
    if (queue.length === 0) return;
    const socket = getSocket();
    queue.forEach(msg => {
      socket.emit("send_message", {
        matchId: msg.matchId,
        senderId: msg.senderId,
        content: msg.content,
        tempId: msg.id,
      });
    });
    clearPendingQueue();
  }, [isOnline]);

  useEffect(() => {
    if (selectedId) {
      const msgs = conversations[selectedId] ?? [];
      cacheMessages(selectedId, msgs);
    }
  }, [conversations, selectedId]);

  const sendMessage = useCallback(() => {
    if (!inputVal.trim() || !selectedId || !selectedMatch) return;
    const tempId = `temp-${Date.now()}`;
    const myMsg: CachedMessage = {
      id: tempId,
      matchId: selectedId,
      senderId: MY_USER_ID,
      content: inputVal.trim(),
      createdAt: new Date().toISOString(),
      pending: !isOnline,
    };

    setConversations(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), myMsg],
    }));
    setInputVal("");

    if (isOnline) {
      const socket = getSocket();
      socket.emit("send_message", {
        matchId: selectedId,
        senderId: MY_USER_ID,
        content: myMsg.content,
        tempId,
      });
      const idx = replyIdx[selectedId] ?? 0;
      const reply = selectedMatch.autoReplies[idx % selectedMatch.autoReplies.length];
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const theirMsg: CachedMessage = {
          id: `auto-${Date.now()}`,
          matchId: selectedId,
          senderId: selectedMatch.id,
          content: reply,
          createdAt: new Date().toISOString(),
        };
        setConversations(prev => ({
          ...prev,
          [selectedId]: [...(prev[selectedId] || []), theirMsg],
        }));
        appendCachedMessage(selectedId, theirMsg);
        setReplyIdx(r => ({ ...r, [selectedId]: idx + 1 }));
      }, 1200 + Math.random() * 700);
    } else {
      enqueuePending(myMsg);
      appendCachedMessage(selectedId, myMsg);
    }
  }, [inputVal, selectedId, selectedMatch, isOnline, replyIdx]);

  const lastMessage = (id: string) => {
    const msgs = conversations[id] || [];
    return msgs[msgs.length - 1] ?? null;
  };

  const openChat = (id: string) => {
    setSelectedId(id);
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const statusBadge = () => {
    if (connectionStatus === "offline") return (
      <div className="mx-3.5 mb-3 rounded-xl px-3 py-2 flex items-center gap-2"
           style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.25)" }}>
        <WifiOff size={12} style={{ color: "var(--roam-ember)" }} />
        <span className="font-mono text-[10px]" style={{ color: "rgba(232,98,26,0.85)" }}>
          Offline — viewing cached messages. Outgoing will send when data returns.
        </span>
      </div>
    );
    if (connectionStatus === "connecting") return (
      <div className="mx-3.5 mb-3 rounded-xl px-3 py-2 flex items-center gap-2"
           style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <div className="flex gap-0.5">
          {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: "#f59e0b", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />)}
        </div>
        <span className="font-mono text-[10px]" style={{ color: "rgba(245,158,11,0.85)" }}>
          Connecting…
        </span>
      </div>
    );
    return null;
  };

  return (
    <div className="min-h-screen relative" data-testid="page-matches">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-10">
          {!selectedId ? (
            <>
              <div className="px-4.5 pt-6 mb-4 animate-fade-up">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-1.5" style={{ color: "rgba(242,237,227,0.35)" }}>
                  adventures aligned
                </div>
                <h1 className="font-serif text-[28px] font-black leading-[1.05]" data-testid="text-match-count">
                  {DEMO_MATCHES.length} new<br />connections
                </h1>
              </div>

              {statusBadge()}

              {bucketList.length > 0 && (
                <div className="px-3.5 mb-4 animate-fade-up">
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2.5 flex items-center gap-2" style={{ color: "rgba(242,237,227,0.35)" }}>
                    <BookmarkCheck size={11} style={{ color: "var(--roam-sky)" }} />
                    Your pinned destinations
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {bucketList.map(b => (
                      <div key={b.id} className="flex-shrink-0 rounded-2xl overflow-hidden relative"
                           style={{ width: 100, height: 100, border: "1px solid rgba(125,184,212,0.3)" }}>
                        {b.imageUrl ? (
                          <img src={b.imageUrl} alt={b.destinationName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--roam-moss)" }}>
                            <MapPin size={20} style={{ color: "var(--roam-sky)" }} />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-end p-1.5"
                             style={{ background: "linear-gradient(to top, rgba(14,26,13,0.88) 0%, transparent 55%)" }}>
                          <span className="font-mono text-[9px] tracking-wider leading-tight" style={{ color: "var(--roam-sky)" }}>
                            {b.destinationName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-3.5 space-y-2.5">
                {DEMO_MATCHES.map((m, i) => {
                  const last = lastMessage(m.id);
                  const hasPending = (conversations[m.id] ?? []).some(msg => msg.pending);
                  return (
                    <div key={m.id}
                         className="rounded-[22px] p-3.5 flex gap-3 items-center cursor-pointer transition-all animate-fade-up"
                         style={{ background: "var(--roam-moss)", border: "1px solid rgba(242,237,227,0.06)", animationDelay: `${i * 0.07}s` }}
                         onClick={() => openChat(m.id)}
                         data-testid={`match-row-${m.id}`}>
                      <div className="w-[58px] h-[58px] rounded-xl overflow-hidden flex-shrink-0 relative">
                        <img src={m.img} alt={m.nameAge} className="w-full h-full object-cover" loading="lazy" />
                        {hasPending && (
                          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                               style={{ background: "rgba(245,158,11,0.9)" }}>
                            <Clock size={8} style={{ color: "white" }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold" data-testid={`text-match-name-${m.id}`}>{m.nameAge}</div>
                        <div className="font-mono text-[10px] mt-0.5 truncate" style={{ color: "var(--roam-electric)" }}>{m.shared}</div>
                        {last ? (
                          <div className="text-[11px] mt-1 truncate flex items-center gap-1"
                               style={{ color: last.from === "me" || last.senderId === MY_USER_ID ? "rgba(242,237,227,0.4)" : "rgba(242,237,227,0.6)" }}>
                            {(last.senderId === MY_USER_ID) && <span style={{ color: "rgba(242,237,227,0.4)" }}>You: </span>}
                            {last.content}
                            {last.pending && <Clock size={9} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                          </div>
                        ) : (
                          <div className="text-[11px] mt-1" style={{ color: "rgba(242,237,227,0.35)" }}>{m.when}</div>
                        )}
                      </div>
                      <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-mono text-xs font-medium"
                           style={{ background: "rgba(200,230,74,0.08)", border: "1.5px solid rgba(200,230,74,0.4)", color: "var(--roam-electric)" }}
                           data-testid={`text-match-score-${m.id}`}>
                        {m.pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col animate-fade-up" style={{ height: "calc(100vh - 64px)" }}>
              <div className="px-4 pt-4 pb-3 flex items-center gap-3 flex-shrink-0"
                   style={{ borderBottom: "1px solid rgba(242,237,227,0.07)" }}>
                <button className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(242,237,227,0.06)" }}
                        onClick={() => setSelectedId(null)}
                        data-testid="button-back-matches">
                  <ArrowLeft size={15} />
                </button>
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{selectedMatch!.nameAge}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full"
                         style={{ background: isOnline ? "var(--roam-electric)" : "rgba(242,237,227,0.25)" }} />
                    <div className="font-mono text-[9px]" style={{ color: isOnline ? "var(--roam-electric)" : "rgba(242,237,227,0.3)" }}>
                      {isOnline ? `${selectedMatch!.pct}% overlap` : "offline — cached view"}
                    </div>
                  </div>
                </div>
                {!isOnline && <WifiOff size={14} style={{ color: "rgba(232,98,26,0.6)", flexShrink: 0 }} />}
              </div>

              {connectionStatus === "offline" && (
                <div className="mx-3.5 mt-2 rounded-xl px-3 py-2 flex items-center gap-2 flex-shrink-0"
                     style={{ background: "rgba(232,98,26,0.08)", border: "1px solid rgba(232,98,26,0.2)" }}>
                  <WifiOff size={11} style={{ color: "var(--roam-ember)" }} />
                  <span className="font-mono text-[10px]" style={{ color: "rgba(232,98,26,0.8)" }}>
                    No data — messages will send automatically when you're back online
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
                      <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="font-serif text-base font-bold mb-1">
                      You matched with {selectedMatch!.name}!
                    </div>
                    <div className="font-mono text-[10px] mb-3" style={{ color: "var(--roam-electric)" }}>
                      {selectedMatch!.shared}
                    </div>
                    <p className="text-xs max-w-[240px] mx-auto" style={{ color: "rgba(242,237,227,0.4)" }}>
                      Start the conversation — ask about their adventures.
                    </p>
                  </div>
                )}

                {messages.map(msg => {
                  const isMe = msg.senderId === MY_USER_ID;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                          <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
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
                             style={{ color: "rgba(242,237,227,0.25)" }}>
                          {formatTime(msg.createdAt)}
                          {msg.pending && <Clock size={8} style={{ color: "#f59e0b" }} />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typing && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                      <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: "var(--roam-surface)" }}>
                      <div className="flex gap-1 items-center">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full"
                               style={{ background: "rgba(242,237,227,0.4)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-3.5 py-3 flex-shrink-0"
                   style={{ borderTop: "1px solid rgba(242,237,227,0.07)", background: "rgba(14,26,13,0.85)", backdropFilter: "blur(12px)" }}>
                <div className="flex gap-2">
                  <input ref={inputRef}
                         className="flex-1 py-3 px-4 rounded-2xl text-sm outline-none"
                         style={{ background: "var(--roam-surface)", border: "1px solid rgba(242,237,227,0.1)", color: "var(--roam-cream)" }}
                         placeholder={isOnline ? "Say something adventurous..." : "Offline — message will queue…"}
                         value={inputVal}
                         onChange={e => setInputVal(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                         data-testid="input-message" />
                  <button className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: inputVal.trim() ? (isOnline ? "var(--roam-electric)" : "#f59e0b") : "rgba(242,237,227,0.06)",
                            color: inputVal.trim() ? "var(--roam-forest)" : "rgba(242,237,227,0.25)",
                          }}
                          onClick={sendMessage}
                          disabled={!inputVal.trim()}
                          data-testid="button-send">
                    {isOnline ? <Send size={16} /> : <Clock size={16} />}
                  </button>
                </div>
                {!isOnline && (
                  <p className="font-mono text-[9px] mt-1.5 text-center" style={{ color: "rgba(242,237,227,0.25)" }}>
                    Messages queue locally · no cellular used · sends when data returns
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
