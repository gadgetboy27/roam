import { useState } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, ChevronRight, Check, ExternalLink, Sparkles, Plus } from "lucide-react";

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad", crew: "Crew", community: "Community", organiser: "Organiser",
};

// A 1:1 crew-up squad (private connection chat) — kept out of the browseable
// communities list, which is for real multi-person groups to join.
function isPairSquad(g: any): boolean {
  return g.type === "squad" && (g.memberCount ?? 0) <= 2 && / & /.test(g.name ?? "");
}

// Communities tab: browse/join real groups. Lives here (under What's On) instead
// of a standalone Groups nav tab — group creation deep-links to /groups.
function CommunitiesView() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups"],
    refetchInterval: 20_000,
  });
  const { data: eligibility } = useQuery<{ eligible?: boolean }>({
    queryKey: ["/api/groups/eligibility/check"],
    enabled: !!user,
  });
  const browseable = groups.filter(g => !isPairSquad(g));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Adventure crews & communities to join</p>
        {user && eligibility?.eligible && (
          <button onClick={() => navigate("/groups")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[11px] font-semibold"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }} data-testid="communities-new">
            <Plus size={13} /> New
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />)}</div>
      ) : browseable.length === 0 ? (
        <div className="text-center py-16">
          <Users size={36} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }} />
          <p className="font-serif text-[18px] font-bold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>No communities yet</p>
          <p className="text-[12px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>Be the first to gather your adventure crew.</p>
          <button onClick={() => navigate("/groups")} className="px-5 py-2.5 rounded-xl font-mono text-[11px] tracking-wider"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
            Start a group →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {browseable.map(g => (
            <button key={g.id} onClick={() => navigate(`/groups/${g.id}`)}
                    className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                    style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                    data-testid={`community-${g.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif font-bold text-[15px] truncate" style={{ color: "var(--roam-cream)" }}>{g.name}</div>
                  <div className="flex items-center gap-2 mt-1 font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                    <span>{GROUP_TYPE_LABEL[g.type] ?? g.type}</span>
                    {g.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {g.location}</span>}
                  </div>
                </div>
                <span className="flex items-center gap-1 flex-shrink-0 font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                  <Users size={12} /> {g.memberCount ?? 0}
                </span>
              </div>
              {g.description && <p className="text-[12px] mt-2 line-clamp-2" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{g.description}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function smartDate(d: string | Date): string {
  const date = new Date(d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
  const time = date.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  if (date >= todayStart && date < todayEnd) {
    const diffMs = date.getTime() - now.getTime();
    const diffH = Math.round(diffMs / 3600000);
    if (diffMs > 0 && diffH < 3) return diffH <= 0 ? "Starting soon" : `in ${diffH}h · ${time}`;
    return `Today · ${time}`;
  }
  if (date >= todayEnd && date < tomorrowEnd) return `Tomorrow · ${time}`;
  return date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" }) + ` · ${time}`;
}

function isToday(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isThisWeek(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  return date > now && date <= weekFromNow && !isToday(d);
}

function AttendeeFaces({ faces, count }: { faces: { userId: string; name: string; avatarUrl: string | null }[]; count: number }) {
  if (count === 0) return <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Be the first to RSVP</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {faces.map(f => (
          <div key={f.userId} className="w-5 h-5 rounded-full overflow-hidden border" style={{ borderColor: "var(--roam-surface)" }}>
            {f.avatarUrl
              ? <img src={f.avatarUrl} alt={f.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>{f.name[0]}</div>
            }
          </div>
        ))}
      </div>
      <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{count} going</span>
    </div>
  );
}

function GroupEventCard({ event, onRsvp }: { event: any; onRsvp: (ev: any) => void }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const rsvpMutation = useMutation({
    mutationFn: () => event.isRsvpd
      ? apiRequest("DELETE", `/api/events/${event.id}/rsvp`)
      : apiRequest("POST", `/api/events/${event.id}/rsvp`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
    },
  });

  const handleCta = () => {
    if (!user) { navigate("/signup"); return; }
    if (!event.isMember) { navigate(`/groups/${event.group.id}`); return; }
    rsvpMutation.mutate();
  };

  const ctaLabel = !user ? "Sign up →" : !event.isMember ? "Join group →" : event.isRsvpd ? "Going ✓" : "RSVP";
  const ctaStyle: React.CSSProperties = event.isRsvpd
    ? { background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.35)" }
    : !event.isMember || !user
      ? { background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.6)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }
      : { background: "var(--roam-electric)", color: "var(--roam-forest)" };

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
         data-testid={`event-card-${event.id}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] leading-snug mb-1" style={{ color: "var(--roam-cream)" }}>{event.title}</div>
            <button onClick={() => navigate(`/groups/${event.group.id}`)}
                    className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
              <span className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>{event.group.name}</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-lg"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "rgba(var(--roam-electric-rgb),0.7)" }}>
                {GROUP_TYPE_LABEL[event.group.type] ?? event.group.type}
              </span>
              <ChevronRight size={10} style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }} />
            </button>
          </div>
          <div className="font-mono text-[10px] tracking-wide flex-shrink-0 text-right"
               style={{ color: isToday(event.startAt) ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)" }}>
            {smartDate(event.startAt)}
          </div>
        </div>
        {event.location && (
          <div className="flex items-center gap-1 mb-3">
            <MapPin size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.35)", flexShrink: 0 }} />
            <span className="text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{event.location}</span>
          </div>
        )}
        {event.description && (
          <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>{event.description}</p>
        )}
        {event.group.adventureTags && event.group.adventureTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.group.adventureTags.slice(0, 4).map((tag: string) => (
              <span key={tag} className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.4)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <AttendeeFaces faces={event.attendeeFaces ?? []} count={event.rsvpCount ?? 0} />
          <button onClick={handleCta} disabled={rsvpMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-[11px] tracking-wider font-medium transition-all flex-shrink-0"
                  style={ctaStyle} data-testid={`button-rsvp-${event.id}`}>
            {event.isRsvpd && <Check size={11} />}
            {rsvpMutation.isPending ? "…" : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromotedEventCard({ event }: { event: any }) {
  const dateStr = event.eventStartAt ? smartDate(event.eventStartAt) : null;
  const isLive = event.eventStartAt ? isToday(event.eventStartAt) : false;

  return (
    <div className="rounded-2xl overflow-hidden relative"
         style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)" }}
         data-testid={`promoted-event-card-${event.id}`}>
      {event.imageUrl && (
        <div className="w-full h-36 overflow-hidden relative">
          <img src={event.imageUrl} alt={event.headline} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6))" }} />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
               style={{ background: "rgba(var(--roam-sky-rgb),0.85)", backdropFilter: "blur(8px)" }}>
            <Sparkles size={9} style={{ color: "rgba(0,0,0,0.8)" }} />
            <span className="font-mono text-[9px] font-semibold tracking-wider" style={{ color: "rgba(0,0,0,0.8)" }}>Promoted</span>
          </div>
        </div>
      )}
      <div className="p-4">
        {!event.imageUrl && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                 style={{ background: "rgba(var(--roam-sky-rgb),0.12)", border: "1px solid rgba(var(--roam-sky-rgb),0.25)" }}>
              <Sparkles size={9} style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }} />
              <span className="font-mono text-[9px] font-semibold tracking-wider" style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }}>Promoted event</span>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] leading-snug" style={{ color: "var(--roam-cream)" }}>{event.headline}</div>
            {(event.advertiserCompany || event.advertiserName) && (
              <div className="font-mono text-[10px] tracking-wider mt-0.5"
                   style={{ color: "rgba(var(--roam-sky-rgb),0.75)" }}>
                {event.advertiserCompany || event.advertiserName}
              </div>
            )}
          </div>
          {dateStr && (
            <div className="font-mono text-[10px] tracking-wide flex-shrink-0 text-right"
                 style={{ color: isLive ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)" }}>
              {dateStr}
            </div>
          )}
        </div>
        {event.eventLocation && (
          <div className="flex items-center gap-1 mb-2">
            <MapPin size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.35)", flexShrink: 0 }} />
            <span className="text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{event.eventLocation}</span>
          </div>
        )}
        {event.tagline && (
          <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>{event.tagline}</p>
        )}
        {event.ctaUrl && (
          <a href={event.ctaUrl} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[11px] font-semibold tracking-wider transition-all"
             style={{ background: "rgba(var(--roam-sky-rgb),0.15)", color: "rgba(var(--roam-sky-rgb),0.95)", border: "1px solid rgba(var(--roam-sky-rgb),0.3)" }}
             data-testid={`button-promoted-cta-${event.id}`}>
            <ExternalLink size={12} />
            {event.ctaText || "Learn more"}
          </a>
        )}
      </div>
    </div>
  );
}

