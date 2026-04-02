import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export default function AdvertiseSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center relative" data-testid="page-advertise-success">
      <div className="topo-bg" />
      <div className="relative z-10 max-w-md mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
             style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
          <CheckCircle2 size={28} style={{ color: "var(--roam-electric)" }} />
        </div>
        <h1 className="font-serif text-[32px] font-black mb-3">
          Payment <span style={{ color: "var(--roam-electric)" }}>received</span>
        </h1>
        <p className="font-mono text-[12px] leading-relaxed mb-6"
           style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
          Your ad is now in our review queue. We check all submissions against our content guidelines within 1–2 business days.
          You'll receive an email at the address you provided once it goes live.
        </p>
        <div className="rounded-2xl px-5 py-4 mb-8 text-left space-y-2.5"
             style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
          <div className="font-mono text-[10px] tracking-wider uppercase mb-1" style={{ color: "var(--roam-electric)" }}>What happens next</div>
          {["Our team reviews your ad for content guideline compliance", "You receive an email with approval or feedback", "Approved ads go live in the discover feed immediately", "Your slot timer starts from the day of approval"].map((s, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }}>0{i + 1}</span>
              <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{s}</span>
            </div>
          ))}
        </div>
        <Link href="/">
          <button className="font-mono text-[11px] tracking-wider px-6 py-3 rounded-2xl transition-all"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.6)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                  data-testid="button-back-home">
            Back to roam.
          </button>
        </Link>
      </div>
    </div>
  );
}
