import { useState } from "react";
import { X, ShieldAlert, Ban } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const REPORT_REASONS = [
  { id: "fake_profile", label: "Fake profile or catfishing" },
  { id: "harassment", label: "Harassment or threatening behaviour" },
  { id: "inappropriate_content", label: "Inappropriate photos or content" },
  { id: "safety_concern", label: "I feel unsafe" },
  { id: "spam", label: "Spam or scam" },
  { id: "underage", label: "Appears to be underage" },
  { id: "other", label: "Something else" },
];

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
  onBlocked?: () => void;
}

export default function ReportBlockModal({ userId, userName, onClose, onBlocked }: Props) {
  const [view, setView] = useState<"menu" | "report" | "done">("menu");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleBlock = async () => {
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/users/${userId}/block`);
      onBlocked?.();
      onClose();
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const handleReport = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/users/${userId}/report`, { reason, detail });
      setView("done");
    } catch { /* silent */ }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
         style={{ background: "rgba(0,0,0,0.7)" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>

        {view === "menu" && (
          <>
            <div className="px-5 pt-5 pb-4 flex items-center justify-between"
                 style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
              <div className="font-serif text-[17px] font-black" style={{ color: "var(--roam-cream)" }}>
                {userName}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl transition-opacity hover:opacity-60">
                <X size={18} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />
              </button>
            </div>
            <div className="p-3">
              <button
                onClick={() => setView("report")}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2 transition-all text-left"
                style={{ background: "rgba(232,98,26,0.07)", border: "1px solid rgba(232,98,26,0.18)" }}>
                <ShieldAlert size={18} style={{ color: "var(--roam-ember)" }} />
                <div>
                  <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-ember)" }}>Report {userName}</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                    We review every report within 24 hours
                  </div>
                </div>
              </button>
              <button
                onClick={handleBlock}
                disabled={submitting}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left"
                style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                <Ban size={18} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />
                <div>
                  <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Block {userName}</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                    They won't appear in your discover
                  </div>
                </div>
              </button>
            </div>
            <div className="px-5 pb-5">
              <button onClick={onClose} className="w-full py-3 font-mono text-[11px] tracking-wider uppercase"
                      style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {view === "report" && (
          <>
            <div className="px-5 pt-5 pb-4 flex items-center justify-between"
                 style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
              <div className="font-serif text-[17px] font-black" style={{ color: "var(--roam-cream)" }}>
                Report {userName}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl transition-opacity hover:opacity-60">
                <X size={18} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="font-mono text-[11px] mb-4" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                What's the issue? We review every report within 24 hours.
              </p>
              <div className="space-y-2 mb-4">
                {REPORT_REASONS.map(r => (
                  <button key={r.id} onClick={() => setReason(r.id)}
                          className="w-full text-left px-4 py-3 rounded-2xl font-mono text-[12px] transition-all"
                          style={{
                            background: reason === r.id ? "rgba(232,98,26,0.1)" : "rgba(var(--roam-cream-rgb),0.03)",
                            border: reason === r.id ? "1px solid rgba(232,98,26,0.4)" : "1px solid rgba(var(--roam-cream-rgb),0.08)",
                            color: reason === r.id ? "var(--roam-ember)" : "rgba(var(--roam-cream-rgb),0.75)",
                          }}>
                    {r.label}
                  </button>
                ))}
              </div>
              {reason && (
                <textarea
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  placeholder="Add more detail (optional)"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none resize-none mb-4"
                  style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}
                />
              )}
              <button
                onClick={handleReport}
                disabled={!reason || submitting}
                className="w-full py-3.5 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--roam-ember)", color: "#fff" }}>
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </>
        )}

        {view === "done" && (
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
              <ShieldAlert size={22} style={{ color: "var(--roam-electric)" }} />
            </div>
            <div className="font-serif text-[18px] font-black mb-2" style={{ color: "var(--roam-cream)" }}>
              Report received
            </div>
            <p className="font-mono text-[11px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
              Thank you. We review every report within 24 hours and take action where needed. Your safety matters.
            </p>
            <button onClick={onClose}
                    className="w-full py-3.5 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-semibold"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}>
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
