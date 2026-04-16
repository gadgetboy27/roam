import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { MessageSquarePlus, X, Send, CheckCircle2 } from "lucide-react";

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return null;

  const noWidgetPaths = ["/admin", "/login", "/signup", "/auth/callback", "/forgot-password", "/reset-password"];
  if (noWidgetPaths.some(p => location.startsWith(p))) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: message.trim(), page: location }),
      });
      setDone(true);
      setMessage("");
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 2200);
    } catch {
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[59]"
          onClick={() => { if (!done) setOpen(false); }}
        />
      )}

      <div className="fixed bottom-28 right-4 z-[60] flex flex-col items-end gap-2">

        {open && (
          <div
            className="w-[280px] rounded-3xl shadow-2xl overflow-hidden"
            style={{
              background: "var(--roam-surface)",
              border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {done ? (
              <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1.5px solid var(--roam-electric)" }}
                >
                  <CheckCircle2 size={22} style={{ color: "var(--roam-electric)" }} />
                </div>
                <div>
                  <p className="font-serif text-[16px] font-black" style={{ color: "var(--roam-cream)" }}>
                    Feedback received
                  </p>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                    Thank you, {user.name?.split(" ")[0] || "explorer"} 🙏
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                >
                  <div>
                    <p className="font-serif text-[15px] font-black" style={{ color: "var(--roam-cream)" }}>
                      Share feedback
                    </p>
                    <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                      From {user.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }}
                    data-testid="button-close-feedback"
                  >
                    <X size={13} style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="px-4 py-4">
                  <textarea
                    autoFocus
                    className="w-full rounded-2xl p-3 text-[12px] font-mono leading-relaxed resize-none outline-none"
                    style={{
                      background: "rgba(var(--roam-cream-rgb),0.05)",
                      border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
                      color: "var(--roam-cream)",
                      minHeight: "90px",
                    }}
                    placeholder="What's on your mind? Bugs, ideas, anything…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    data-testid="input-feedback-message"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || sending}
                    className="w-full mt-3 py-3 rounded-2xl font-mono text-[11px] tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    data-testid="button-submit-feedback"
                  >
                    {sending ? (
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full"
                               style={{ background: "var(--roam-forest)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                        ))}
                      </div>
                    ) : (
                      <><Send size={12} /> Send feedback</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setOpen(v => !v)}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            background: open ? "rgba(var(--roam-electric-rgb),0.15)" : "var(--roam-surface)",
            border: `1.5px solid ${open ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.12)"}`,
          }}
          title="Share feedback"
          data-testid="button-open-feedback"
        >
          <MessageSquarePlus size={18} style={{ color: open ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.7)" }} />
        </button>
      </div>
    </>
  );
}
