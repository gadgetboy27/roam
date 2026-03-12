import { useLocation, Link } from "wouter";
import { Compass, Camera, MessageCircle, User } from "lucide-react";
import { useConnectionStatus } from "@/lib/useConnectionStatus";

const NAV_ITEMS = [
  { path: "/discover", label: "discover", icon: Compass },
  { path: "/upload", label: "upload", icon: Camera },
  { path: "/matches", label: "matches", icon: MessageCircle },
  { path: "/profile", label: "profile", icon: User },
];

export default function AppNav() {
  const [location] = useLocation();
  const status = useConnectionStatus();

  const dotColor = status === "online" ? "var(--roam-electric)" : status === "offline" ? "var(--roam-ember)" : "#f59e0b";
  const dotTitle = status === "online" ? "Connected" : status === "offline" ? "Offline" : "Connecting…";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl"
         style={{ background: "rgba(14,26,13,0.94)", borderBottom: "1px solid rgba(242,237,227,0.07)" }}>
      <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer flex items-start gap-2">
            <div>
              <span className="font-serif text-[26px] font-black tracking-tight leading-none">roam</span>
              <span style={{ color: "var(--roam-electric)" }} className="font-serif text-[26px] font-black">.</span>
              <div className="font-mono text-[9px] tracking-[2px] uppercase" style={{ color: "rgba(242,237,227,0.38)" }}>
                adventure matching
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1" title={dotTitle}>
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
        <div className="flex gap-1" data-testid="nav-tabs">
          {NAV_ITEMS.map(item => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button className="py-1.5 px-3 rounded-full text-[11px] font-mono tracking-wider uppercase flex items-center gap-1.5 transition-all"
                        style={{
                          background: active ? "var(--roam-electric)" : "transparent",
                          color: active ? "var(--roam-forest)" : "rgba(242,237,227,0.38)",
                          fontWeight: active ? 500 : 400,
                        }}
                        data-testid={`nav-${item.label}`}>
                  <item.icon size={13} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
