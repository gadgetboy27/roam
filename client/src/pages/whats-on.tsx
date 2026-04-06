import { useState } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, ChevronRight, Check } from "lucide-react";

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad",
  crew: "Crew",
  community: "Community",
};

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
          <div key={f.userId} className="w-5 h-5 rounded-full overflow-hidden border"
               style={{ borderColor: "var(--roam-surface)" }}>
            {f.avatarUrl
              ? <img src={f.avatarUrl} alt={f.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                  {f.name[0]}
                </div>
            }
          </div>
        ))}
      </div>
      <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
        {count} going
      </span>
    </div>
  );
}

function EventCard({ event, onRsvp }: { event: any; onRsvp: (ev: any) => void }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const rsvpMutation = useMutation({
    mutationFn: () => event.isRsvpd
      ? apiRequest("DELETE", `/api/events/${event.id}/rsvp`)
      : apiRequest("POST", `/api/events/${event.id}/rsvp`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
      toast({ description: event.isRsvpd ? "RSVP removed." : "You're going! 🎉" });
    },
  });

  const handleCta = () => {
    if (!user) { navigate("/signup"); return; }
    if (!event.isMember) { navigate(`/groups/${event.group.id}`); return; }
    rsvpMutation.mutate();
  };

  const ctaLabel = !user
    ? "Sign up →"
    : !event.isMember
      ? "Join group →"
      : event.isRsvpd
        ? "Going ✓"
        : "RSVP";

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
            <div className="font-semibold text-[15px] leading-snug mb-1" style={{ color: "var(--roam-cream)" }}>
              {event.title}
            </div>
            <button onClick={() => navigate(`/groups/${event.group.id}`)}
                    className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
              <span className="font-mono text-[10px] tracking-wider"
                    style={{ color: "var(--roam-electric)" }}>
                {event.group.name}
              </span>
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
          <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
            {event.description}
          </p>
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
          <button
            onClick={handleCta}
            disabled={rsvpMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-[11px] tracking-wider font-medium transition-all flex-shrink-0"
            style={ctaStyle}
            data-testid={`button-rsvp-${event.id}`}>
            {event.isRsvpd && <Check size={11} />}
            {rsvpMutation.isPending ? "…" : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type Filter = "today" | "week" | "upcoming";

export default function WhatsOn() {
  const [filter, setFilter] = useState<Filter>("today");
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/events/upcoming"],
  });

  const todayEvents = events.filter(e => isToday(e.startAt));
  const weekEvents = events.filter(e => isThisWeek(e.startAt));
  const upcomingEvents = events.filter(e => {
    const date = new Date(e.startAt);
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
            Live events from adventure groups near you
          </p>
        </div>

        <div className="flex gap-2 mb-5 sticky top-[60px] z-10 py-2"
             style={{ background: "rgba(var(--roam-forest-rgb),0.92)", backdropFilter: "blur(16px)", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
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
              <div key={i} className="h-36 rounded-2xl animate-pulse"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={36} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }} />
            <p className="font-serif text-[18px] font-bold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Nothing on {filter === "today" ? "today" : filter === "week" ? "this week" : "yet"}
            </p>
            <p className="text-[12px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
              {filter === "today" ? "Check back later or see what's coming up this week." : "Events will appear here once group leaders post them."}
            </p>
            <button onClick={() => navigate("/groups")}
                    className="px-5 py-2.5 rounded-xl font-mono text-[11px] tracking-wider"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                    data-testid="button-browse-groups">
              Browse groups →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(event => (
              <EventCard key={event.id} event={event} onRsvp={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