type Filter = "today" | "week" | "upcoming";

function getDateForEvent(e: any): Date {
  return new Date(e.eventStartAt ?? e.startAt ?? e.createdAt ?? 0);
}

export default function WhatsOn() {
  const [filter, setFilter] = useState<Filter>("today");
  const [view, setView] = useState<"events" | "communities">("events");
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: groupEvents = [], isLoading: loadingGroup } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
  });

  const { data: promotedEvents = [], isLoading: loadingPromoted } = useQuery<any[]>({
    queryKey: ["/api/events/public"],
  });

  const isLoading = loadingGroup || loadingPromoted;

  const allEvents = [
    ...groupEvents.map(e => ({ ...e, _kind: "group" as const })),
    ...promotedEvents.map(e => ({ ...e, _kind: "promoted" as const })),
  ].sort((a, b) => getDateForEvent(a).getTime() - getDateForEvent(b).getTime());

  const eventDate = (e: any) => new Date(e.eventStartAt ?? e.startAt ?? 0);

  const todayEvents = allEvents.filter(e => isToday(eventDate(e)));
  const weekEvents = allEvents.filter(e => isThisWeek(eventDate(e)));
  const upcomingEvents = allEvents.filter(e => {
    const date = eventDate(e);
    const weekFromNow = new Date(Date.now() + 7 * 86400000);
    return date > weekFromNow;
  });

  const filtered = filter === "today" ? todayEvents : filter === "week" ? weekEvents : upcomingEvents;

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "today", label: "Today", count: todayEvents.length },
    { id: "week", label: "This Week", count: weekEvents.length },
    { id: "upcoming", label: "Upcoming", count: upcomingEvents.length },
  ];

  return (
    <div className="min-h-screen" data-testid="page-whats-on">
      <AppNav />
      <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
        <div className="mb-5">
          <h1 className="font-serif text-[26px] font-black leading-tight">
            What's <span className="italic" style={{ color: "var(--roam-electric)" }}>on</span>
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
            Group events and public listings near you
          </p>
        </div>

        {/* Events | Communities */}
        <div className="flex gap-2 mb-4">
          {(["events", "communities"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
                    className="flex-1 py-2 rounded-xl font-mono text-[12px] tracking-wider transition-all"
                    style={{
                      background: view === v ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)",
                      color: view === v ? "var(--roam-forest)" : "rgba(var(--roam-cream-rgb),0.5)",
                      border: view === v ? "none" : "1px solid rgba(var(--roam-cream-rgb),0.1)",
                      fontWeight: view === v ? 600 : 400,
                    }}
                    data-testid={`view-${v}`}>
              {v === "events" ? "Events" : "Communities"}
            </button>
          ))}
        </div>

        {view === "communities" ? <CommunitiesView /> : (
        <>
        <div className="flex gap-2 mb-5 sticky top-[60px] z-10 py-2"
             style={{ background: "rgba(var(--roam-forest-rgb),0.92)", backdropFilter: "blur(16px)", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-[11px] tracking-wider transition-all"
                    style={{
                      background: filter === f.id ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)",
                      color: filter === f.id ? "var(--roam-forest)" : "rgba(var(--roam-cream-rgb),0.5)",
                      border: filter === f.id ? "none" : "1px solid rgba(var(--roam-cream-rgb),0.1)",
                      fontWeight: filter === f.id ? 600 : 400,
                    }}
                    data-testid={`filter-${f.id}`}>
              {f.label}
              {f.count > 0 && (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded-md"
                      style={{ background: filter === f.id ? "rgba(0,0,0,0.18)" : "rgba(var(--roam-electric-rgb),0.12)", color: filter === f.id ? "rgba(0,0,0,0.7)" : "var(--roam-electric)" }}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={36} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }} />
            <p className="font-serif text-[18px] font-bold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Nothing on {filter === "today" ? "today" : filter === "week" ? "this week" : "yet"}
            </p>
            <p className="text-[12px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
              {filter === "today" ? "Check back later or see what's coming up this week." : "Events will appear here as groups and organisers post them."}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => navigate("/groups")}
                      className="px-5 py-2.5 rounded-xl font-mono text-[11px] tracking-wider"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                      data-testid="button-browse-groups">
                Browse groups →
              </button>
              <button onClick={() => navigate("/advertise?mode=event")}
                      className="px-5 py-2.5 rounded-xl font-mono text-[11px] tracking-wider"
                      style={{ background: "rgba(var(--roam-sky-rgb),0.08)", color: "rgba(var(--roam-sky-rgb),0.8)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)" }}
                      data-testid="button-list-event">
                List an event →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(event =>
              event._kind === "promoted"
                ? <PromotedEventCard key={`promo-${event.id}`} event={event} />
                : <GroupEventCard key={`group-${event.id}`} event={event} onRsvp={() => {}} />
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
