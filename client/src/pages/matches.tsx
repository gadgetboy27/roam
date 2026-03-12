import { useState, useRef, useEffect } from "react";
import AppNav from "@/components/app-nav";
import { Send, ArrowLeft, Zap } from "lucide-react";

interface Message {
  id: string;
  from: "me" | "them";
  text: string;
  ts: Date;
}

const DEMO_MATCHES = [
  {
    id: "1",
    name: "Mia",
    nameAge: "Mia, 28",
    shared: "climbing · alpine hiking · night markets",
    when: "Matched 2h ago",
    pct: 78,
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&q=80&fit=crop",
    initialMessages: [] as Message[],
    autoReplies: [
      "Hey! I noticed you hike too — what's your favourite trail in the South Island?",
      "That sounds amazing! I've been meaning to do the Routeburn. Have you done it?",
      "We should plan something! I'm free most weekends in March.",
    ],
  },
  {
    id: "2",
    name: "Kai",
    nameAge: "Kai, 31",
    shared: "surfing · night markets · urban roaming",
    when: "Matched yesterday",
    pct: 64,
    img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&q=80&fit=crop",
    initialMessages: [
      { id: "k1", from: "them" as const, text: "Hey! That surf shot at Raglan looks amazing", ts: new Date(Date.now() - 3600000) },
    ],
    autoReplies: [
      "Yeah Raglan is my favourite break in NZ! Do you surf?",
      "Nice, we should hit it together sometime. I go most weekends when there's swell.",
      "Check the forecast for this Saturday — it's looking solid 👊",
    ],
  },
  {
    id: "3",
    name: "Sam",
    nameAge: "Sam, 26",
    shared: "backpacking · kayaking · forest trails",
    when: "Matched 3 days ago",
    pct: 59,
    img: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=150&q=80&fit=crop",
    initialMessages: [
      { id: "s1", from: "them" as const, text: "We should hit Abel Tasman together next summer!", ts: new Date(Date.now() - 86400000) },
    ],
    autoReplies: [
      "Abel Tasman is on my list! Are you thinking the full track or just water taxi + hike?",
      "Full track sounds epic. Maybe late Jan when the weather is perfect?",
      "I'll start looking at booking the huts. Great chatting!",
    ],
  },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
}

export default function Matches() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, Message[]>>(() => {
    const init: Record<string, Message[]> = {};
    DEMO_MATCHES.forEach(m => { init[m.id] = [...m.initialMessages]; });
    return init;
  });
  const [inputVal, setInputVal] = useState("");
  const [typing, setTyping] = useState(false);
  const [replyIdx, setReplyIdx] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedMatch = DEMO_MATCHES.find(m => m.id === selectedId);
  const messages = selectedId ? (conversations[selectedId] || []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = () => {
    if (!inputVal.trim() || !selectedId || !selectedMatch) return;
    const myMsg: Message = { id: Date.now().toString(), from: "me", text: inputVal.trim(), ts: new Date() };
    setConversations(c => ({ ...c, [selectedId]: [...(c[selectedId] || []), myMsg] }));
    setInputVal("");

    const idx = replyIdx[selectedId] ?? 0;
    const reply = selectedMatch.autoReplies[idx % selectedMatch.autoReplies.length];
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const theirMsg: Message = { id: (Date.now() + 1).toString(), from: "them", text: reply, ts: new Date() };
      setConversations(c => ({ ...c, [selectedId]: [...(c[selectedId] || []), theirMsg] }));
      setReplyIdx(r => ({ ...r, [selectedId]: idx + 1 }));
    }, 1200 + Math.random() * 800);
  };

  const lastMessage = (id: string) => {
    const msgs = conversations[id] || [];
    return msgs[msgs.length - 1] ?? null;
  };

  const openChat = (id: string) => {
    setSelectedId(id);
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 100);
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

              <div className="mx-3.5 mb-4 rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5"
                   style={{ background: "rgba(200,230,74,0.06)", border: "1px solid rgba(200,230,74,0.18)" }}>
                <Zap size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--roam-electric)" }} />
                <p className="font-mono text-[10px] leading-relaxed" style={{ color: "rgba(242,237,227,0.5)" }}>
                  In-app messaging — no phone number needed. Messages stay inside roam.
                </p>
              </div>

              <div className="px-3.5 space-y-2.5">
                {DEMO_MATCHES.map((m, i) => {
                  const last = lastMessage(m.id);
                  return (
                    <div key={m.id}
                         className="rounded-[22px] p-3.5 flex gap-3 items-center cursor-pointer transition-all animate-fade-up"
                         style={{
                           background: "var(--roam-moss)",
                           border: "1px solid rgba(242,237,227,0.06)",
                           animationDelay: `${i * 0.07}s`,
                         }}
                         onClick={() => openChat(m.id)}
                         data-testid={`match-row-${m.id}`}>
                      <div className="w-[58px] h-[58px] rounded-xl overflow-hidden flex-shrink-0">
                        <img src={m.img} alt={m.nameAge} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold" data-testid={`text-match-name-${m.id}`}>{m.nameAge}</div>
                        <div className="font-mono text-[10px] mt-0.5 truncate" style={{ color: "var(--roam-electric)" }}>
                          {m.shared}
                        </div>
                        {last ? (
                          <div className="text-[11px] mt-1 truncate" style={{ color: last.from === "me" ? "rgba(242,237,227,0.4)" : "rgba(242,237,227,0.6)" }}>
                            {last.from === "me" ? "You: " : ""}{last.text}
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
                  <div className="font-mono text-[9px] truncate" style={{ color: "var(--roam-electric)" }}>
                    {selectedMatch!.pct}% overlap · {selectedMatch!.shared}
                  </div>
                </div>
              </div>

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

                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                    {msg.from === "them" && (
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                        <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="max-w-[78%]">
                      <div className={`px-3.5 py-2.5 text-[13px] leading-snug ${msg.from === "me" ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"}`}
                           style={{
                             background: msg.from === "me" ? "var(--roam-electric)" : "var(--roam-surface)",
                             color: msg.from === "me" ? "var(--roam-forest)" : "var(--roam-cream)",
                           }}>
                        {msg.text}
                      </div>
                      <div className={`font-mono text-[9px] mt-1 ${msg.from === "me" ? "text-right" : "text-left"}`}
                           style={{ color: "rgba(242,237,227,0.25)" }}>
                        {formatTime(msg.ts)}
                      </div>
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 self-end">
                      <img src={selectedMatch!.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md"
                         style={{ background: "var(--roam-surface)" }}>
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full"
                               style={{ background: "rgba(242,237,227,0.4)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
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
                         placeholder="Say something adventurous..."
                         value={inputVal}
                         onChange={e => setInputVal(e.target.value)}
                         onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                         data-testid="input-message" />
                  <button className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: inputVal.trim() ? "var(--roam-electric)" : "rgba(242,237,227,0.06)",
                            color: inputVal.trim() ? "var(--roam-forest)" : "rgba(242,237,227,0.25)",
                          }}
                          onClick={sendMessage}
                          disabled={!inputVal.trim()}
                          data-testid="button-send">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
