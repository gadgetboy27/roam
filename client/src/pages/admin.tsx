import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/lib/adminAuth";
import {
  Users, BarChart2, Shield, ArrowLeft, Trash2, ChevronDown,
  Loader2, RefreshCw, CheckCircle2, Clock, MousePointerClick,
  Eye, TrendingUp, Megaphone, Plus, LogOut, UserCog, KeyRound,
  MapPin, Globe, Lock,
} from "lucide-react";
import type { Ad } from "@shared/schema";

type SafeUser = {
  id: string;
  email: string;
  name: string;
  tier: "free" | "adventurer" | "contributor";
  identityVerified: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  location: string | null;
  avatarUrl: string | null;
};

const TIER_COLORS: Record<string, string> = {
  free: "rgba(var(--roam-cream-rgb),0.4)",
  adventurer: "rgba(var(--roam-electric-rgb),0.9)",
  contributor: "rgba(var(--roam-sky-rgb),0.9)",
};
const TIER_BG: Record<string, string> = {
  free: "rgba(var(--roam-cream-rgb),0.06)",
  adventurer: "rgba(var(--roam-electric-rgb),0.1)",
  contributor: "rgba(var(--roam-sky-rgb),0.1)",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "rgba(var(--roam-cream-rgb),0.35)",
  pending_review: "rgba(var(--roam-sky-rgb),0.9)",
  approved: "rgba(var(--roam-electric-rgb),0.9)",
  rejected: "rgba(var(--roam-ember-rgb),0.9)",
  expired: "rgba(var(--roam-cream-rgb),0.3)",
};

