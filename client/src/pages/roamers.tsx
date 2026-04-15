import { useState } from "react";
import { useLocation, Link } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Users, Lock, Globe, Plus, Tent, Ship, Mountain, Building2,
  Check, X, ChevronRight, ArrowRight, Star, Calendar, MessageSquare, Shield,
} from "lucide-react";

const GROUP_TYPES = [
  {
    id: "squad",
    label: "Squad",
    icon: <Tent size={16} />,
    range: "2–5 people",
    desc: "A tight-knit crew for close adventures",
  },
  {
    id: "crew",
    label: "Crew",
    icon: <Ship size={16} />,
    range: "6–20 people",
    desc: "A social adventure group with room to grow",
  },
  {
    id: "community",
    label: "Community",
    icon: <Mountain size={16} />,
    range: "20–100 people",
    desc: "An open community built around shared passions",
  },
  {
    id: "organiser",
    label: "Organiser",
    icon: <Building2 size={16} />,
    range: "Unlimited",
    desc: "For businesses, event series, and organisations",
  },
];

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad", crew: "Crew", community: "Community", organiser: "Organiser",
};
const GROUP_TYPE_ICON: Record<string, React.ReactNode> = {
  squad: <Tent size={13} />, crew: <Ship size={13} />,
  community: <Mountain size={13} />, organiser: <Building2 size={13} />,
};
const GROUP_TYPE_RANGE: Record<string, string> = {
  squad: "2–5", crew: "6–20", community: "20–100", organiser: "∞",
};

const ELIGIBILITY_ITEMS = [
  { key: "tier", label: "Adventurer tier (or Founding Member)", action: "/profile", actionLabel: "Upgrade →" },
  { key: "photo", label: "At least one approved adventure photo", action: "/upload", actionLabel: "Upload →" },
  { key: "tagline", label: "Profile tagline set", action: "/profile", actionLabel: "Edit profile →" },
  { key: "tags", label: "3+ adventure tags on profile", action: "/profile", actionLabel: "Edit profile →" },
];

