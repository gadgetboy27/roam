import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { setNextRoute } from "@/lib/nextRoute";
import { Calendar, MapPin, Users, ArrowRight, Check, Share2 } from "lucide-react";
import ShareSheet from "@/components/share-sheet";

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad", crew: "Crew", community: "Community", organiser: "Organiser",
};

function smartDate(d?: string | Date): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) +
    " · " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EventLanding() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const { data: ev, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/events/${eventId}/landing`],
    retry: false,
  });

  const signUpToRsvp = () => {
    setNextRoute(`/e/${eventId}`);
    navigate("/signup");
  };

  const joinAndRsvp = async () => {
    setJoining(true);
    setError("");
    try {
      const res = await apiRequest("POST", `/api/events/${eventId}/join-rsvp`);
      const data = await res.json();
      if (data?.requiresTicket) {
        // Ticketed event — send them to the group event view to pay.
        navigate(`/groups/${data.groupId}?tab=events`);
        return;
      }
      setJoinedGroupId(data?.groupId ?? ev?.group?.id ?? null);
      setJoined(true);
    } catch (e: any) {
      setError(e?.message?.replace(/^\d+:\s*/, "") || "Couldn't RSVP — try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      {/* Brand header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer">
            <span className="font-serif text-[22px] font-black" style={{ color: "var(--roam-cream)" }}>roam</span>
            <span className="font-serif text-[22px] font-black" style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {ev && (
            <button onClick={() => setShareOpen(true)} className="flex items-center gap-1.5 font-mono text-[11px]"
                    style={{ color: "var(--roam-electric)" }} data-testid="event-share">
              <Share2 size={13} /> Share
            </button>
          )}
          {!user && (
            <Link href="/login">
              <span className="font-mono text-[11px] cursor-pointer" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>Log in</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 pb-10 max-w-lg mx-auto w-full">
        {isLoading || authLoading ? (
          <div className="h-64 rounded-3xl animate-pulse" style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />
        ) : isError || !ev ? (
          <div className="text-center py-20">
            <Calendar size={36} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.15)" }} />
            <p className="font-serif text-[18px] font-bold mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Event not found</p>
            <p className="font-mono text-[11px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>This event may have ended or been removed.</p>
            <Link href="/"><span className="font-mono text-[12px]" style={{ color: "var(--roam-electric)" }}>Explore roam →</span></Link>
          </div>
        ) : (
          <>
            {/* Cover */}
            <div className="rounded-3xl overflow-hidden mb-5" style={{ border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
              {ev.group?.coverImageUrl ? (
                <div className="w-full h-44 overflow-hidden"><img src={ev.group.coverImageUrl} alt={ev.title} className="w-full h-full object-cover" /></div>
              ) : (
                <div className="w-full h-32 flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg,rgba(var(--roam-electric-rgb),0.15),rgba(var(--roam-cream-rgb),0.04))" }}>
                  <span style={{ color: "rgba(var(--roam-cream-rgb),0.25)", fontSize: "40px" }}>r.</span>
                </div>
              )}
              <div className="p-5" style={{ background: "var(--roam-surface)" }}>
                <div className="font-mono text-[10px] tracking-wider uppercase mb-2" style={{ color: "var(--roam-electric)" }}>
                  {GROUP_TYPE_LABEL[ev.group?.type] ?? "Event"} · {ev.group?.name}
                </div>
                <h1 className="font-serif text-[24px] font-black leading-tight mb-3" style={{ color: "var(--roam-cream)" }}>{ev.title}</h1>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                    <Calendar size={13} style={{ color: "var(--roam-electric)" }} /> {smartDate(ev.startAt)}
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                      <MapPin size={13} style={{ color: "var(--roam-electric)" }} /> {ev.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                    <Users size={13} style={{ color: "var(--roam-electric)" }} />
                    {ev.attendeeCount > 0 ? `${ev.attendeeCount} going` : "Be the first to RSVP"}
                    {ev.host?.name ? ` · hosted by ${ev.host.name}` : ""}
                  </div>
                  {ev.ticketPriceNzd ? (
                    <div className="font-mono text-[12px] pt-1" style={{ color: "var(--roam-electric)" }}>
                      🎟 ${(ev.ticketPriceNzd / 100).toFixed(2)} NZD entry
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {ev.description && (
              <p className="text-[13px] leading-relaxed mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{ev.description}</p>
            )}

            {/* CTA */}
            {joined ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.15)", border: "1.5px solid var(--roam-electric)" }}>
                  <Check size={20} style={{ color: "var(--roam-electric)" }} />
                </div>
                <p className="font-serif text-[16px] font-black mb-1" style={{ color: "var(--roam-cream)" }}>You're going! 🎉</p>
                <p className="font-mono text-[11px] mb-4" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>Say hi in the campsite and meet the crew before the day.</p>
                <button onClick={() => navigate(joinedGroupId ? `/groups/${joinedGroupId}?tab=campsite` : "/home")}
                        className="w-full py-3 rounded-2xl font-mono text-[12px] font-semibold"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                        data-testid="event-open-campsite">
                  Open the campsite →
                </button>
              </div>
            ) : user ? (
              <button onClick={joinAndRsvp} disabled={joining}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-mono text-[13px] font-semibold transition-all"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", opacity: joining ? 0.7 : 1 }}
                      data-testid="event-rsvp">
                {joining ? "Saving…" : ev.ticketPriceNzd ? <>Get a ticket <ArrowRight size={15} /></> : <>I'm going <ArrowRight size={15} /></>}
              </button>
            ) : (
              <div>
                <button onClick={signUpToRsvp}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-mono text-[13px] font-semibold transition-all"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                        data-testid="event-signup-rsvp">
                  Sign up & RSVP <ArrowRight size={15} />
                </button>
                <p className="text-center font-mono text-[11px] mt-3 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                  <span style={{ color: "var(--roam-cream)" }}>roam.</span> connects you with people through real adventures.
                  Join free to RSVP and meet the crew.
                </p>
              </div>
            )}
            {error && <p className="text-center font-mono text-[11px] mt-3" style={{ color: "var(--roam-ember)" }}>{error}</p>}
          </>
        )}
      </div>

      {ev && (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          heading="Share this event"
          payload={{
            title: ev.title,
            text: `Join me at ${ev.title} on roam.`,
            url: `${window.location.origin}/e/${ev.id}`,
          }}
        />
      )}
    </div>
  );
}