function ctr(clicks: number, impressions: number) {
  if (!impressions) return "—";
  return ((clicks / impressions) * 100).toFixed(1) + "%";
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function UserRow({ user, onTierChange, onDelete, isSelf }: {
  user: SafeUser;
  onTierChange: (id: string, tier: string) => void;
  onDelete: (id: string, name: string) => void;
  isSelf: boolean;
}) {
  const [showTierMenu, setShowTierMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
         style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
         data-testid={`user-row-${user.id}`}>

      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name}
             className="w-9 h-9 rounded-full object-cover flex-shrink-0"
             style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }} />
      ) : (
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-serif font-black text-sm"
             style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
          {user.name?.charAt(0) || "?"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[12px] font-semibold truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.85)" }}>
            {user.name}
          </span>
          {user.identityVerified && (
            <CheckCircle2 size={10} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
          )}
          {isSelf && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
              you
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
          {user.email}
        </div>
        <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
          {user.location || "—"} · joined {timeAgo(user.createdAt)}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowTierMenu(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-[9px] tracking-wider uppercase"
            style={{ background: TIER_BG[user.tier], color: TIER_COLORS[user.tier], border: `1px solid ${TIER_COLORS[user.tier]}40` }}
            data-testid={`tier-btn-${user.id}`}>
            {user.tier}
            <ChevronDown size={9} />
          </button>
          {showTierMenu && (
            <div className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-2xl min-w-[120px]"
                 style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }}>
              {(["free", "adventurer", "contributor"] as const).map(t => (
                <button key={t}
                        onClick={() => { onTierChange(user.id, t); setShowTierMenu(false); }}
                        className="w-full px-3 py-2 text-left font-mono text-[10px] tracking-wider uppercase transition-all hover:opacity-80"
                        style={{
                          background: user.tier === t ? `${TIER_BG[t]}` : "transparent",
                          color: TIER_COLORS[t],
                        }}
                        data-testid={`tier-option-${t}-${user.id}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isSelf && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(user.id, user.name)}
                      className="font-mono text-[8px] px-2 py-1 rounded-lg"
                      style={{ background: "var(--roam-ember)", color: "#fff" }}
                      data-testid={`confirm-ban-${user.id}`}>
                confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                      className="font-mono text-[8px] px-2 py-1 rounded-lg"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.08)", color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                    style={{ background: "rgba(var(--roam-ember-rgb),0.08)", border: "1px solid rgba(var(--roam-ember-rgb),0.15)" }}
                    title={`Ban / remove ${user.name}`}
                    data-testid={`ban-btn-${user.id}`}>
              <Trash2 size={11} style={{ color: "var(--roam-ember)" }} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

function AdMetricRow({ ad }: { ad: Ad }) {
  const clicks = ad.clicks ?? 0;
  const impressions = ad.impressions ?? 0;
  const maxBar = Math.max(impressions, 1);

  return (
    <div className="rounded-2xl px-4 py-4"
         style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
         data-testid={`ad-metric-${ad.id}`}>
      <div className="flex items-start gap-3 mb-3">
        {ad.imageUrl && (
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
            <img src={ad.imageUrl} alt={ad.headline} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                  style={{ color: STATUS_COLORS[ad.status] || "rgba(var(--roam-cream-rgb),0.4)", background: `${STATUS_COLORS[ad.status]}15` }}>
              {ad.status.replace("_", " ")}
            </span>
            <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
              {ad.tier}
            </span>
          </div>
          <div className="font-serif text-[14px] font-bold truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.85)" }}>
            {ad.headline}
          </div>
          <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            {ad.advertiserName}{ad.advertiserCompany ? ` · ${ad.advertiserCompany}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl px-3 py-2.5 text-center"
             style={{ background: "rgba(var(--roam-cream-rgb),0.04)" }}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Eye size={9} style={{ color: "rgba(var(--roam-sky-rgb),0.7)" }} />
            <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>Views</span>
          </div>
          <div className="font-mono text-[16px] font-black" style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }}>
            {impressions.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl px-3 py-2.5 text-center"
             style={{ background: "rgba(var(--roam-cream-rgb),0.04)" }}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <MousePointerClick size={9} style={{ color: "var(--roam-electric)" }} />
            <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>Clicks</span>
          </div>
          <div className="font-mono text-[16px] font-black" style={{ color: "var(--roam-electric)" }}>
            {clicks.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl px-3 py-2.5 text-center"
             style={{ background: "rgba(var(--roam-cream-rgb),0.04)" }}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp size={9} style={{ color: "rgba(var(--roam-ember-rgb),0.8)" }} />
            <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>CTR</span>
          </div>
          <div className="font-mono text-[16px] font-black" style={{ color: "rgba(var(--roam-ember-rgb),0.9)" }}>
            {ctr(clicks, impressions)}
          </div>
        </div>
      </div>

      {impressions > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[8px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
            <span>impressions</span><span>clicks</span>
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--roam-cream-rgb),0.06)" }}>
            <div className="absolute left-0 top-0 h-full rounded-full"
                 style={{ width: "100%", background: "rgba(var(--roam-sky-rgb),0.25)" }} />
            <div className="absolute left-0 top-0 h-full rounded-full"
                 style={{ width: `${Math.min((clicks / maxBar) * 100, 100)}%`, background: "var(--roam-electric)" }} />
          </div>
        </div>
      )}

      {ad.expiresAt && (
        <div className="mt-2 font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
          {ad.status === "approved" ? `Expires ${new Date(ad.expiresAt).toLocaleDateString()}` : `Expired ${new Date(ad.expiresAt).toLocaleDateString()}`}
        </div>
      )}
    </div>
  );
}

type AdminAccount = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  createdBy: string | null;
};

export default function Admin() {
  const [, navigate] = useLocation();
  const { admin, isLoading: authLoading, logout } = useAdminAuth();
  const [tab, setTab] = useState<"users" | "ads" | "groups" | "admins">("users");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminDisplay, setNewAdminDisplay] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmDeleteAdminId, setConfirmDeleteAdminId] = useState<string | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers, isRefetching: usersRefetching } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!admin,
    retry: false,
  });

  const { data: allAds = [], isLoading: adsLoading, refetch: refetchAds, isRefetching: adsRefetching } = useQuery<Ad[]>({
    queryKey: ["/api/ads/admin"],
    enabled: !!admin,
    retry: false,
  });

  const { data: adminAccounts = [], isLoading: adminsLoading, refetch: refetchAdmins } = useQuery<AdminAccount[]>({
    queryKey: ["/api/admin/accounts"],
    enabled: !!admin,
    retry: false,
  });

  const { data: allGroups = [], isLoading: groupsLoading, refetch: refetchGroups, isRefetching: groupsRefetching } = useQuery<any[]>({
    queryKey: ["/api/admin/groups"],
    enabled: !!admin,
    retry: false,
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      showToast("Group removed");
    },
    onError: (e: any) => showToast(e.message || "Delete failed", "err"),
  });

  const tierMutation = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { tier }),
    onSuccess: (_, { tier }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      showToast(`Tier updated to ${tier}`);
    },
    onError: (e: any) => showToast(e.message || "Update failed", "err"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      showToast("User removed");
    },
    onError: (e: any) => showToast(e.message || "Delete failed", "err"),
  });

  const createAdminMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/accounts", {
      username: newAdminUsername.trim(),
      password: newAdminPassword,
      displayName: newAdminDisplay.trim() || newAdminUsername.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setNewAdminUsername("");
      setNewAdminDisplay("");
      setNewAdminPassword("");
      showToast("Admin account created");
    },
    onError: (e: any) => showToast(e.message || "Failed to create admin", "err"),
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setConfirmDeleteAdminId(null);
      showToast("Admin account removed");
    },
    onError: (e: any) => {
      setConfirmDeleteAdminId(null);
      showToast(e.message || "Delete failed", "err");
    },
  });

  const tiers = ["free", "adventurer", "contributor"] as const;
  const tierCounts = tiers.reduce((acc, t) => ({ ...acc, [t]: users.filter(u => u.tier === t).length }), {} as Record<string, number>);
  const filteredUsers = tierFilter === "all" ? users : users.filter(u => u.tier === tierFilter);
  const openToRoamingCount = users.filter(u => (u as any).openToRoaming).length;

  const totalImpressions = allAds.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks = allAds.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const liveAds = allAds.filter(a => a.status === "approved");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--roam-electric)" }} />
      </div>
    );
  }

  if (!admin) {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="min-h-screen relative" data-testid="page-admin">
      <div className="topo-bg" />

      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl font-mono text-[11px] shadow-2xl"
             style={{
               background: toast.type === "ok" ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-ember-rgb),0.15)",
               border: `1px solid ${toast.type === "ok" ? "rgba(var(--roam-electric-rgb),0.4)" : "rgba(var(--roam-ember-rgb),0.4)"}`,
               color: toast.type === "ok" ? "var(--roam-electric)" : "var(--roam-ember)",
             }}>
          {toast.msg}
        </div>
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h1 className="font-serif text-[26px] font-black">
              Admin <span style={{ color: "var(--roam-electric)" }}>Dashboard</span>
            </h1>
            <p className="font-mono text-[10px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              signed in as <span style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{admin.displayName || admin.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/ads">
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-[10px] tracking-wider"
                      style={{ background: "rgba(var(--roam-sky-rgb),0.08)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)", color: "rgba(var(--roam-sky-rgb),0.8)" }}
                      data-testid="link-ad-review">
                <Megaphone size={12} /> Ad Review
              </button>
            </Link>
            <button
              onClick={async () => { await logout(); navigate("/admin/login"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] tracking-wider"
              style={{ background: "rgba(var(--roam-ember-rgb),0.08)", border: "1px solid rgba(var(--roam-ember-rgb),0.2)", color: "rgba(var(--roam-ember-rgb),0.8)" }}
              data-testid="button-admin-logout"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { value: users.length, label: "Total Users",   color: "rgba(var(--roam-electric-rgb),0.9)" },
            { value: tierCounts.adventurer || 0, label: "Adventurers", color: "rgba(var(--roam-electric-rgb),0.9)" },
            { value: tierCounts.contributor || 0, label: "Contributors", color: "rgba(var(--roam-sky-rgb),0.9)" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div className="font-mono text-[20px] font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="font-mono text-[8px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { value: allGroups.length, label: "Active Groups", color: "rgba(var(--roam-electric-rgb),0.85)" },
            { value: openToRoamingCount, label: "Open to Roam",  color: "rgba(var(--roam-sky-rgb),0.9)" },
            { value: liveAds.length, label: "Live Ads",      color: "rgba(var(--roam-ember-rgb),0.9)" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div className="font-mono text-[20px] font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="font-mono text-[8px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: "users",  label: "Users",      icon: Users },
            { key: "ads",    label: "Ad Metrics", icon: BarChart2 },
            { key: "groups", label: "Groups",      icon: Users },
            { key: "admins", label: "Admins",      icon: UserCog },
          ].map(t => (
            <button key={t.key}
                    onClick={() => setTab(t.key as any)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] tracking-wider transition-all"
                    style={{
                      background: tab === t.key ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.05)",
                      color: tab === t.key ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.45)",
                      border: `1px solid ${tab === t.key ? "rgba(var(--roam-electric-rgb),0.3)" : "rgba(var(--roam-cream-rgb),0.08)"}`,
                    }}
                    data-testid={`tab-${t.key}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5 flex-wrap">
                {([["all", "All"], ...tiers.map(t => [t, t])] as [string, string][]).map(([key, label]) => (
                  <button key={key}
                          onClick={() => setTierFilter(key)}
                          className="font-mono text-[9px] tracking-wider uppercase px-3 py-1.5 rounded-full transition-all"
                          style={{
                            background: tierFilter === key ? "rgba(var(--roam-electric-rgb),0.12)" : "rgba(var(--roam-cream-rgb),0.05)",
                            color: tierFilter === key ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.4)",
                            border: `1px solid ${tierFilter === key ? "rgba(var(--roam-electric-rgb),0.3)" : "rgba(var(--roam-cream-rgb),0.08)"}`,
                          }}
                          data-testid={`filter-${key}`}>
                    {label} {key !== "all" && tierCounts[key] ? `(${tierCounts[key]})` : ""}
                  </button>
                ))}
              </div>
              <button onClick={() => refetchUsers()}
                      className="p-2 rounded-xl"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                      data-testid="refresh-users">
                <RefreshCw size={12} className={usersRefetching ? "animate-spin" : ""} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} />
              </button>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-20">
                <Users size={24} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.2)" }} />
                <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>No users in this category</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={false}
                    onTierChange={(id, tier) => tierMutation.mutate({ id, tier })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "ads" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="grid grid-cols-3 gap-2 flex-1">
                <div className="rounded-xl px-3 py-2.5 text-center"
                     style={{ background: "rgba(var(--roam-sky-rgb),0.06)", border: "1px solid rgba(var(--roam-sky-rgb),0.12)" }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Eye size={9} style={{ color: "rgba(var(--roam-sky-rgb),0.7)" }} />
                  </div>
                  <div className="font-mono text-[14px] font-black" style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }}>
                    {totalImpressions.toLocaleString()}
                  </div>
                  <div className="font-mono text-[8px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>total views</div>
                </div>
                <div className="rounded-xl px-3 py-2.5 text-center"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.12)" }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <MousePointerClick size={9} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <div className="font-mono text-[14px] font-black" style={{ color: "var(--roam-electric)" }}>
                    {totalClicks.toLocaleString()}
                  </div>
                  <div className="font-mono text-[8px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>total clicks</div>
                </div>
                <div className="rounded-xl px-3 py-2.5 text-center"
                     style={{ background: "rgba(var(--roam-ember-rgb),0.06)", border: "1px solid rgba(var(--roam-ember-rgb),0.12)" }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp size={9} style={{ color: "rgba(var(--roam-ember-rgb),0.8)" }} />
                  </div>
                  <div className="font-mono text-[14px] font-black" style={{ color: "rgba(var(--roam-ember-rgb),0.9)" }}>
                    {ctr(totalClicks, totalImpressions)}
                  </div>
                  <div className="font-mono text-[8px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>overall CTR</div>
                </div>
              </div>
              <button onClick={() => refetchAds()}
                      className="p-2 rounded-xl ml-3"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                      data-testid="refresh-ads">
                <RefreshCw size={12} className={adsRefetching ? "animate-spin" : ""} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} />
              </button>
            </div>

            {adsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
              </div>
            ) : allAds.length === 0 ? (
              <div className="text-center py-20">
                <BarChart2 size={24} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.2)" }} />
                <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>No ads yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allAds.map(ad => <AdMetricRow key={ad.id} ad={ad} />)}
              </div>
            )}
          </div>
        )}

        {tab === "groups" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                {allGroups.length} active group{allGroups.length !== 1 ? "s" : ""}
              </div>
              <button onClick={() => refetchGroups()}
                      className="p-2 rounded-xl"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                      data-testid="refresh-groups">
                <RefreshCw size={12} className={groupsRefetching ? "animate-spin" : ""} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} />
              </button>
            </div>

            {groupsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
              </div>
            ) : allGroups.length === 0 ? (
              <div className="text-center py-20">
                <Users size={24} className="mx-auto mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.2)" }} />
                <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>No groups yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allGroups.map((g: any) => {
                  const TYPE_COLOR: Record<string, string> = {
                    squad: "rgba(var(--roam-electric-rgb),0.9)",
                    crew: "rgba(var(--roam-sky-rgb),0.9)",
                    community: "rgba(232,98,26,0.9)",
                  };
                  return (
                    <div key={g.id}
                         className="rounded-2xl px-4 py-3.5"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                         data-testid={`group-row-${g.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[13px]" style={{ color: "rgba(var(--roam-cream-rgb),0.9)" }}>
                              {g.name}
                            </span>
                            <span className="font-mono text-[8px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                                  style={{ background: `rgba(${g.type === "squad" ? "var(--roam-electric-rgb)" : g.type === "crew" ? "var(--roam-sky-rgb)" : "232,98,26"},0.1)`, color: TYPE_COLOR[g.type] || "rgba(var(--roam-cream-rgb),0.5)" }}>
                              {g.type}
                            </span>
                            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                              {g.visibility === "open" ? <Globe size={8} /> : <Lock size={8} />}
                              {g.visibility}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                              {g.memberCount} member{g.memberCount !== 1 ? "s" : ""} / {g.maxSize} max
                            </span>
                            {g.location && (
                              <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                                <MapPin size={9} /> {g.location}
                              </span>
                            )}
                          </div>
                          {g.description && (
                            <p className="text-[11px] mt-1 truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                              {g.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => { if (window.confirm(`Remove group "${g.name}"?`)) deleteGroupMutation.mutate(g.id); }}
                          className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}
                          data-testid={`button-delete-group-${g.id}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "admins" && (
          <div className="space-y-6">
            <div className="rounded-2xl p-5 space-y-4"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={14} style={{ color: "var(--roam-electric)" }} />
                <h3 className="font-mono text-[11px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                  Add Admin Account
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[9px] tracking-widest mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>USERNAME</label>
                  <input
                    value={newAdminUsername}
                    onChange={e => setNewAdminUsername(e.target.value)}
                    data-testid="input-new-admin-username"
                    className="w-full px-3 py-2.5 rounded-xl font-mono text-[12px] outline-none"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                    placeholder="jsmith"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] tracking-widest mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>DISPLAY NAME</label>
                  <input
                    value={newAdminDisplay}
                    onChange={e => setNewAdminDisplay(e.target.value)}
                    data-testid="input-new-admin-display"
                    className="w-full px-3 py-2.5 rounded-xl font-mono text-[12px] outline-none"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                    placeholder="Jamie Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[9px] tracking-widest mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>PASSWORD (min. 12 characters)</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  data-testid="input-new-admin-password"
                  className="w-full px-3 py-2.5 rounded-xl font-mono text-[12px] outline-none"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                  placeholder="••••••••••••"
                />
              </div>
              <button
                onClick={() => createAdminMutation.mutate()}
                disabled={createAdminMutation.isPending || !newAdminUsername.trim() || newAdminPassword.length < 12}
                data-testid="button-create-admin"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] tracking-wider transition-all"
                style={{
                  background: createAdminMutation.isPending || !newAdminUsername.trim() || newAdminPassword.length < 12
                    ? "rgba(var(--roam-electric-rgb),0.08)"
                    : "rgba(var(--roam-electric-rgb),0.15)",
                  color: createAdminMutation.isPending || !newAdminUsername.trim() || newAdminPassword.length < 12
                    ? "rgba(var(--roam-cream-rgb),0.25)"
                    : "var(--roam-electric)",
                  border: "1px solid rgba(var(--roam-electric-rgb),0.2)",
                }}>
                {createAdminMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Create admin
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                  Current Admins ({adminAccounts.length})
                </h3>
                <button onClick={() => refetchAdmins()} className="p-1.5 rounded-lg" style={{ background: "rgba(var(--roam-cream-rgb),0.05)" }}>
                  <RefreshCw size={10} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
                </button>
              </div>

              {adminsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
                </div>
              ) : (
                <div className="space-y-2">
                  {adminAccounts.map(a => (
                    <div key={a.id}
                         className="flex items-center justify-between px-4 py-3 rounded-xl"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                         data-testid={`admin-account-${a.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                             style={{ background: a.id === admin.id ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.06)" }}>
                          <Shield size={13} style={{ color: a.id === admin.id ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.4)" }} />
                        </div>
                        <div>
                          <div className="font-mono text-[12px]" style={{ color: "rgba(var(--roam-cream-rgb),0.85)" }}>
                            {a.displayName || a.username}
                            {a.id === admin.id && (
                              <span className="ml-2 font-mono text-[9px] px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>you</span>
                            )}
                          </div>
                          <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}>
                            @{a.username}
                          </div>
                        </div>
                      </div>

                      {a.id !== admin.id && (
                        confirmDeleteAdminId === a.id ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-ember-rgb),0.7)" }}>Remove?</span>
                            <button onClick={() => deleteAdminMutation.mutate(a.id)}
                                    disabled={deleteAdminMutation.isPending}
                                    className="px-2.5 py-1.5 rounded-lg font-mono text-[9px]"
                                    style={{ background: "rgba(var(--roam-ember-rgb),0.12)", color: "var(--roam-ember)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)" }}>
                              {deleteAdminMutation.isPending ? <Loader2 size={9} className="animate-spin" /> : "Confirm"}
                            </button>
                            <button onClick={() => setConfirmDeleteAdminId(null)}
                                    className="px-2.5 py-1.5 rounded-lg font-mono text-[9px]"
                                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteAdminId(a.id)}
                                  className="p-2 rounded-lg transition-all"
                                  style={{ color: "rgba(var(--roam-ember-rgb),0.5)" }}
                                  data-testid={`remove-admin-${a.id}`}>
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
