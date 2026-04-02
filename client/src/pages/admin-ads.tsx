import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Eye, Loader2, RefreshCw } from "lucide-react";
import type { Ad } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "rgba(var(--roam-cream-rgb),0.35)",
  pending_review:  "rgba(var(--roam-sky-rgb),0.9)",
  approved:        "rgba(var(--roam-electric-rgb),0.9)",
  rejected:        "rgba(var(--roam-ember-rgb),0.9)",
  expired:         "rgba(var(--roam-cream-rgb),0.3)",
};
const STATUS_BG: Record<string, string> = {
  pending_payment: "rgba(var(--roam-cream-rgb),0.05)",
  pending_review:  "rgba(var(--roam-sky-rgb),0.08)",
  approved:        "rgba(var(--roam-electric-rgb),0.07)",
  rejected:        "rgba(var(--roam-ember-rgb),0.07)",
  expired:         "rgba(var(--roam-cream-rgb),0.04)",
};
const TIER_LABELS: Record<string, string> = { explorer: "Explorer · $49", trailblazer: "Trailblazer · $129", summit: "Summit · $299" };

function AdRow({ ad, onApprove, onReject }: { ad: Ad; onApprove: (id: string) => void; onReject: (id: string, reason: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
         data-testid={`ad-row-${ad.id}`}>
      <div className="px-5 py-4 flex items-start gap-4"
           style={{ background: "rgba(var(--roam-cream-rgb),0.03)" }}>
        {ad.imageUrl && (
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
            <img src={ad.imageUrl} alt={ad.headline} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                  style={{ background: STATUS_BG[ad.status] || "rgba(var(--roam-cream-rgb),0.05)", color: STATUS_COLORS[ad.status] || "rgba(var(--roam-cream-rgb),0.5)" }}>
              {ad.status.replace("_", " ")}
            </span>
            <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              {TIER_LABELS[ad.tier] || ad.tier}
            </span>
          </div>
          <div className="font-serif text-[15px] font-bold leading-tight truncate"
               style={{ color: "rgba(var(--roam-cream-rgb),0.9)" }}>{ad.headline}</div>
          <div className="font-mono text-[10px] mt-0.5"
               style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
            {ad.advertiserName}{ad.advertiserCompany ? ` · ${ad.advertiserCompany}` : ""} · {ad.advertiserEmail}
          </div>
          {ad.rejectionReason && (
            <div className="font-mono text-[10px] mt-1" style={{ color: "rgba(var(--roam-ember-rgb),0.7)" }}>
              Rejected: {ad.rejectionReason}
            </div>
          )}
          {ad.expiresAt && ad.status === "approved" && (
            <div className="font-mono text-[10px] mt-1" style={{ color: "rgba(var(--roam-electric-rgb),0.6)" }}>
              Expires: {new Date(ad.expiresAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)}
                className="flex-shrink-0 p-2 rounded-xl transition-all"
                style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }}>
          <Eye size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }} />
        </button>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-3" style={{ background: "rgba(var(--roam-cream-rgb),0.02)", borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
          {ad.tagline && <div className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Tagline: {ad.tagline}</div>}
          {ad.ctaText && <div className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>CTA: "{ad.ctaText}" → {ad.ctaUrl}</div>}
          {ad.videoUrl && <div className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-sky-rgb),0.8)" }}>Video: {ad.videoUrl}</div>}
          <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
            Impressions: {ad.impressions ?? 0} · Created: {new Date(ad.createdAt!).toLocaleDateString()}
          </div>

          {ad.status === "pending_review" && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => onApprove(ad.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] tracking-wider font-semibold transition-all"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}
                      data-testid={`button-approve-${ad.id}`}>
                <CheckCircle2 size={12} /> Approve
              </button>
              <button onClick={() => setShowRejectForm(v => !v)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] tracking-wider font-semibold transition-all"
                      style={{ background: "rgba(var(--roam-ember-rgb),0.1)", color: "var(--roam-ember)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)" }}
                      data-testid={`button-reject-prompt-${ad.id}`}>
                <XCircle size={12} /> Reject
              </button>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-2">
              <input
                className="w-full px-4 py-2.5 rounded-xl font-mono text-[11px] outline-none"
                style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.8)" }}
                placeholder="Reason for rejection (sent to advertiser)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                data-testid={`input-reject-reason-${ad.id}`}
              />
              <button
                onClick={() => { onReject(ad.id, rejectReason); setShowRejectForm(false); }}
                className="font-mono text-[10px] tracking-wider px-4 py-2.5 rounded-xl"
                style={{ background: "var(--roam-ember)", color: "#fff" }}
                data-testid={`button-reject-confirm-${ad.id}`}>
                Confirm rejection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAds() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("pending_review");

  const { data: allAds = [], isLoading, refetch, isRefetching } = useQuery<Ad[]>({
    queryKey: ["/api/ads/admin"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/ads/admin/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ads/admin"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/ads/admin/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ads/admin"] }),
  });

  const filtered = filter === "all" ? allAds : allAds.filter(a => a.status === filter);
  const counts: Record<string, number> = allAds.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {} as any);

  const FILTERS = [
    { key: "pending_review", label: "Pending Review" },
    { key: "approved", label: "Live" },
    { key: "rejected", label: "Rejected" },
    { key: "pending_payment", label: "Awaiting Payment" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen relative" data-testid="page-admin-ads">
      <div className="topo-bg" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link href="/profile">
          <button className="flex items-center gap-2 mb-8 font-mono text-[11px] tracking-wider uppercase"
                  style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
            <ArrowLeft size={13} />
            Back to profile
          </button>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[26px] font-black">
              Ad <span style={{ color: "var(--roam-electric)" }}>Review Portal</span>
            </h1>
            <p className="font-mono text-[10px] tracking-wider"
               style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              roam. · internal team only
            </p>
          </div>
          <button onClick={() => refetch()}
                  className="p-2.5 rounded-xl transition-all"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }} />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { key: "pending_review", label: "Review", color: "rgba(var(--roam-sky-rgb),0.8)" },
            { key: "approved",       label: "Live",   color: "rgba(var(--roam-electric-rgb),0.8)" },
            { key: "rejected",       label: "Rejected", color: "rgba(var(--roam-ember-rgb),0.8)" },
            { key: "pending_payment",label: "Unpaid", color: "rgba(var(--roam-cream-rgb),0.4)" },
          ].map(s => (
            <div key={s.key} className="rounded-2xl px-3 py-3 text-center"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div className="font-mono text-[20px] font-black" style={{ color: s.color }}>{counts[s.key] || 0}</div>
              <div className="font-mono text-[8px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className="font-mono text-[9px] tracking-wider uppercase px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: filter === f.key ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.05)",
                      color: filter === f.key ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.4)",
                      border: `1px solid ${filter === f.key ? "rgba(var(--roam-electric-rgb),0.3)" : "rgba(var(--roam-cream-rgb),0.08)"}`,
                    }}>
              {f.label} {counts[f.key] ? `(${counts[f.key]})` : ""}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Clock size={24} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.2)" }} />
            <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>No ads in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ad => (
              <AdRow
                key={ad.id}
                ad={ad}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
