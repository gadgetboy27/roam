import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";

// "What's on" teaser for the public landing page (D). Pulls real promoted/public
// events from /api/events/public (unauthenticated) to show the app is alive and
// happening — FOMO that converts to signup. Falls back to a tasteful "be first"
// state during cold-start when there are no public events yet, so the section
// never renders empty/broken.

type PublicEvent = {
  id: string;
  headline?: string;
  tagline?: string;
  imageUrl?: string;
  eventLocation?: string;
  eventStartAt?: string;
  ctaUrl?: string;
};

function when(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  } catch { return ""; }
}

export default function LandingEvents() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/events/public")
      .then(r => (r.ok ? r.json() : []))
      .then((rows) => setEvents(Array.isArray(rows) ? rows.slice(0, 6) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <section id="whats-on" className="py-16 px-5 scroll-mt-20" style={{ background: "rgba(var(--roam-moss-rgb),0.5)" }} data-testid="landing-events">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="font-mono text-[10px] tracking-[3px] uppercase mb-3" style={{ color: "var(--roam-electric)" }}>
            What&apos;s on
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-black">
            Happening across <span className="italic" style={{ color: "var(--roam-electric)" }}>Aotearoa</span>
          </h2>
        </div>

        {events.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((e) => (
              <div key={e.id} className="rounded-2xl overflow-hidden flex flex-col"
                   style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}
                   data-testid={`landing-event-${e.id}`}>
                {e.imageUrl && (
                  <div className="h-40 overflow-hidden">
                    <img src={e.imageUrl} alt={e.headline || "Event"} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm mb-1.5">{e.headline || "Adventure event"}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] mb-3" style={{ color: "var(--roam-electric)" }}>
                    {e.eventStartAt && <span className="inline-flex items-center gap-1"><CalendarDays size={10} /> {when(e.eventStartAt)}</span>}
                    {e.eventLocation && <span className="inline-flex items-center gap-1"><MapPin size={10} /> {e.eventLocation}</span>}
                  </div>
                  {e.tagline && <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{e.tagline}</p>}
                  <Link href="/signup" className="mt-auto">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase cursor-pointer" style={{ color: "var(--roam-electric)" }}>
                      Join to RSVP <ArrowRight size={12} />
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Cold-start: no public events yet — keep it aspirational, not empty.
          <div className="max-w-xl mx-auto text-center p-8 rounded-3xl"
               style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
            <div className="text-[40px] mb-3">🏕️</div>
            <h3 className="font-serif text-xl font-black mb-2">The first adventures are forming</h3>
            <p className="text-sm mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
              Hikes, surf trips, night-market crawls — roamers are gathering across Aotearoa. Be one of the first to host or join.
            </p>
            <Link href="/signup">
              <button className="px-7 py-3 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                      data-testid="landing-events-cta">
                Start an adventure <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
