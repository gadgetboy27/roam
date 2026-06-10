import { useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { setReferrer } from "@/lib/nextRoute";
import { ArrowRight, Users, Compass, MessageCircle } from "lucide-react";

// Public "invite your crew" landing: /join?ref=<inviterId>. Frames the app as a
// friend invite and stashes the referrer so onboarding can auto-connect them.
export default function Join() {
  const search = useSearch();
  const ref = new URLSearchParams(search).get("ref");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => { if (ref) setReferrer(ref); }, [ref]);

  const { data: inviter } = useQuery<{ name: string }>({
    queryKey: [`/api/referrals/${ref}`],
    enabled: !!ref,
    retry: false,
  });

  // Already signed in → just go connect / explore.
  useEffect(() => { if (user) navigate("/home"); }, [user, navigate]);

  const start = () => { if (ref) setReferrer(ref); navigate("/signup"); };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      <div className="px-5 pt-6">
        <span className="font-serif text-[22px] font-black" style={{ color: "var(--roam-cream)" }}>roam</span>
        <span className="font-serif text-[22px] font-black" style={{ color: "var(--roam-electric)" }}>.</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 max-w-lg mx-auto w-full">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
             style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
          <Users size={26} style={{ color: "var(--roam-electric)" }} />
        </div>

        <h1 className="font-serif text-[30px] font-black leading-tight mb-3" style={{ color: "var(--roam-cream)" }}>
          {inviter?.name ? `${inviter.name} invited you to roam.` : "You're invited to roam."}
        </h1>
        <p className="text-[14px] leading-relaxed mb-7" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
          roam connects you with people through real adventures — hikes, climbs, surf trips and more.
          Sign up and {inviter?.name ? `you'll connect with ${inviter.name} straight away` : "find your crew"}.
        </p>

        <div className="space-y-3 mb-8">
          {[
            { icon: Compass, label: "Match on shared adventures, not bios" },
            { icon: MessageCircle, label: "Message your crew and plan the next trip" },
            { icon: Users, label: "Join group adventures near you" },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <f.icon size={15} style={{ color: "var(--roam-electric)" }} />
              <span className="font-mono text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{f.label}</span>
            </div>
          ))}
        </div>

        <button onClick={start}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-mono text-[13px] font-semibold"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                data-testid="join-signup">
          {inviter?.name ? `Join & connect with ${inviter.name}` : "Join roam free"} <ArrowRight size={15} />
        </button>
        <p className="text-center font-mono text-[11px] mt-4" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
          Already on roam? <Link href="/login"><span className="cursor-pointer" style={{ color: "var(--roam-electric)" }}>Log in</span></Link>
        </p>
      </div>
    </div>
  );
}
