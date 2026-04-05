import { useState } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Lock, Globe, Plus, ChevronRight, Tent, Ship, Mountain } from "lucide-react";

const GROUP_TYPE_LABEL: Record<string, string> = {
  squad: "Squad",
  crew: "Crew",
  community: "Community",
};

const GROUP_TYPE_ICON: Record<string, React.ReactNode> = {
  squad: <Tent size={13} />,
  crew: <Ship size={13} />,
  community: <Mountain size={13} />,
};

const GROUP_TYPE_RANGE: Record<string, string> = {
  squad: "2–5",
  crew: "6–20",
  community: "20–100",
};

function GroupCard({ group, myGroupIds, onClick }: {
  group: any;
  myGroupIds: string[];
  onClick: () => void;
}) {
  const isMember = myGroupIds.includes(group.id);
  const tags: string[] = group.adventureTags ?? [];

  return (
    <button
      className="w-full text-left rounded-2xl overflow-hidden transition-all"
      style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.09)" }}
      onClick={onClick}
      data-testid={`group-card-${group.id}`}
    >
      {group.coverImageUrl && (
        <div className="w-full h-32 overflow-hidden">
          <img src={group.coverImageUrl} alt={group.name} className="w-full h-full object-cover" />
        </div>
      )}
      {!group.coverImageUrl && (
        <div className="w-full h-20 flex items-center justify-center"
             style={{ background: "linear-gradient(135deg,rgba(var(--roam-electric-rgb),0.12),rgba(var(--roam-cream-rgb),0.04))" }}>
          <span style={{ color: "rgba(var(--roam-cream-rgb),0.2)", fontSize: "32px" }}>r.</span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-base leading-tight truncate"
                    style={{ color: "var(--roam-cream)" }}>
                {group.name}
              </span>
              {isMember && (
                <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                  member
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-[11px] font-mono"
                    style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                {GROUP_TYPE_ICON[group.type]}
                {GROUP_TYPE_LABEL[group.type]} · {GROUP_TYPE_RANGE[group.type]}
              </span>
              {group.location && (
                <span className="flex items-center gap-0.5 text-[11px]"
                      style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  <MapPin size={10} /> {group.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {group.visibility === "closed" ? <Lock size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} /> : <Globe size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />}
            <span className="flex items-center gap-1 text-[11px] font-mono"
                  style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              <Users size={11} /> {group.memberCount ?? 0}
            </span>
          </div>
        </div>

        {group.description && (
          <p className="text-[12px] leading-relaxed line-clamp-2"
             style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
            {group.description}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.slice(0, 4).map(t => (
              <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.45)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                {t}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="text-[10px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>+{tags.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export default function Roamers() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "squad" | "crew" | "community">("all");

  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const { data: eligibility } = useQuery<{ eligible: boolean; reason?: string }>({
    queryKey: ["/api/groups/eligibility/check"],
    enabled: !!user,
  });

  const myGroupIds: string[] = [];
  if (user) {
    groups.forEach(g => {
      if (g.leaderId === user.id) myGroupIds.push(g.id);
    });
  }

  const filtered = filter === "all" ? groups : groups.filter(g => g.type === filter);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      <AppNav />

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-serif text-3xl font-black" style={{ color: "var(--roam-cream)" }}>
                groups.
              </h1>
              <p className="text-sm mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                Find your adventure crew
              </p>
            </div>
            {user && eligibility?.eligible && (
              <button
                onClick={() => navigate("/groups/new")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                data-testid="button-create-group"
              >
                <Plus size={15} /> New group
              </button>
            )}
          </div>

          {user && eligibility && !eligibility.eligible && (
            <div className="mt-4 p-3 rounded-xl text-[11px]"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)", color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              <span className="font-mono tracking-wide">To create a group: </span>{eligibility.reason}
            </div>
          )}
        </div>

        <div className="px-5 flex flex-wrap gap-2 mb-5">
          {(["all", "squad", "crew", "community"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all"
                    style={{
                      background: filter === f ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)",
                      color: filter === f ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.5)",
                      border: filter === f ? "none" : "1px solid rgba(var(--roam-cream-rgb),0.08)",
                    }}
                    data-testid={`filter-${f}`}>
              {f === "all" ? "All" : f === "squad" ? "Squad 2–5" : f === "crew" ? "Crew 6–20" : "Community 20+"}
            </button>
          ))}
        </div>

        <div className="px-5 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-44 rounded-2xl animate-pulse"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }} />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="font-serif text-4xl mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }}>r.</div>
              <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                No groups yet. Be the first to start one.
              </p>
            </div>
          )}

          {!isLoading && filtered.map(g => (
            <GroupCard
              key={g.id}
              group={g}
              myGroupIds={myGroupIds}
              onClick={() => navigate(`/groups/${g.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