function GroupCard({ group, myGroupIds, onClick }: {
  group: any; myGroupIds: string[]; onClick: () => void;
}) {
  const isMember = myGroupIds.includes(group.id);
  const tags: string[] = group.adventureTags ?? [];
  return (
    <button className="w-full text-left rounded-2xl overflow-hidden transition-all"
            style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.09)" }}
            onClick={onClick} data-testid={`group-card-${group.id}`}>
      {group.coverImageUrl ? (
        <div className="w-full h-32 overflow-hidden">
          <img src={group.coverImageUrl} alt={group.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-20 flex items-center justify-center"
             style={{ background: "linear-gradient(135deg,rgba(var(--roam-electric-rgb),0.12),rgba(var(--roam-cream-rgb),0.04))" }}>
          <span style={{ color: "rgba(var(--roam-cream-rgb),0.2)", fontSize: "32px" }}>r.</span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-base leading-tight truncate" style={{ color: "var(--roam-cream)" }}>
                {group.name}
              </span>
              {isMember && (
                <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                  member
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                {GROUP_TYPE_ICON[group.type]} {GROUP_TYPE_LABEL[group.type] ?? group.type} · {GROUP_TYPE_RANGE[group.type] ?? "?"}
              </span>
              {group.location && (
                <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  <MapPin size={10} /> {group.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {group.visibility === "closed" ? <Lock size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} /> : <Globe size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />}
            <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              <Users size={11} /> {group.memberCount ?? 0}
            </span>
          </div>
        </div>
        {group.description && (
          <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>{group.description}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.45)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                {t}
              </span>
            ))}
            {tags.length > 4 && <span className="text-[10px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>+{tags.length - 4}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (groupId: string) => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"type" | "details">("type");
  const [form, setForm] = useState({
    name: "", type: "", description: "", location: "", visibility: "open",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/groups", {
      name: form.name.trim(),
      type: form.type,
      description: form.description || null,
      location: form.location || null,
      visibility: form.visibility,
    }),
    onSuccess: async (res) => {
      const group = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my-led"] });
      toast({ description: `${group.name} created! Add your first event.` });
      onCreated(group.id);
    },
    onError: (e: any) => toast({ variant: "destructive", description: e.message || "Failed to create group" }),
  });

  const canAdvance = form.type !== "" && form.name.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4"
         style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
             style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
          <div>
            <h2 className="font-serif text-xl font-black" style={{ color: "var(--roam-cream)" }}>
              {step === "type" ? "What kind of group?" : "Name your group"}
            </h2>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              {step === "type" ? "Pick the type that fits — you can always edit later" : "Add a name and optional details"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.5)" }}>
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {step === "type" ? (
            <>
              {GROUP_TYPES.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))}
                        className="w-full flex items-start gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all"
                        style={{
                          background: form.type === t.id ? "rgba(var(--roam-electric-rgb),0.1)" : "rgba(var(--roam-cream-rgb),0.04)",
                          border: `1px solid ${form.type === t.id ? "rgba(var(--roam-electric-rgb),0.35)" : "rgba(var(--roam-cream-rgb),0.08)"}`,
                        }}
                        data-testid={`group-type-${t.id}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{
                         background: form.type === t.id ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.06)",
                         color: form.type === t.id ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)",
                       }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-[15px]" style={{ color: "var(--roam-cream)" }}>{t.label}</span>
                      <span className="font-mono text-[10px]" style={{ color: form.type === t.id ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.35)" }}>{t.range}</span>
                    </div>
                    <p className="font-mono text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{t.desc}</p>
                  </div>
                  {form.type === t.id && <Check size={14} style={{ color: "var(--roam-electric)", flexShrink: 0, marginTop: 4 }} />}
                </button>
              ))}

              <div className="pt-1">
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Group name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Auckland Summit Seekers"
                  maxLength={60}
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[13px] outline-none"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                  data-testid="input-group-name"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Description <span style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>— optional</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What's this group about? Who's it for?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none resize-none"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                />
              </div>
              <div>
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Location <span style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>— optional</span></label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Auckland, NZ"
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                />
              </div>
              <div>
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1.5 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Membership</label>
                <div className="flex gap-2">
                  {[["open", "Open — anyone can join"], ["closed", "Closed — leader approves"]] as const}
                  {(["open", "closed"] as const).map(v => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, visibility: v }))}
                            className="flex-1 py-2.5 rounded-xl font-mono text-[11px] transition-all"
                            style={{
                              background: form.visibility === v ? "rgba(var(--roam-electric-rgb),0.12)" : "rgba(var(--roam-cream-rgb),0.05)",
                              border: `1px solid ${form.visibility === v ? "rgba(var(--roam-electric-rgb),0.35)" : "rgba(var(--roam-cream-rgb),0.1)"}`,
                              color: form.visibility === v ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.55)",
                            }}>
                      {v === "open" ? "Open" : "Closed"}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                  {form.visibility === "open" ? "Anyone can join — great for growing communities" : "You approve each request — better for tight-knit groups"}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 flex items-center gap-2"
             style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
          {step === "details" && (
            <button onClick={() => setStep("type")}
                    className="flex-1 py-3 rounded-2xl font-mono text-[12px] font-medium transition-all"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.6)" }}>
              ← Back
            </button>
          )}
          {step === "type" ? (
            <button
              disabled={!canAdvance}
              onClick={() => setStep("details")}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-mono text-[12px] font-semibold transition-all"
              style={{
                background: canAdvance ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.08)",
                color: canAdvance ? "var(--roam-forest)" : "rgba(var(--roam-cream-rgb),0.3)",
              }}
              data-testid="button-group-next">
              Next — add details <ChevronRight size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-mono text-[12px] font-semibold transition-all"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                data-testid="button-create-group-submit">
                {createMutation.isPending ? "Creating…" : <>Create & plan events <ArrowRight size={14} /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Roamers() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "squad" | "crew" | "community" | "organiser">("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: groups = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/groups"] });

  const { data: eligibility } = useQuery<{ eligible: boolean; reason?: string; checks?: Record<string, boolean> }>({
    queryKey: ["/api/groups/eligibility/check"],
    enabled: !!user,
  });

  const myGroupIds: string[] = [];
  if (user) groups.forEach(g => { if (g.leaderId === user.id) myGroupIds.push(g.id); });

  const filtered = filter === "all" ? groups : groups.filter(g => g.type === filter);

  const handleCreated = (groupId: string) => {
    setShowCreate(false);
    navigate(`/groups/${groupId}?tab=events`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      <AppNav />

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-serif text-3xl font-black" style={{ color: "var(--roam-cream)" }}>groups.</h1>
              <p className="text-sm mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>Find your adventure crew</p>
            </div>
            {user && eligibility?.eligible && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                data-testid="button-create-group">
                <Plus size={15} /> New group
              </button>
            )}
          </div>

          {user && eligibility && !eligibility.eligible && (
            <div className="mt-4 rounded-2xl overflow-hidden"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
              <div className="px-4 pt-4 pb-2">
                <div className="font-mono text-[10px] tracking-wider uppercase mb-3"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>To lead a group, you need:</div>
                <div className="space-y-2">
                  {ELIGIBILITY_ITEMS.map(item => {
                    const done = eligibility.checks?.[item.key] ?? false;
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                               style={{ background: done ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.06)", border: `1px solid ${done ? "rgba(var(--roam-electric-rgb),0.4)" : "rgba(var(--roam-cream-rgb),0.12)"}` }}>
                            {done && <Check size={9} style={{ color: "var(--roam-electric)" }} />}
                          </div>
                          <span className="font-mono text-[11px]" style={{ color: done ? "rgba(var(--roam-cream-rgb),0.6)" : "rgba(var(--roam-cream-rgb),0.8)" }}>
                            {item.label}
                          </span>
                        </div>
                        {!done && (
                          <Link href={item.action}>
                            <span className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>
                              {item.actionLabel}
                            </span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3 mt-1" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                <p className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Meanwhile — join an existing group to RSVP events and connect with adventurers.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 space-y-3">
          <div className="rounded-2xl p-4"
               style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.09)" }}>
            <div className="font-serif text-[14px] font-bold mb-3" style={{ color: "var(--roam-cream)" }}>
              What is a Group?
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { icon: Calendar, label: "Plan real events", desc: "RSVP to hikes, surf days, climbs and more" },
                { icon: MessageSquare, label: "Campsite chat", desc: "A private crew chat for approved members" },
                { icon: Users, label: "Find your people", desc: "Connect with verified adventurers near you" },
                { icon: Shield, label: "Verified members", desc: "Every member is reviewed before approval" },
              ].map(b => (
                <div key={b.label} className="rounded-xl p-2.5"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                  <b.icon size={12} className="mb-1.5" style={{ color: "var(--roam-electric)" }} />
                  <div className="font-mono text-[10px] font-semibold mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>{b.label}</div>
                  <div className="font-mono text-[9px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>{b.desc}</div>
                </div>
              ))}
            </div>
            <div className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Choose your size — <strong style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Squad</strong> (2–5), <strong style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Crew</strong> (6–20), <strong style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Community</strong> (20–100), or <strong style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Organiser</strong> for businesses and event series. Open groups anyone can join. Closed groups require leader approval.
            </div>
            {user && eligibility?.eligible && (
              <button onClick={() => setShowCreate(true)}
                      className="font-mono text-[11px] flex items-center gap-1.5"
                      style={{ color: "var(--roam-electric)" }}
                      data-testid="button-explainer-create">
                <Plus size={12} /> Start your own group →
              </button>
            )}
            {user && eligibility && !eligibility.eligible && (
              <p className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                Complete your profile to lead a group — or browse below to join one.
              </p>
            )}
            {!user && (
              <Link href="/login">
                <span className="font-mono text-[11px] flex items-center gap-1" style={{ color: "var(--roam-electric)" }}>
                  Sign in to join or start a group →
                </span>
              </Link>
            )}
          </div>

          {user && (user as any).isFoundingMember && eligibility?.eligible && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
              <Star size={14} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
              <div>
                <div className="font-mono text-[10px] font-semibold" style={{ color: "var(--roam-electric)" }}>Founding Leader</div>
                <div className="font-mono text-[9px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  As one of our first 50 members, you can lead groups and invite people directly — even before upgrading your subscription.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 flex flex-wrap gap-2 mb-5">
          {(["all", "squad", "crew", "community", "organiser"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all"
                    style={{
                      background: filter === f ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)",
                      color: filter === f ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.5)",
                      border: filter === f ? "none" : "1px solid rgba(var(--roam-cream-rgb),0.08)",
                    }}
                    data-testid={`filter-${f}`}>
              {f === "all" ? "All" : f === "squad" ? "Squad 2–5" : f === "crew" ? "Crew 6–20" : f === "community" ? "Community 20+" : "Organiser"}
            </button>
          ))}
        </div>

        <div className="px-5 space-y-3">
          {isLoading && [1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                <Users size={24} style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }} />
              </div>
              <p className="font-serif text-[16px] font-bold mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                {filter === "all" ? "No groups yet" : `No ${filter} groups yet`}
              </p>
              <p className="font-mono text-[11px] mb-5 leading-relaxed max-w-[240px] mx-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                {filter === "all"
                  ? "Be the first to gather your adventure crew — Squads, Crews, Communities and Organisers welcome."
                  : `No ${filter} groups exist yet. Try browsing all groups or start your own.`}
              </p>
              {user && eligibility?.eligible && (
                <button onClick={() => setShowCreate(true)}
                        className="font-mono text-[11px] px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                        data-testid="button-empty-create">
                  <Plus size={12} /> Start a group →
                </button>
              )}
              {!user && (
                <Link href="/login">
                  <span className="font-mono text-[11px] px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}>
                    Sign in to get started →
                  </span>
                </Link>
              )}
            </div>
          )}
          {!isLoading && filtered.map(g => (
            <GroupCard key={g.id} group={g} myGroupIds={myGroupIds} onClick={() => navigate(`/groups/${g.id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}
