import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mountain, Camera, MapPin, Compass, Zap, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=600&q=80&fit=crop",
  "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=600&q=80&fit=crop",
];

const FEATURES = [
  {
    icon: Camera,
    title: "Photo-First Matching",
    desc: "Post your adventure photos. LetsRoam.life reads the places, not just your face.",
  },
  {
    icon: Compass,
    title: "Adventure DNA",
    desc: "Matched on shared experiences — hiking trails, surf breaks, night markets, and more.",
  },
  {
    icon: Zap,
    title: "Almost Met",
    desc: "Discover people you nearly crossed paths with at the same place and time.",
  },
  {
    icon: MapPin,
    title: "Bucket List Matching",
    desc: "Pin destinations you want to visit. Match with people headed the same way.",
  },
];

const STORIES = [
  {
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=300&q=80&fit=crop",
    name: "Mia & Alex",
    overlap: 78,
    shared: "Alpine hiking, night markets, coastal walks",
    quote: "We'd both been to Milford Sound the same week and never knew it.",
  },
  {
    img: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=300&q=80&fit=crop",
    name: "Kai & Jordan",
    overlap: 64,
    shared: "Surfing, urban exploration, food trails",
    quote: "Matched on surf photos. Our first date was at a break we'd both ridden.",
  },
  {
    img: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=300&q=80&fit=crop",
    name: "Sam & Riley",
    overlap: 59,
    shared: "Backpacking, kayaking, forest trails",
    quote: "We matched on Abel Tasman photos. Now we hike it together every summer.",
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) navigate("/discover");
  }, [user, loading, navigate]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen relative" data-testid="page-landing">
      <div className="topo-bg" />

      <div className="relative z-10">
        <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.07]" style={{ background: "rgba(var(--roam-forest-rgb),0.94)" }}>
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="font-serif text-2xl font-black tracking-tight" data-testid="text-logo">roam</span>
              <span className="text-[var(--roam-electric)] font-serif text-2xl font-black">.</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <button className="px-5 py-2 rounded-full text-xs font-mono tracking-wider uppercase transition-all"
                        style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.6)" }}
                        data-testid="button-signin-nav">
                  Sign In
                </button>
              </Link>
              <Link href="/signup">
                <button className="px-5 py-2 rounded-full text-xs font-mono tracking-wider uppercase transition-all"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                        data-testid="button-signup-nav">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </nav>

        <section className="relative pt-8 pb-16 px-5">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="animate-fade-up">
                <div className="font-mono text-[10px] tracking-[3px] uppercase mb-4" style={{ color: "var(--roam-electric)" }}>
                  Adventure Matching
                </div>
                <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6">
                  Match on<br/>
                  <span className="italic" style={{ color: "var(--roam-electric)" }}>where you've</span><br/>
                  been
                </h1>
                <p className="text-base md:text-lg leading-relaxed max-w-md mb-8" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                  Post your adventure photos. LetsRoam.life matches you with people who share your kind of adventure — not just your look.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/signup">
                    <button className="px-7 py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5"
                            style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                            data-testid="button-signup-hero">
                      Start Your Adventure
                    </button>
                  </Link>
                  <Link href="/signup">
                    <button className="px-7 py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase transition-all border"
                            style={{ borderColor: "rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.6)" }}
                            data-testid="button-explore">
                      See how it works
                    </button>
                  </Link>
                </div>
              </div>

              <div className="animate-fade-up-1 hidden lg:block">
                <div className="grid grid-cols-2 grid-rows-[160px_160px_160px] gap-2 max-w-md ml-auto">
                  <div className="row-span-3 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                    <img src={HERO_IMAGES[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  {HERO_IMAGES.slice(1).map((url, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-5" style={{ background: "rgba(var(--roam-moss-rgb),0.5)" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="font-mono text-[10px] tracking-[3px] uppercase mb-3" style={{ color: "var(--roam-electric)" }}>
                How it works
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-black">
                Not another <span className="italic" style={{ color: "var(--roam-electric)" }}>selfie app</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {FEATURES.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl transition-all"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}
                     data-testid={`card-feature-${i}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.1)" }}>
                    <f.icon size={18} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="font-mono text-[10px] tracking-[3px] uppercase mb-3" style={{ color: "var(--roam-sky)" }}>
                Adventure stories
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-black">
                Real <span className="italic" style={{ color: "var(--roam-electric)" }}>matches</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {STORIES.map((s, i) => (
                <div key={i} className="rounded-2xl overflow-hidden"
                     style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}
                     data-testid={`card-story-${i}`}>
                  <div className="h-44 overflow-hidden">
                    <img src={s.img} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                        {s.overlap}%
                      </span>
                    </div>
                    <div className="font-mono text-[10px] mb-3" style={{ color: "var(--roam-electric)" }}>{s.shared}</div>
                    <p className="text-xs italic leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>"{s.quote}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-5">
          <div className="max-w-3xl mx-auto">
            <div className="text-center p-10 rounded-3xl"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.05)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
              <Mountain size={40} className="mx-auto mb-4" style={{ color: "var(--roam-electric)" }} />
              <h2 className="font-serif text-3xl font-black mb-3">
                Ready to <span className="italic" style={{ color: "var(--roam-electric)" }}>roam</span>?
              </h2>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                Join free. Upload your adventure photos. Let Roam.life find your people.
              </p>
              <Link href="/signup">
                <button className="px-8 py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                        data-testid="button-signup-cta">
                  Create Account <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        </section>

        <footer className="py-8 px-5 border-t" style={{ borderColor: "rgba(var(--roam-cream-rgb),0.06)" }}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <span className="font-serif text-lg font-black">roam</span>
              <span style={{ color: "var(--roam-electric)" }} className="font-serif text-lg font-black">.</span>
              <span className="font-mono text-[9px] ml-2 tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                Swiperight Apps Aotearoa
              </span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/advertise">
                <span className="font-mono text-[10px] tracking-wider cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "rgba(var(--roam-electric-rgb),0.6)" }}>
                  Advertise
                </span>
              </Link>
              <Link href="/privacy">
                <span className="font-mono text-[10px] tracking-wider cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Privacy Policy
                </span>
              </Link>
              <Link href="/terms">
                <span className="font-mono text-[10px] tracking-wider cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Terms of Service
                </span>
              </Link>
              <Link href="/data-deletion">
                <span className="font-mono text-[10px] tracking-wider cursor-pointer hover:opacity-70 transition-opacity" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Data Deletion
                </span>
              </Link>
              <span className="font-mono text-[10px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                © 2025 · letsroam.life
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
