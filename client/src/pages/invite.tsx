import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Mountain, Users, CheckCircle, XCircle, Loader2, ArrowRight, Lock, Camera, Tag, MessageSquare } from "lucide-react";
import { Link } from "wouter";

const TYPE_LABELS: Record<string, string> = {
  squad: "Squad (2–5 people)",
  crew: "Crew (up to 20)",
  community: "Community (20+)",
  organiser: "Organiser group",
};

const VERIFICATION_ITEMS = [
  { key: "photo", label: "Upload an adventure photo", icon: Camera, href: "/upload" },
  { key: "tagline", label: "Add a profile tagline", icon: MessageSquare, href: "/profile" },
  { key: "tags", label: "Add at least 3 adventure tags", icon: Tag, href: "/profile" },
];

export default function InvitePage() {
  const { token } = useParams();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/invites/${token}`],
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invites/${token}/accept`),
    onSuccess: (data: any) => {
      setAccepted(true);
      setTimeout(() => navigate(`/groups/${data.groupId}`), 2000);
    },
    onError: (e: any) => {
      setError(e.message || "Something went wrong");
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--roam-forest)" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--roam-electric)" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--roam-forest)" }}>
        <div className="text-center max-w-xs">
          <XCircle size={32} className="mx-auto mb-4" style={{ color: "rgba(var(--roam-ember-rgb),0.7)" }} />
          <h2 className="font-serif text-xl mb-2" style={{ color: "var(--roam-cream)" }}>Invite not found</h2>
          <p className="font-mono text-[11px] mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
            This invite link may have expired or already been used.
          </p>
          <Link href="/groups">
            <span className="font-mono text-[11px]" style={{ color: "var(--roam-electric)" }}>Browse groups →</span>
          </Link>
        </div>
      </div>
    );
  }

  const { invite, group, inviterName } = data;

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--roam-forest)" }}>
        <div className="text-center max-w-xs">
          <CheckCircle size={36} className="mx-auto mb-4" style={{ color: "var(--roam-electric)" }} />
          <h2 className="font-serif text-xl mb-2" style={{ color: "var(--roam-cream)" }}>Invite accepted!</h2>
          <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
            Your request has been sent to the group leader. Taking you there now…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-forest)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="font-serif text-2xl mb-0.5" style={{ color: "var(--roam-cream)" }}>roam.</div>
            <div className="font-mono text-[9px] tracking-[3px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>adventure matching</div>
          </div>

          <div className="rounded-3xl overflow-hidden mb-5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
            {group?.coverImageUrl && (
              <img src={group.coverImageUrl} alt={group.name}
                   className="w-full h-32 object-cover" />
            )}
            {!group?.coverImageUrl && (
              <div className="w-full h-24 flex items-center justify-center"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.08)" }}>
                <Mountain size={28} style={{ color: "rgba(var(--roam-electric-rgb),0.4)" }} />
              </div>
            )}
            <div className="p-5">
              <div className="font-mono text-[9px] tracking-[2px] uppercase mb-1"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>You're invited to join</div>
              <h1 className="font-serif text-xl font-bold mb-1" style={{ color: "var(--roam-cream)" }}>
                {group?.name ?? "a group"}
              </h1>
              <div className="font-mono text-[10px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                {TYPE_LABELS[group?.type] ?? group?.type} · invited by {inviterName}
              </div>
              {group?.description && (
                <p className="font-mono text-[11px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                  {group.description}
                </p>
              )}
              {invite.message && (
                <blockquote className="mt-3 pl-3 font-mono text-[11px] italic leading-relaxed"
                            style={{ borderLeft: "2px solid rgba(var(--roam-electric-rgb),0.3)", color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  "{invite.message}"
                </blockquote>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            <div className="font-mono text-[9px] tracking-[2px] uppercase mb-3"
                 style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Before you're fully approved, you'll need to:</div>
            <div className="space-y-2.5">
              {VERIFICATION_ITEMS.map(item => (
                <div key={item.key} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
                    <item.icon size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }} />
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] mt-3 leading-relaxed"
               style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              This keeps roam. safe — the group leader reviews your profile before approving you.
            </p>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 font-mono text-[11px]"
                 style={{ background: "rgba(var(--roam-ember-rgb),0.08)", color: "var(--roam-ember)", border: "1px solid rgba(var(--roam-ember-rgb),0.2)" }}>
              {error}
            </div>
          )}

          {!user ? (
            <div className="space-y-3">
              <Link href={`/signup?invite=${token}`}>
                <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-mono text-[12px] tracking-wider font-semibold"
                        style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                        data-testid="button-signup-to-accept">
                  Create account & accept <ArrowRight size={14} />
                </button>
              </Link>
              <Link href={`/login?invite=${token}`}>
                <button className="w-full py-3.5 rounded-2xl font-mono text-[11px] tracking-wider"
                        style={{ background: "rgba(var(--roam-cream-rgb),0.05)", color: "rgba(var(--roam-cream-rgb),0.6)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                        data-testid="button-login-to-accept">
                  Already have an account? Sign in
                </button>
              </Link>
            </div>
          ) : (
            <button onClick={() => acceptMutation.mutate()}
                    disabled={acceptMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-mono text-[12px] tracking-wider font-semibold"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                    data-testid="button-accept-invite">
              {acceptMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Accept & Request to Join <ArrowRight size={14} /></>
              )}
            </button>
          )}

          <p className="text-center font-mono text-[9px] mt-4"
             style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
            Invite expires in 7 days · roam. keeps all members verified for your safety
          </p>
        </div>
      </div>
    </div>
  );
}
