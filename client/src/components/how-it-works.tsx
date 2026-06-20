import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight, RotateCcw, CalendarDays } from "lucide-react";

// "See how it works" — an auto-playing, on-brand explainer of the roam loop:
// match on adventures → Almost Met → free messaging → crew up → meet IRL.
// Designed as a centred vertical column (9:16-friendly) so it screen-records
// cleanly for FB/IG/TikTok ads. See marketing/roam-explainer-ad.md for the
// matching ad script/storyboard.

type Beat = {
  kicker: string;
  visual: string;
  title: React.ReactNode;
  sub: string;
  ms?: number; // how long this beat holds before auto-advancing
};

const BEATS: Beat[] = [
  {
    kicker: "The problem",
    visual: "🤳",
    title: <>Most apps match your <span className="italic">face</span>.</>,
    sub: "Endless selfies. Same small talk. No spark.",
    ms: 3600,
  },
  {
    kicker: "The roam way",
    visual: "🧭",
    title: <>roam matches your <span className="italic" style={{ color: "var(--roam-electric)" }}>adventures</span>.</>,
    sub: "Post your photos — we read the places, not the pose.",
    ms: 4200,
  },
  {
    kicker: "Almost Met 👻",
    visual: "👻",
    title: <>You <span className="italic">nearly</span> crossed paths.</>,
    sub: "Same trail, same week — and never knew it. Until now.",
    ms: 4600,
  },
  {
    kicker: "No paywall on hello",
    visual: "💬",
    title: <>Match free. <span className="italic" style={{ color: "var(--roam-electric)" }}>Message</span> free.</>,
    sub: "Connect with people who move like you — the first message is on us.",
    ms: 4200,
  },
  {
    kicker: "Into the real world",
    visual: "🏔️",
    title: <>Crew up. <span className="italic">Meet</span> on the trail.</>,
    sub: "Turn a match into a plan — not another dead DM.",
    ms: 4600,
  },
];

export default function HowItWorks({
  open,
  onClose,
  onSeeEvents,
}: {
  open: boolean;
  onClose: () => void;
  onSeeEvents: () => void;
}) {
  const [i, setI] = useState(0);
  const isCta = i >= BEATS.length; // final screen = CTA
  const total = BEATS.length + 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  useEffect(() => {
    if (!open || isCta) return;
    const t = setTimeout(() => setI(v => v + 1), BEATS[i]?.ms ?? 4200);
    return () => clearTimeout(t);
  }, [open, i, isCta]);

  if (!open) return null;

  const beat = BEATS[i];

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden" style={{ background: "var(--roam-forest)" }} data-testid="how-it-works">
      <div className="topo-bg" />

      {/* progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1.5 p-3">
        {Array.from({ length: total }).map((_, idx) => (
          <button key={idx} onClick={() => setI(idx)} className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.15)" }} aria-label={`Go to step ${idx + 1}`}>
            <div className="h-full rounded-full transition-all"
                 style={{ width: idx <= i ? "100%" : "0%", background: "var(--roam-electric)" }} />
          </button>
        ))}
      </div>

      <button onClick={onClose}
              className="absolute top-3.5 right-3 z-30 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(var(--roam-cream-rgb),0.08)", color: "rgba(var(--roam-cream-rgb),0.8)" }}
              data-testid="how-it-works-close" aria-label="Close">
        <X size={16} />
      </button>

      {/* tap zones: left = back, right = forward (skips through like a story) */}
      {!isCta && (
        <>
          <button className="absolute inset-y-0 left-0 w-1/3 z-10" aria-label="Previous"
                  onClick={() => setI(v => Math.max(0, v - 1))} />
          <button className="absolute inset-y-0 right-0 w-2/3 z-10" aria-label="Next"
                  onClick={() => setI(v => v + 1)} />
        </>
      )}

      <div className="relative z-[15] h-full max-w-md mx-auto flex flex-col items-center justify-center text-center px-7 pointer-events-none">
        <AnimatePresence mode="wait">
          {!isCta ? (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.45, ease: "easeOut" }} className="flex flex-col items-center">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
                          className="text-[64px] leading-none mb-6">
                {beat.visual}
              </motion.div>
              <div className="font-mono text-[10px] tracking-[3px] uppercase mb-4" style={{ color: "var(--roam-electric)" }}>
                {beat.kicker}
              </div>
              <h2 className="font-serif text-[34px] sm:text-[40px] font-black leading-[1.04] tracking-tight mb-4"
                  style={{ color: "var(--roam-cream)" }}>
                {beat.title}
              </h2>
              <p className="text-[15px] leading-relaxed max-w-xs" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                {beat.sub}
              </p>
            </motion.div>
          ) : (
            <motion.div key="cta"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center pointer-events-auto">
              <div className="font-serif text-[44px] font-black leading-none tracking-tight mb-1" style={{ color: "var(--roam-cream)" }}>
                roam<span style={{ color: "var(--roam-electric)" }}>.</span>
              </div>
              <div className="font-mono text-[10px] tracking-[3px] uppercase mb-7" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                Match on where you've been
              </div>
              <h2 className="font-serif text-[30px] sm:text-[34px] font-black leading-[1.08] tracking-tight mb-6" style={{ color: "var(--roam-cream)" }}>
                Your people are<br /><span className="italic" style={{ color: "var(--roam-electric)" }}>already out there</span>.
              </h2>
              <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <Link href="/signup">
                  <button className="w-full px-7 py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                          style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                          data-testid="how-it-works-signup">
                    Start your adventure <ArrowRight size={14} />
                  </button>
                </Link>
                <button onClick={onSeeEvents}
                        className="w-full px-7 py-3 rounded-2xl text-sm font-mono tracking-wider uppercase inline-flex items-center justify-center gap-2 transition-all border"
                        style={{ borderColor: "rgba(var(--roam-cream-rgb),0.18)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                        data-testid="how-it-works-events">
                  <CalendarDays size={14} /> See what's on near you
                </button>
                <button onClick={() => setI(0)}
                        className="mt-1 font-mono text-[11px] tracking-wider inline-flex items-center justify-center gap-1.5"
                        style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}
                        data-testid="how-it-works-replay">
                  <RotateCcw size={11} /> Replay
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
