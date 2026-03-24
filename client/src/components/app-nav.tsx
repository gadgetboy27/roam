import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Compass, MessageCircle, Plus, User, Palette, Check } from "lucide-react";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useTheme, THEMES } from "@/lib/theme";

const BOTTOM_ITEMS = [
  { path: "/discover", label: "discover", icon: Compass },
  { path: "/matches",  label: "matches",  icon: MessageCircle },
  { path: "/profile",  label: "profile",  icon: User },
];

export default function AppNav() {
  const [location] = useLocation();
  const status = useConnectionStatus();
  const { theme, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  const dotColor = status === "online"
    ? "var(--roam-electric)"
    : status === "offline" ? "var(--roam-ember)" : "#f59e0b";
  const dotTitle = status === "online" ? "Connected" : status === "offline" ? "Offline" : "Connecting…";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl"
           style={{
             background: `rgba(var(--roam-forest-rgb),0.94)`,
             borderBottom: `1px solid rgba(var(--roam-cream-rgb),0.07)`,
           }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer flex items-start gap-1.5 flex-shrink-0">
              <div>
                <span className="font-serif text-[22px] font-black tracking-tight leading-none" style={{ color: "var(--roam-cream)" }}>roam</span>
                <span style={{ color: "var(--roam-electric)" }} className="font-serif text-[22px] font-black">.</span>
                <div className="font-mono text-[8px] tracking-[2px] uppercase" style={{ color: `rgba(var(--roam-cream-rgb),0.32)` }}>
                  adventure matching
                </div>
              </div>
              <div className="flex items-center gap-1 mt-0.5" title={dotTitle}>
                <div className="w-1.5 h-1.5 rounded-full transition-colors"
                     style={{ background: dotColor, boxShadow: status === "online" ? `0 0 4px ${dotColor}` : "none" }} />
                {status !== "online" && (
                  <span className="font-mono text-[8px] tracking-wider" style={{ color: dotColor }}>
                    {status === "offline" ? "offline" : "…"}
                  </span>
                )}
              </div>
            </div>
          </Link>

          <div className="relative" ref={paletteRef}>
            <button className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: paletteOpen ? `rgba(var(--roam-electric-rgb),0.15)` : "transparent",
                      color: paletteOpen ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.38)`,
                      border: `1px solid ${paletteOpen ? `rgba(var(--roam-electric-rgb),0.35)` : "transparent"}`,
                    }}
                    onClick={() => setPaletteOpen(o => !o)}
                    aria-label="Switch colour palette"
                    data-testid="button-theme-switcher">
              <Palette size={14} />
            </button>

            {paletteOpen && (
              <div className="absolute right-0 top-10 rounded-2xl p-3 z-[60] min-w-[172px] animate-fade-up shadow-2xl"
                   style={{
                     background: "var(--roam-surface)",
                     border: `1px solid rgba(var(--roam-cream-rgb),0.10)`,
                   }}
                   data-testid="palette-dropdown">
                <p className="font-mono text-[8px] tracking-[1.5px] uppercase mb-2.5"
                   style={{ color: `rgba(var(--roam-cream-rgb),0.35)` }}>
                  Colour palette
                </p>
                <div className="flex flex-col gap-1.5">
                  {THEMES.map(t => (
                    <button key={t.id}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all w-full text-left"
                            style={{
                              background: theme === t.id ? `rgba(var(--roam-electric-rgb),0.12)` : "transparent",
                              border: `1px solid ${theme === t.id ? `rgba(var(--roam-electric-rgb),0.3)` : "transparent"}`,
                            }}
                            onClick={() => { setTheme(t.id); setPaletteOpen(false); }}
                            data-testid={`theme-${t.id}`}>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-4 h-4 rounded-full border-2"
                             style={{ background: t.swatch, borderColor: `rgba(var(--roam-cream-rgb),0.2)` }} />
                        <div className="w-3 h-3 rounded-full"
                             style={{ background: t.accentSwatch }} />
                      </div>
                      <span className="font-mono text-[10px] tracking-wider flex-1"
                            style={{ color: theme === t.id ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.7)` }}>
                        {t.label}
                      </span>
                      {theme === t.id && <Check size={11} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl"
           style={{
             background: `rgba(var(--roam-forest-rgb),0.96)`,
             borderTop: `1px solid rgba(var(--roam-cream-rgb),0.08)`,
           }}
           data-testid="bottom-nav">
        <div className="max-w-lg mx-auto flex items-center justify-around px-4 pt-2 pb-[env(safe-area-inset-bottom,8px)]" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          {BOTTOM_ITEMS.slice(0, 2).map(item => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button className="flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all"
                        style={{ color: active ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.35)` }}
                        data-testid={`nav-${item.label}`}>
                  <item.icon size={22} strokeWidth={active ? 2.2 : 1.7} />
                  <span className="font-mono text-[9px] tracking-wider uppercase">{item.label}</span>
                </button>
              </Link>
            );
          })}

          <Link href="/upload">
            <button className="flex flex-col items-center -mt-5 transition-all hover:scale-105"
                    data-testid="nav-post">
              <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                   style={{
                     background: "var(--roam-electric)",
                     boxShadow: "0 4px 20px rgba(var(--roam-electric-rgb),0.45)",
                   }}>
                <Plus size={26} style={{ color: "var(--roam-electric-fg)" }} strokeWidth={2.5} />
              </div>
              <span className="font-mono text-[9px] tracking-wider uppercase mt-1" style={{ color: `rgba(var(--roam-cream-rgb),0.35)` }}>post</span>
            </button>
          </Link>

          {BOTTOM_ITEMS.slice(2).map(item => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button className="flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all"
                        style={{ color: active ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.35)` }}
                        data-testid={`nav-${item.label}`}>
                  <item.icon size={22} strokeWidth={active ? 2.2 : 1.7} />
                  <span className="font-mono text-[9px] tracking-wider uppercase">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
