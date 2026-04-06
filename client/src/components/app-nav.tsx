import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Compass, MessageCircle, Plus, User, Palette, Check, Users, CalendarDays, Camera, X } from "lucide-react";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useTheme, THEMES } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import NotificationBell from "@/components/notification-bell";

const NAV_ITEMS = [
  { path: "/discover",  label: "Discover",   icon: Compass },
  { path: "/whats-on", label: "What's On",   icon: CalendarDays },
  { path: "/groups",   label: "Groups",      icon: Users },
  { path: "/matches",  label: "Matches",     icon: MessageCircle },
  { path: "/profile",  label: "Profile",     icon: User },
];

export default function AppNav() {
  const [location, navigate] = useLocation();
  const status = useConnectionStatus();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  const dotColor = status === "online"
    ? "var(--roam-electric)"
    : status === "offline" ? "var(--roam-ember)" : "#f59e0b";
  const dotTitle = status === "online" ? "Connected" : status === "offline" ? "Offline" : "Connecting…";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false);
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl"
           style={{
             background: `rgba(var(--roam-forest-rgb),0.12)`,
             borderBottom: `1px solid rgba(var(--roam-cream-rgb),0.06)`,
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

          <div className="flex items-center gap-1">
            {user && <NotificationBell />}
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
        </div>
      </nav>

      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-[26px]"
           style={{
             background: `rgba(var(--roam-forest-rgb),0.82)`,
             backdropFilter: "blur(24px)",
             WebkitBackdropFilter: "blur(24px)",
             border: `1px solid rgba(var(--roam-cream-rgb),0.08)`,
             boxShadow: "0 4px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
           }}
           data-testid="side-nav">
        {NAV_ITEMS.map(item => {
          const active = location === item.path || (item.path === "/groups" && location.startsWith("/groups/"));
          return (
            <Link key={item.path} href={item.path}>
              <button
                title={item.label}
                className="relative w-10 h-10 rounded-[18px] flex items-center justify-center transition-all"
                style={{
                  background: active ? `rgba(var(--roam-electric-rgb),0.14)` : "transparent",
                  color: active ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.38)`,
                }}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <item.icon size={18} strokeWidth={1.8} />
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                       style={{ background: "var(--roam-electric)" }} />
                )}
              </button>
            </Link>
          );
        })}

        <div className="w-5 h-px my-0.5" style={{ background: `rgba(var(--roam-cream-rgb),0.1)` }} />

        <div className="relative" ref={createRef}>
          <button
            title="Create"
            className="w-10 h-10 rounded-[18px] flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
            style={{
              background: createOpen ? "rgba(var(--roam-electric-rgb),0.8)" : "var(--roam-electric)",
              boxShadow: `0 2px 14px rgba(var(--roam-electric-rgb),0.45)`,
            }}
            onClick={() => setCreateOpen(o => !o)}
            data-testid="nav-post">
            {createOpen
              ? <X size={16} strokeWidth={2.5} style={{ color: "var(--roam-forest)" }} />
              : <Plus size={18} strokeWidth={2.5} style={{ color: "var(--roam-forest)" }} />}
          </button>

          {createOpen && (
            <div className="absolute right-12 bottom-0 w-44 rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
                 style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left"
                  style={{ color: "var(--roam-cream)" }}
                  onClick={() => { setCreateOpen(false); navigate("/upload"); }}
                  data-testid="create-upload-photos">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                    <Camera size={15} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium leading-tight">Upload photos</div>
                    <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Share your adventure</div>
                  </div>
                </button>
                <button
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left"
                  style={{ color: "var(--roam-cream)" }}
                  onClick={() => { setCreateOpen(false); navigate("/groups"); }}
                  data-testid="create-plan-event">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                    <CalendarDays size={15} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium leading-tight">Plan an event</div>
                    <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Via your group</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
