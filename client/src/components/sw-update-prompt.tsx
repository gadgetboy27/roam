import { useEffect, useState } from "react";
import { applyServiceWorkerUpdate, SW_UPDATE_EVENT_NAME } from "@/lib/registerSW";

// Shows a small "new version available" banner when the service worker has an
// update waiting. Tapping Refresh activates the waiting worker; registerSW's
// controllerchange handler then reloads the page once onto the fresh build.
// Renders nothing unless an update is actually waiting, so it's inert by default.
export function SwUpdatePrompt() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const onUpdate = (e: Event) => setReg((e as CustomEvent).detail as ServiceWorkerRegistration);
    window.addEventListener(SW_UPDATE_EVENT_NAME, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT_NAME, onUpdate);
  }, []);

  if (!reg) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl animate-fade-up"
      style={{ bottom: "88px", background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-electric-rgb),0.4)" }}
      data-testid="sw-update-prompt"
    >
      <span className="font-mono text-[11px] tracking-wide" style={{ color: "rgba(var(--roam-cream-rgb),0.85)" }}>
        New version available
      </span>
      <button
        className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-xl"
        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
        onClick={() => applyServiceWorkerUpdate(reg)}
        data-testid="button-sw-refresh"
      >
        Refresh
      </button>
    </div>
  );
}
