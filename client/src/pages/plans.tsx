import { useState } from "react";
import { Link, useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Users, Ticket, Megaphone, ChevronRight, Check } from "lucide-react";

const inputStyle = "w-full py-3.5 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold transition-all";

function PlanCard({ title, badge, price, period, features, buttonLabel, buttonStyle, onAction, loading, accent, children }: {
  title: string; badge?: string; price: string; period: string; features: string[];
  buttonLabel: string; buttonStyle?: React.CSSProperties; onAction?: () => void; loading?: boolean;
  accent: "electric" | "ember" | "sky"; children?: React.ReactNode;
}) {
  const accentVar = accent === "electric" ? "roam-electric" : accent === "ember" ? "roam-ember" : "roam-sky";
  return (
    <div className="rounded-2xl overflow-hidden mb-4"
         style={{ border: `1.5px solid rgba(var(--${accentVar}-rgb),0.35)`, background: `linear-gradient(135deg, rgba(var(--${accentVar}-rgb),0.07) 0%, rgba(var(--${accentVar}-rgb),0.02) 100%)` }}>
      <div className="px-5 pt-5 pb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-serif text-[20px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>{title}</div>
            {badge && <div className="font-mono text-[9px] tracking-wider uppercase" style={{ color: `var(--${accentVar})` }}>{badge}</div>}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-serif text-[26px] font-bold leading-none" style={{ color: "var(--roam-cream)" }}>{price}</div>
            <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{period}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-y-1.5 mb-4">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2 font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
              <span style={{ color: `var(--${accentVar})` }}>✓</span> {f}
            </div>
          ))}
        </div>
        {children}
        {onAction && (
          <button onClick={onAction} disabled={loading}
                  className={inputStyle}
                  style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}
                  data-testid={`button-plan-${title.toLowerCase().replace(/\s+/g, "-")}`}>
            {loading ? "Redirecting…" : buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Plans() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [loadingAdventurer, setLoadingAdventurer] = useState(false);
  const [loadingBoost, setLoadingBoost] = useState(false);
  const [loadingOrganiser, setLoadingOrganiser] = useState(false);

  const startCheckout = async (endpoint: string, setter: (v: boolean) => void) => {
    if (!user) { navigate("/login"); return; }
    setter(true);
    try {
      const res = await apiRequest("POST", endpoint);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ }
    finally { setter(false); }
  };

  const isFree = !user || user.tier === "free";
  const isAdventurer = user?.tier === "adventurer" || user?.tier === "contributor";
  const isOrganiser = (user as any)?.isOrganiser;

  return (
    <div className="min-h-screen relative" data-testid="page-plans">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto px-4 pb-16 pt-4 pr-14">

          <div className="mb-6">
            <div className="font-mono text-[10px] tracking-[2px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              Membership &amp; Perks
            </div>
            <h1 className="font-serif text-3xl font-black mb-1" style={{ color: "var(--roam-cream)" }}>
              roam. plans
            </h1>
            <p className="font-mono text-[11px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              Roaming is free. Pay for what you actually want.
            </p>
          </div>

          <div className="mb-5 px-4 py-3 rounded-2xl"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)", background: "rgba(var(--roam-cream-rgb),0.03)" }}>
            <div className="font-mono text-[9px] tracking-wider uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              Explorer · Always free
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {["Discover &amp; browse people", "Receive connection requests", "Join 2 groups", "Browse all events", "View what's on"].map(f => (
                <div key={f} className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  <Check size={10} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} /> <span dangerouslySetInnerHTML={{ __html: f }} />
                </div>
              ))}
            </div>
          </div>

          {!isAdventurer && (
            <PlanCard
              title="Adventurer"
              badge="Most popular · cancel anytime"
              price="$4.99"
              period="NZD / month"
              accent="electric"
              features={[
                "Unlimited connections & matching",
                "Full messaging with every match",
                "Almost Met radar feature",
                "Bucket List adventure matching",
                "Priority placement in discovery",
                "Join unlimited groups & crews",
              ]}
              buttonLabel="Unlock Adventurer →"
              buttonStyle={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
              onAction={() => startCheckout("/api/checkout/start", setLoadingAdventurer)}
              loading={loadingAdventurer}
            >
              <div className="mb-3 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                Powered by Stripe · Cancel anytime from your profile
              </div>
            </PlanCard>
          )}

          {isAdventurer && (
            <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
              <span style={{ color: "var(--roam-electric)" }}>✦</span>
              <span className="font-mono text-[11px]" style={{ color: "var(--roam-electric)" }}>You're on Adventurer — all features unlocked.</span>
            </div>
          )}

          <div className="mb-4 rounded-2xl overflow-hidden"
               style={{ border: "1px solid rgba(var(--roam-electric-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
                  <Zap size={16} style={{ color: "var(--roam-electric)" }} />
                </div>
                <div>
                  <div className="font-serif text-[15px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>Profile Boost</div>
                  <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                    Top of discovery for 24 hours
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="font-serif text-[18px] font-bold" style={{ color: "var(--roam-cream)" }}>$1</div>
                  <div className="font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>NZD</div>
                </div>
                <button
                  onClick={() => startCheckout("/api/checkout/boost", setLoadingBoost)}
                  disabled={loadingBoost}
                  className="py-2 px-4 rounded-xl font-mono text-[10px] tracking-wider uppercase font-semibold transition-all"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)", opacity: loadingBoost ? 0.7 : 1 }}
                  data-testid="button-plan-boost">
                  {loadingBoost ? "…" : "Boost"}
                </button>
              </div>
            </div>
            <div className="px-5 pb-3 grid grid-cols-2 gap-1">
              {["Appear first in discover", "Any user can boost", "Stacks with Adventurer", "Pay per use"].map(f => (
                <div key={f} className="flex items-center gap-1.5 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                  <span style={{ color: "var(--roam-electric)" }}>·</span> {f}
                </div>
              ))}
            </div>
          </div>

          {!isOrganiser && (
            <PlanCard
              title="Squad Leader"
              badge="For group organisers · one-time, yours forever"
              price="$19.99"
              period="NZD · one time"
              accent="ember"
              features={[
                "Create unlimited groups & squads",
                "Run ticketed events (platform takes 10%)",
                "Full member management tools",
                "Custom invite links for your group",
                "Priority event notifications sent to members",
                "Create groups without Adventurer subscription",
              ]}
              buttonLabel="Unlock Squad Leader →"
              buttonStyle={{ background: "rgba(var(--roam-ember-rgb),0.18)", border: "1px solid rgba(var(--roam-ember-rgb),0.5)", color: "var(--roam-ember)" }}
              onAction={() => startCheckout("/api/checkout/organiser", setLoadingOrganiser)}
              loading={loadingOrganiser}
            >
              <div className="mb-3 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
                Pay once · no recurring fee · access never expires
              </div>
            </PlanCard>
          )}

          {isOrganiser && (
            <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
                 style={{ background: "rgba(var(--roam-ember-rgb),0.08)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)" }}>
              <span style={{ color: "var(--roam-ember)" }}>🏕️</span>
              <span className="font-mono text-[11px]" style={{ color: "var(--roam-ember)" }}>Squad Leader active — create and run groups & ticketed events.</span>
            </div>
          )}

          <div className="mb-4 rounded-2xl overflow-hidden"
               style={{ border: "1px solid rgba(var(--roam-sky-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            <div className="px-5 pt-4 pb-2 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                   style={{ background: "rgba(var(--roam-sky-rgb),0.12)", border: "1px solid rgba(var(--roam-sky-rgb),0.25)" }}>
                <Ticket size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.8)" }} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[15px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>Event Ticketing</div>
                <div className="font-mono text-[10px] mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Charge entry for your group events. roam. handles payment and takes a 10% platform fee — you keep the rest.
                </div>
                <div className="font-mono text-[9px] px-3 py-2 rounded-xl mb-2"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                  Example: You set $20 entry → attendees pay $22 → you receive $20
                </div>
                <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                  Requires Squad Leader plan · Available when creating group events
                </div>
              </div>
            </div>
            <div className="px-5 pb-4" />
          </div>

          <div className="mb-4 rounded-2xl overflow-hidden"
               style={{ border: "1px solid rgba(var(--roam-sky-rgb),0.15)", background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            <div className="px-5 pt-4 pb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                   style={{ background: "rgba(var(--roam-sky-rgb),0.1)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)" }}>
                <Megaphone size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.7)" }} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[15px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>Sponsored Listings</div>
                <div className="font-mono text-[10px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Local businesses, tour operators, and brands can reach the roam. community directly. Three placement tiers available.
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { name: "Explorer", price: "$49", days: "7 days" },
                    { name: "Trailblazer", price: "$129", days: "14 days" },
                    { name: "Summit", price: "$299", days: "30 days" },
                  ].map(t => (
                    <div key={t.name} className="p-2 rounded-xl text-center"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                      <div className="font-mono text-[8px] tracking-wider uppercase mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>{t.name}</div>
                      <div className="font-serif text-[14px] font-bold" style={{ color: "var(--roam-cream)" }}>{t.price}</div>
                      <div className="font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{t.days}</div>
                    </div>
                  ))}
                </div>
                <Link href="/advertise">
                  <div className="flex items-center gap-1 font-mono text-[10px] tracking-wider"
                       style={{ color: "rgba(var(--roam-sky-rgb),0.7)" }}
                       data-testid="link-advertise">
                    Learn more &amp; get started <ChevronRight size={12} />
                  </div>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
