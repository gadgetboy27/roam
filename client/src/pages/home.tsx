import { useState } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { computeVibeWord } from "@/lib/fingerprint";
import ShareSheet from "@/components/share-sheet";
import {
  ShieldCheck, ChevronRight, Plus, Calendar, MapPin, Users, Star, Compass, UserPlus,
} from "lucide-react";

// ── PROTOTYPE: personal Home dashboard ──────────────────────────────────────
// Aggregates the viewer's crew, next event, groups, and adventure status into
// one glanceable hub. Reachable at /home; not yet wired into the nav so prod is
// untouched. Read-only widgets link out to the pages that own the editing.

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad", crew: "Crew", community: "Community", organiser: "Organiser",
};

function isPairSquad(g: any): boolean {
  return g.type === "squad" && (g.memberCount ?? 0) <= 2 && / & /.test(g.name ?? "");
}

function smartDate(d?: string | Date): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + ` · ${time}`;
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="font-mono text-[10px] tracking-wider uppercase mb-2.5 flex items-center gap-2"
         style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
      {children}{typeof count === "number" && <span style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>· {count}</span>}
    </div>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/mine"],
    enabled: !!user,
    refetchInterval: 20_000,
  });
  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
    enabled: !!user,
  });

  const myId = user?.id;
  const crew = myGroups.filter(isPairSquad);
  const groups = myGroups.filter(g => !isPairSquad(g));
  const nextEvent = [...upcoming]
    .filter(e => e?.startAt)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

  const firstName = ((user as any)?.nickname || user?.name || "").trim().split(/\s+/)[0] || "Roamer";
  const vibeWord = computeVibeWord((user as any)?.adventureTags ?? []);
  const tierLabel = user?.tier === "free" ? "Explorer" : user?.tier === "contributor" ? "Contributor" : "Adventurer";
  const verified = !!(user as any)?.identityVerified;
  const founding = !!(user as any)?.isFoundingMember;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      <AppNav />

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Greeting */}
        <div className="px-5 pt-6 pb-4 flex items-end justify-between">
          <div>
            <h1 className="font-serif text-3xl font-black" style={{ color: "var(--roam-cream)" }}>
              Kia ora, {firstName} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              Here's what's happening in your world.
            </p>
          </div>
          <button onClick={() => navigate("/safety")} aria-label="Safety"
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.55)" }}>
            <ShieldCheck size={16} />
          </button>
        </div>

        {/* Verification nudge (only if not verified) */}
        {user && !verified && (
          <div className="px-5 pb-4">
            <button onClick={() => navigate("/profile")}
                    className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                    data-testid="home-verify-nudge">
              <ShieldCheck size={18} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium" style={{ color: "var(--roam-cream)" }}>Get verified</div>
                <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  Verified profiles get more matches and unlock trust.
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--roam-electric)" }} />
            </button>
          </div>
        )}

        {/* Adventure-tags nudge — recovers the deferred onboarding step so users who
            sped into Discover still get matched well. */}
        {user && (((user as any)?.adventureTags?.length ?? 0) === 0) && (
          <div className="px-5 pb-4">
            <button onClick={() => navigate("/profile")}
                    className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                    data-testid="home-tags-nudge">
              <Compass size={18} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium" style={{ color: "var(--roam-cream)" }}>Sharpen your matches</div>
                <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  Add a few adventure tags so we match you on what you love.
                </div>
              </div>
              <ChevronRight size={16} style={{ color: "var(--roam-electric)" }} />
            </button>
          </div>
        )}

        {/* Your crew (1:1 connections) */}
        {crew.length > 0 && (
          <div className="px-5 pb-5">
            <SectionLabel count={crew.length}>Your crew</SectionLabel>
            <div className="flex gap-3.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {crew.map(g => {
                const other = (g.members ?? []).find((m: any) => m.id !== myId) ?? (g.members ?? [])[0];
                const name = ((other?.name || g.name || "") as string).trim().split(/\s+/)[0] || "Crew";
                return (
                  <button key={g.id} onClick={() => navigate(`/groups/${g.id}?tab=campsite`)}
                          className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[60px] group/c"
                          data-testid={`home-crew-${g.id}`}>
                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center transition-transform group-active/c:scale-95"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                      {other?.avatarUrl
                        ? <img src={other.avatarUrl} alt={name} className="w-full h-full object-cover" />
                        : <span className="font-serif font-bold text-[16px]" style={{ color: "var(--roam-electric)" }}>{name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <span className="font-mono text-[10px] truncate w-full text-center" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Next adventure */}
        <div className="px-5 pb-5">
          <SectionLabel>Next adventure</SectionLabel>
          {nextEvent ? (
            <button onClick={() => navigate(`/groups/${nextEvent.group?.id}`)}
                    className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                    style={{ background: "linear-gradient(155deg, var(--roam-surface) 55%, rgba(var(--roam-electric-rgb),0.07))", border: "1px solid rgba(var(--roam-electric-rgb),0.22)" }}
                    data-testid="home-next-event">
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar size={13} style={{ color: "var(--roam-electric)" }} />
                <span className="font-mono text-[11px] tracking-wide" style={{ color: "var(--roam-electric)" }}>{smartDate(nextEvent.startAt)}</span>
              </div>
              <div className="font-serif font-bold text-[16px] leading-snug mb-1" style={{ color: "var(--roam-cream)" }}>{nextEvent.title}</div>
              <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                <span>{nextEvent.group?.name}</span>
                {nextEvent.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {nextEvent.location}</span>}
                {nextEvent.isRsvpd && <span style={{ color: "var(--roam-electric)" }}>· Going ✓</span>}
              </div>
            </button>
          ) : (
            <button onClick={() => navigate("/whats-on")}
                    className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.09)" }}>
              <Compass size={16} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />
              <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Nothing booked — browse What's On →</span>
            </button>
          )}
        </div>

        {/* Your groups */}
        <div className="px-5 pb-5">
          <SectionLabel count={groups.length}>Your groups</SectionLabel>
          {groups.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {groups.map(g => (
                <button key={g.id} onClick={() => navigate(`/groups/${g.id}`)}
                        className="text-left rounded-2xl p-3 transition-all active:scale-[0.98]"
                        style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                        data-testid={`home-group-${g.id}`}>
                  <div className="font-serif font-bold text-[14px] leading-tight truncate mb-1" style={{ color: "var(--roam-cream)" }}>{g.name}</div>
                  <div className="font-mono text-[10px] flex items-center gap-1" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                    {GROUP_TYPE_LABEL[g.type] ?? g.type} · <Users size={9} /> {g.memberCount ?? 0}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>You're not in any groups yet.</p>
          )}
          <button onClick={() => navigate("/groups")}
                  className="mt-3 font-mono text-[11px] flex items-center gap-1.5" style={{ color: "var(--roam-electric)" }}
                  data-testid="home-browse-groups">
            <Plus size={12} /> Start or browse groups →
          </button>
        </div>

        {/* Invite your crew — referral loop */}
        <div className="px-5 pb-5">
          <button onClick={() => setShareOpen(true)}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.99]"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                  data-testid="home-invite-crew">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
              <UserPlus size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium" style={{ color: "var(--roam-cream)" }}>Invite your crew</div>
              <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                Friends who join connect with you instantly.
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--roam-electric)" }} />
          </button>
        </div>

        {/* Your adventure (status snapshot → tap to Profile) */}
        <div className="px-5 pb-5">
          <SectionLabel>Your adventure</SectionLabel>
          <button onClick={() => navigate("/profile")}
                  className="w-full flex items-center gap-2.5 flex-wrap rounded-2xl px-4 py-3.5"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.09)" }}
                  data-testid="home-stats">
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
              {vibeWord}
            </span>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.6)" }}>
              {tierLabel}
            </span>
            {verified ? (
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)" }}>
                <ShieldCheck size={11} /> ID verified
              </span>
            ) : null}
            {founding && (
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)" }}>
                <Star size={11} /> Founding
              </span>
            )}
            <ChevronRight size={15} className="ml-auto" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
          </button>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading="Invite your crew"
        payload={{
          title: "Join me on roam.",
          text: "Come adventure with me on roam — match on real adventures, not bios.",
          url: `${window.location.origin}/join?ref=${user?.id ?? ""}`,
        }}
      />
    </div>
  );
}
