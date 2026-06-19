import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Ticket, Megaphone, ChevronRight, Check } from "lucide-react";

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
            <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{period}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-y-1.5 mb-4">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2 font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.82)" }}>
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
  const [loadingConnect, setLoadingConnect] = useState(false);

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

  // Time-based entitlement: a Boost is "active" until boostExpiresAt passes.
  const boostExpiresAt = (user as any)?.boostExpiresAt;
  const boostActive = !!boostExpiresAt && new Date(boostExpiresAt) > new Date();
  const boostHoursLeft = boostActive
    ? Math.max(1, Math.ceil((new Date(boostExpiresAt).getTime() - Date.now()) / 3_600_000))
    : 0;

  // Payout-account status — needed to know if a Squad Leader can actually
  // collect ticket revenue yet (Connect onboarding complete).
  const { data: connectStatus } = useQuery<{ status: string; payoutsEnabled: boolean }>({
    queryKey: ["/api/stripe/connect/status"],
    enabled: !!user && !!isOrganiser,
  });
  const payoutsReady = connectStatus?.status === "active";

  return (
    <div className="min-h-screen relative" data-testid="page-plans">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto px-4 pb-16 pt-4 pr-14">

          <div className="mb-6">
            <Link href="/profile" className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase mb-3 transition-opacity hover:opacity-70"
                  style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}
                  data-testid="link-back-plans">
              ← Back to profile
            </Link>
            <div className="font-mono text-[10px] tracking-[2px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
              Membership &amp; Perks
            </div>
            <h1 className="font-serif text-3xl font-black mb-1" style={{ color: "var(--roam-cream)" }}>
              roam. plans
            </h1>
            <p className="font-mono text-[11px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
              Roaming is free. Pay for what you actually want.
            </p>
          </div>

          <div className="mb-5 px-4 py-3 rounded-2xl"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)", background: "rgba(var(--roam-cream-rgb),0.03)" }}>
            <div className="font-mono text-[9px] tracking-wider uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>
              Explorer · Always free
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {["Discover &amp; browse people", "Receive connection requests", "Join 2 groups", "Browse all events", "View what's on"].map(f => (
                <div key={f} className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>
                  <Check size={10} style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }} /> <span dangerouslySetInnerHTML={{ __html: f }} />
                </div>
              ))}
            </div>
          </div>

          {!isAdventurer && (
            <PlanCard
              title="Adventurer"
              badge="Most popular · cancel anytime"
              price="$5"
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
              <div className="mb-3 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.52)" }}>
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
                  <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                    Top of discovery for 24 hours
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="font-serif text-[18px] font-bold" style={{ color: "var(--roam-cream)" }}>$5</div>
                  <div className="font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>NZD</div>
                </div>
                <button
                  onClick={() => { if (!boostActive) startCheckout("/api/checkout/boost", setLoadingBoost); }}
                  disabled={loadingBoost || boostActive}
                  title={boostActive ? `Boost active — ${boostHoursLeft}h left` : undefined}
                  className="py-2 px-4 rounded-xl font-mono text-[10px] tracking-wider uppercase font-semibold transition-all"
                  style={{
                    background: boostActive ? "rgba(var(--roam-cream-rgb),0.06)" : "rgba(var(--roam-electric-rgb),0.12)",
                    border: `1px solid ${boostActive ? "rgba(var(--roam-cream-rgb),0.12)" : "rgba(var(--roam-electric-rgb),0.3)"}`,
                    color: boostActive ? "rgba(var(--roam-cream-rgb),0.45)" : "var(--roam-electric)",
                    opacity: loadingBoost ? 0.7 : 1,
                    cursor: boostActive ? "not-allowed" : "pointer",
                  }}
                  data-testid="button-plan-boost">
                  {loadingBoost ? "…" : boostActive ? `Active · ${boostHoursLeft}h` : "Boost"}
                </button>
              </div>
            </div>
            <div className="px-5 pb-3 grid grid-cols-2 gap-1">
              {["Appear first in discover", "Any user can boost", "Stacks with Adventurer", "Pay per use"].map(f => (
                <div key={f} className="flex items-center gap-1.5 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                  <span style={{ color: "var(--roam-electric)" }}>·</span> {f}
                </div>
              ))}
            </div>
          </div>

          {!isOrganiser && (
            <PlanCard
              title="Squad Leader"
              badge="For group organisers · one-time, yours forever"
              price="$20"
              period="NZD · one time"
              accent="ember"
              features={[
                "Create unlimited groups & squads",
                "Run ticketed events (attendees pay a 10% fee — you keep 100%)",
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
              <div className="mb-3 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.52)" }}>
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
                <Ticket size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[15px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>Event Ticketing</div>
                <div className="font-mono text-[10px] mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                  Charge entry for your group events. roam. handles payment securely — attendees pay a small 10% service fee on top, and you keep 100% of your ticket price.
                </div>
                <div className="font-mono text-[9px] px-3 py-2 rounded-xl mb-3"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)", color: "rgba(var(--roam-cream-rgb),0.78)" }}>
                  Example: you set $20 → attendee pays $22 → you receive your full $20
                </div>

                {/* 3-step path — shows where the user is in unlocking ticketing */}
                <div className="flex items-center gap-1.5 mb-3">
                  {[
                    { label: "Squad Leader", done: !!isOrganiser },
                    { label: "Payouts", done: !!isOrganiser && payoutsReady },
                    { label: "Ticket an event", done: false },
                  ].map((s, i) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] flex items-center gap-1"
                            style={{ color: s.done ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.45)" }}>
                        {s.done ? <Check size={9} /> : <span>{i + 1}.</span>}{s.label}
                      </span>
                      {i < 2 && <span style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>→</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* State-aware CTA: sell Squad Leader → set up payouts → create event */}
            <div className="px-5 pb-4">
              {!isOrganiser && (
                <button
                  onClick={() => startCheckout("/api/checkout/organiser", setLoadingOrganiser)}
                  disabled={loadingOrganiser}
                  className="w-full py-3 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(var(--roam-sky-rgb),0.14)", border: "1px solid rgba(var(--roam-sky-rgb),0.4)", color: "rgba(var(--roam-sky-rgb),0.95)", opacity: loadingOrganiser ? 0.7 : 1 }}
                  data-testid="button-ticketing-unlock">
                  {loadingOrganiser ? "…" : <>Unlock with Squad Leader — $20 once <ChevronRight size={13} /></>}
                </button>
              )}
              {isOrganiser && !payoutsReady && (
                <button
                  onClick={() => startCheckout("/api/stripe/connect/start", setLoadingConnect)}
                  disabled={loadingConnect}
                  className="w-full py-3 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(var(--roam-sky-rgb),0.14)", border: "1px solid rgba(var(--roam-sky-rgb),0.4)", color: "rgba(var(--roam-sky-rgb),0.95)", opacity: loadingConnect ? 0.7 : 1 }}
                  data-testid="button-ticketing-payouts">
                  {loadingConnect ? "…" : <>Set up payouts to get paid <ChevronRight size={13} /></>}
                </button>
              )}
              {isOrganiser && payoutsReady && (
                <button
                  onClick={() => navigate("/groups")}
                  className="w-full py-3 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.14)", border: "1px solid rgba(var(--roam-electric-rgb),0.4)", color: "var(--roam-electric)" }}
                  data-testid="button-ticketing-create">
                  Create a ticketed event <ChevronRight size={13} />
                </button>
              )}
              <div className="mt-2 font-mono text-[9px] text-center" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                {!isOrganiser
                  ? "Ticketing is included with Squad Leader"
                  : !payoutsReady
                  ? "Connect your bank so ticket revenue reaches you"
                  : "Set a ticket price when you create a group event"}
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl overflow-hidden"
               style={{ border: "1px solid rgba(var(--roam-sky-rgb),0.15)", background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            <div className="px-5 pt-4 pb-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                   style={{ background: "rgba(var(--roam-sky-rgb),0.1)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)" }}>
                <Megaphone size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.85)" }} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-[15px] font-black mb-0.5" style={{ color: "var(--roam-cream)" }}>Sponsored Listings</div>
                <div className="font-mono text-[10px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
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
                      <div className="font-mono text-[8px] tracking-wider uppercase mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>{t.name}</div>
                      <div className="font-serif text-[14px] font-bold" style={{ color: "var(--roam-cream)" }}>{t.price}</div>
                      <div className="font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>{t.days}</div>
                    </div>
                  ))}
                </div>
                <Link href="/advertise">
                  <div className="flex items-center gap-1 font-mono text-[10px] tracking-wider"
                       style={{ color: "var(--roam-sky)" }}
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
