import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppNav from "@/components/app-nav";

const DEMO_MATCHES = [
  {
    id: "1",
    name: "Mia, 28",
    shared: "climbing · alpine hiking · night markets",
    when: "Matched 2h ago",
    pct: 78,
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=150&q=80&fit=crop",
    lastMessage: null,
  },
  {
    id: "2",
    name: "Kai, 31",
    shared: "surfing · night markets · urban roaming",
    when: "Matched yesterday",
    pct: 64,
    img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&q=80&fit=crop",
    lastMessage: "Hey! That surf shot at Raglan looks amazing",
  },
  {
    id: "3",
    name: "Sam, 26",
    shared: "backpacking · kayaking · forest trails",
    when: "Matched 3 days ago",
    pct: 59,
    img: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=150&q=80&fit=crop",
    lastMessage: "We should hit Abel Tasman together next summer!",
  },
];

export default function Matches() {
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");

  const selectedData = DEMO_MATCHES.find(m => m.id === selectedMatch);

  return (
    <div className="min-h-screen relative" data-testid="page-matches">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-10">
          {!selectedMatch ? (
            <>
              <div className="px-4.5 pt-6 mb-4 animate-fade-up">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-1.5" style={{ color: "rgba(242,237,227,0.35)" }}>
                  adventures aligned
                </div>
                <h1 className="font-serif text-[28px] font-black leading-[1.05]" data-testid="text-match-count">
                  {DEMO_MATCHES.length} new<br />connections
                </h1>
              </div>

              <div className="px-3.5 space-y-2.5">
                {DEMO_MATCHES.map((m, i) => (
                  <div key={m.id}
                       className="rounded-[22px] p-3.5 flex gap-3 items-center cursor-pointer transition-all animate-fade-up"
                       style={{
                         background: "var(--roam-moss)",
                         border: "1px solid rgba(242,237,227,0.06)",
                         animationDelay: `${i * 0.07}s`,
                       }}
                       onClick={() => setSelectedMatch(m.id)}
                       data-testid={`match-row-${m.id}`}>
                    <div className="w-[58px] h-[58px] rounded-xl overflow-hidden flex-shrink-0">
                      <img src={m.img} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold" data-testid={`text-match-name-${m.id}`}>{m.name}</div>
                      <div className="font-mono text-[10px] mt-0.5 truncate" style={{ color: "var(--roam-electric)" }}>
                        {m.shared}
                      </div>
                      {m.lastMessage ? (
                        <div className="text-[11px] mt-1 truncate" style={{ color: "rgba(242,237,227,0.5)" }}>
                          {m.lastMessage}
                        </div>
                      ) : (
                        <div className="text-[11px] mt-1" style={{ color: "rgba(242,237,227,0.35)" }}>
                          {m.when}
                        </div>
                      )}
                    </div>
                    <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-mono text-xs font-medium"
                         style={{ background: "rgba(200,230,74,0.08)", border: "1.5px solid rgba(200,230,74,0.4)", color: "var(--roam-electric)" }}
                         data-testid={`text-match-score-${m.id}`}>
                      {m.pct}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="animate-fade-up">
              <div className="px-4.5 pt-4 flex items-center gap-3 mb-4">
                <button className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(242,237,227,0.06)" }}
                        onClick={() => setSelectedMatch(null)}
                        data-testid="button-back-matches">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                </button>
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={selectedData!.img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{selectedData!.name}</div>
                    <div className="font-mono text-[9px]" style={{ color: "var(--roam-electric)" }}>{selectedData!.pct}% overlap</div>
                  </div>
                </div>
              </div>

              <div className="px-4.5 flex-1" style={{ minHeight: "50vh" }}>
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
                    <img src={selectedData!.img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="font-serif text-lg font-bold mb-1">You matched with {selectedData!.name.split(",")[0]}!</div>
                  <div className="font-mono text-[10px] mb-2" style={{ color: "var(--roam-electric)" }}>{selectedData!.shared}</div>
                  <p className="text-xs max-w-xs mx-auto" style={{ color: "rgba(242,237,227,0.4)" }}>
                    Start the conversation. Ask about their adventures — that's what brought you together.
                  </p>
                </div>

                {selectedData!.lastMessage && (
                  <div className="mb-4">
                    <div className="flex gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={selectedData!.img} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="rounded-2xl rounded-tl-md px-3.5 py-2.5 max-w-[80%] text-[13px]"
                           style={{ background: "var(--roam-surface)" }}>
                        {selectedData!.lastMessage}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-3.5 pb-4 sticky bottom-0">
                <div className="flex gap-2">
                  <input className="flex-1 py-3 px-4 rounded-2xl text-sm outline-none"
                         style={{ background: "var(--roam-surface)", border: "1px solid rgba(242,237,227,0.1)", color: "var(--roam-cream)" }}
                         placeholder="Say something adventurous..."
                         value={messageInput}
                         onChange={e => setMessageInput(e.target.value)}
                         data-testid="input-message" />
                  <button className="px-4 rounded-2xl font-mono text-xs tracking-wider uppercase font-medium"
                          style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                          data-testid="button-send">
                    Send
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
