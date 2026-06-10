import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useCrewUp } from "@/lib/useCrewUp";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fileToDataUrl } from "@/lib/file";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Camera, Edit3, Settings, X, Check, Bell, Shield, LogOut, ChevronRight, Plus, Upload, Loader2, Trash2, Banknote, ExternalLink, AlertCircle, ShieldCheck, Zap, Users, Tent } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { computeVibeWord } from "@/lib/fingerprint";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80&fit=crop";

const PROFILE_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80&fit=crop", tags: ["rock climbing", "alpine"] },
  { url: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=80&fit=crop", tags: ["hiking", "alpine trail"] },
  { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80&fit=crop", tags: ["surfing", "ocean"] },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80&fit=crop", tags: ["night market", "street food"] },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&fit=crop", tags: ["mountain", "landscape"] },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80&fit=crop", tags: ["aerial", "coast"] },
];

const ALL_DNA_TAGS = [
  "surfing", "kayaking", "scuba diving", "free diving", "kitesurfing",
  "stand up paddle", "boating / fishing", "wild swimming", "coastal walks",
  "rock climbing", "alpine hiking", "bouldering", "canyoning", "via ferrata",
  "mountain biking", "skiing", "snowboarding", "paragliding",
  "trail running", "forest trails", "backpacking", "camping & bushcraft",
  "cycling", "horse riding", "slacklining",
  "skydiving", "bungee jumping", "extreme sports", "caving",
  "skateboarding", "urban roaming", "night markets", "food & wine trails",
  "pub games", "couch surfing",
  "gym / fitness", "crossfit", "yoga / wellness", "martial arts",
  "dance / movement", "swimming",
  "team sports", "field sports", "racquet sports",
  "geocaching", "chess", "board games", "escape rooms", "photography",
  "cooking / food", "music", "art & galleries", "astronomy",
  "foraging", "wildlife watching",
];

const inputStyle: React.CSSProperties = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="sheet-overlay">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative rounded-t-[28px] max-h-[90vh] overflow-y-auto"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-4"
             style={{ background: "var(--roam-surface)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
          <h2 className="font-serif text-xl font-black">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }} data-testid="button-close-sheet">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const { toast } = useToast();
  const { canInstall, triggerInstall, isIos } = usePwaInstall();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showYearCard, setShowYearCard] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySubmitted, setVerifySubmitted] = useState(false);
  const [verifyTimedOut, setVerifyTimedOut] = useState(false);
  const [verifyNeedsRetry, setVerifyNeedsRetry] = useState(false);
  const [verifyReason, setVerifyReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [boosting, setBoosting] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [organisingUp, setOrganisingUp] = useState(false);
  const [squadLeader, setSquadLeader] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [connectRefresh, setConnectRefresh] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOrganiser = !!(user as any)?.isOrganiser;

  const { data: connectStatus, refetch: refetchConnect } = useQuery<{
    status: "not_started" | "pending" | "active";
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    accountId?: string;
    dashboardUrl?: string;
  }>({
    queryKey: ["/api/stripe/connect/status"],
    enabled: isOrganiser,
    staleTime: 60_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") { setVerifySubmitted(true); window.history.replaceState({}, "", "/profile"); refresh(); }
    if (params.get("upgraded") === "1") { setUpgraded(true); window.history.replaceState({}, "", "/profile"); refresh(); }
    if (params.get("boosted") === "1") { setBoosted(true); window.history.replaceState({}, "", "/profile"); refresh(); }
    if (params.get("squad") === "1") { setSquadLeader(true); window.history.replaceState({}, "", "/profile"); refresh(); }
    if (params.get("connect") === "success") { setConnectSuccess(true); window.history.replaceState({}, "", "/profile"); refetchConnect(); }
    if (params.get("connect") === "refresh") { setConnectRefresh(true); window.history.replaceState({}, "", "/profile"); }
  }, []);

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const res = await apiRequest("POST", "/api/checkout/boost");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ } finally { setBoosting(false); }
  };

  const handleOrganiser = async () => {
    setOrganisingUp(true);
    try {
      const res = await apiRequest("POST", "/api/checkout/organiser");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ } finally { setOrganisingUp(false); }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/connect/start");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Stripe Connect failed", description: data.message || "Could not start bank account setup.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Connection error", description: err?.message || "Could not reach payment service.", variant: "destructive" });
    } finally { setConnectingStripe(false); }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const res = await apiRequest("POST", "/api/checkout/start");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setUpgradeError("Could not start checkout. Please try again.");
    } catch (err: any) {
      setUpgradeError(err?.message || "Something went wrong.");
    } finally { setUpgrading(false); }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await apiRequest("POST", "/api/checkout/portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setUpgradeError("Could not open billing portal. Please try again."); }
  };

  useEffect(() => {
    if (!user?.identityVerificationId || user?.identityVerified) return;
    let attempts = 0;
    setVerifyTimedOut(false);
    const interval = setInterval(async () => {
      attempts++;
      // Ask the server to confirm directly with Stripe (works even if the
      // Stripe webhook is misconfigured), then refresh the local user.
      try {
        const res = await apiRequest("POST", "/api/verify/status");
        const data = await res.json().catch(() => null);
        if (data?.verified) { clearInterval(interval); await refresh(); return; }
        if (data?.status === "requires_input") {
          // Stripe couldn't verify the document/selfie — stop polling and show a retry.
          clearInterval(interval);
          const code = data?.lastError?.reason || data?.lastError?.code;
          setVerifyReason(code ? `Stripe couldn't verify it (${String(code).replace(/_/g, " ")}).` : "");
          setVerifyNeedsRetry(true);
          await refresh();
          return;
        }
      } catch { /* fall back to refresh */ }
      await refresh();
      if (attempts >= 10) { clearInterval(interval); setVerifyTimedOut(true); }
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.identityVerificationId, user?.identityVerified]);

  const handleResetVerification = async () => {
    setResetting(true);
    try {
      await apiRequest("POST", "/api/verify/reset");
      setVerifyTimedOut(false);
      await refresh();
    } catch { setVerifyError("Could not reset. Please try again."); } finally { setResetting(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiRequest("DELETE", "/api/account");
      await logout();
      navigate("/");
    } catch { setConfirmDelete(false); setDeleting(false); }
  };

  const handleStartVerification = async () => {
    if (!user) return;
    setVerifyNeedsRetry(false);
    setVerifyReason("");
    setVerifyTimedOut(false);
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await apiRequest("POST", "/api/verify/start");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setVerifyError("Could not start verification. Please try again.");
    } catch (err: any) {
      setVerifyError(err?.message || "Something went wrong.");
    } finally { setVerifying(false); }
  };

  const calcAge = (dob: string | null) => {
    if (!dob) return "—";
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return String(age);
  };

  const [profileData, setProfileData] = useState({
    name: user?.name || "You",
    nickname: user?.nickname || "",
    age: calcAge(user?.dob ?? null),
    tagline: user?.tagline || "Chasing elevation and good coffee",
    location: user?.location || "Auckland, NZ",
    dna: user?.adventureTags?.length ? user.adventureTags : ["alpine hiking", "surfing", "night markets", "kayaking", "coastal walks"],
    avatarUrl: user?.avatarUrl || FALLBACK_HERO,
  });

  const [editForm, setEditForm] = useState({ ...profileData });
  const [notifications, setNotifications] = useState({ matches: true, messages: true, bucketList: false });
  const [openToRoaming, setOpenToRoaming] = useState<boolean>(!!(user as any)?.openToRoaming);
  const [savingRoaming, setSavingRoaming] = useState(false);
  const [safetyMode, setSafetyMode] = useState<boolean>(!!(user as any)?.safetyModeEnabled);
  const [savingSafety, setSavingSafety] = useState(false);

  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
    select: (data) => data.filter((g: any) => g.leaderId === user?.id || false),
    enabled: !!user,
  });

  const { data: connections = [] } = useQuery<{ id: string; name: string; avatarUrl: string | null; tagline: string | null }[]>({
    queryKey: ["/api/connections"],
    enabled: !!user,
  });
  const crewUp = useCrewUp();

  const toggleOpenToRoaming = async (val: boolean) => {
    if (!user) return;
    setSavingRoaming(true);
    setOpenToRoaming(val);
    try { await apiRequest("PATCH", `/api/users/${user.id}/open-to-roaming`, { openToRoaming: val }); }
    catch { setOpenToRoaming(!val); } finally { setSavingRoaming(false); }
  };

  const toggleSafetyMode = async (val: boolean) => {
    if (!user) return;
    setSavingSafety(true);
    setSafetyMode(val);
    try { await apiRequest("PATCH", `/api/users/${user.id}/safety-mode`, { safetyModeEnabled: val }); }
    catch { setSafetyMode(!val); } finally { setSavingSafety(false); }
  };

  const openEdit = () => { setEditForm({ ...profileData }); setSaveError(""); setEditOpen(true); };

  const saveEdit = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError("");
    try {
      await apiRequest("PATCH", `/api/users/${user.id}`, {
        name: editForm.name,
        nickname: editForm.nickname,
        tagline: editForm.tagline,
        location: editForm.location,
        avatarUrl: editForm.avatarUrl,
        adventureTags: editForm.dna,
      });
      await refresh();
      setProfileData({ ...editForm });
      setEditOpen(false);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  };

  const toggleDnaTag = (tag: string) => {
    setEditForm(f => ({
      ...f,
      dna: f.dna.includes(tag) ? f.dna.filter(t => t !== tag) : [...f.dna, tag],
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setEditForm(f => ({ ...f, avatarUrl: dataUrl }));
      setUploadingAvatar(false);
    } catch { setUploadingAvatar(false); }
  };

  const vibeWord = computeVibeWord(profileData.dna);
  const boostActive = (user as any)?.boostExpiresAt && new Date((user as any).boostExpiresAt) > new Date();

  return (
    <div className="min-h-screen relative" data-testid="page-profile">
      <div className="topo-bg" />
      <div className="relative z-10">
        <AppNav />
        <div className="max-w-lg mx-auto pb-10 pr-14">

          {/* ── Hero ── */}
          <div className="relative h-56 overflow-hidden" style={{ userSelect: "none" }}
               onContextMenu={e => e.preventDefault()}>
            <img src={profileData.avatarUrl || FALLBACK_HERO} alt="Profile hero"
                 className="w-full h-full object-cover" draggable={false}
                 style={{ pointerEvents: "none" }} />
            <div className="absolute inset-0"
                 style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.28) 50%, transparent 100%)", pointerEvents: "none" }} />

            <div className="absolute top-3 right-3 flex gap-2">
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg transition-all hover:scale-105"
                      style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)" }}
                      onClick={openEdit} data-testid="button-edit-profile">
                <Edit3 size={14} />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-lg transition-all hover:scale-105"
                      style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)" }}
                      onClick={() => setSettingsOpen(true)} data-testid="button-settings">
                <Settings size={14} />
              </button>
            </div>

            <div className="absolute bottom-4 left-5">
              <h1 className="font-serif text-3xl font-black" style={{ color: "rgba(255,255,255,0.96)" }} data-testid="text-profile-name">
                {profileData.name}, {profileData.age}
              </h1>
              <p className="text-[13px] italic mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                "{profileData.tagline}"
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} style={{ color: "var(--roam-sky)" }} />
                <span className="font-mono text-[10px]" style={{ color: "var(--roam-sky)" }} data-testid="text-location">{profileData.location}</span>
              </div>
            </div>
          </div>

          <div className="px-4 pt-4">

            {/* ── Tier + badges row ── */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="font-mono text-[9px] tracking-wider uppercase py-1 px-2.5 rounded-lg"
                    style={{
                      background: user?.tier === "free" ? "rgba(var(--roam-sky-rgb),0.15)" : user?.tier === "contributor" ? "rgba(var(--roam-ember-rgb),0.15)" : "rgba(var(--roam-electric-rgb),0.15)",
                      color: user?.tier === "free" ? "var(--roam-sky)" : user?.tier === "contributor" ? "var(--roam-ember)" : "var(--roam-electric)",
                    }}>
                {user?.tier === "free" ? "Explorer" : user?.tier === "contributor" ? "Contributor" : "Adventurer"}
              </span>
              <span className="font-mono text-[9px] tracking-wider py-1 px-2.5 rounded-lg"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}
                    data-testid="badge-vibe-word">
                {vibeWord}
              </span>
              {user?.identityVerified && (
                <span className="flex items-center gap-1 font-mono text-[9px] tracking-wider py-1 px-2.5 rounded-lg"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.35)", color: "var(--roam-electric)" }}
                      data-testid="badge-verified-user">
                  <span className="font-bold">✓</span> ID verified
                </span>
              )}
              {boostActive && (
                <span className="flex items-center gap-1 font-mono text-[9px] py-1 px-2.5 rounded-lg"
                      style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)" }}>
                  ⚡ Boosted
                </span>
              )}
              {user?.tier === "adventurer" && user?.stripeCustomerId && (
                <button onClick={handleManageSubscription}
                        className="ml-auto font-mono text-[9px] tracking-wider"
                        style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}
                        data-testid="button-manage-subscription">
                  Manage subscription →
                </button>
              )}
            </div>

            {/* ── Return banners ── */}
            {upgraded && (
              <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <span style={{ color: "var(--roam-electric)" }}>✦</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--roam-electric)" }}>Welcome to Adventurer! All features unlocked.</span>
              </div>
            )}
            {boosted && (
              <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <span style={{ color: "var(--roam-electric)" }}>⚡</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--roam-electric)" }}>Profile boosted! You're at the top of discovery for 24 hours.</span>
              </div>
            )}
            {squadLeader && (
              <div className="mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
                   style={{ background: "rgba(var(--roam-ember-rgb),0.1)", border: "1px solid rgba(var(--roam-ember-rgb),0.3)" }}>
                <span style={{ color: "var(--roam-ember)" }}>🏕️</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--roam-ember)" }}>Squad Leader unlocked! Create groups & run ticketed events.</span>
              </div>
            )}

            {/* ── Identity verification — single compact card ── */}
            {!user?.identityVerified && (
              <div className="mb-4 rounded-2xl"
                   style={{ border: "1px solid rgba(var(--roam-electric-rgb),0.3)", background: "rgba(var(--roam-electric-rgb),0.05)" }}
                   data-testid="section-verified-user">
                <div className="px-4 py-3.5">
                  {verifyNeedsRetry ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-semibold" style={{ color: "var(--roam-ember)" }}>Verification didn't pass</div>
                        <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                          {verifyReason ? `${verifyReason} ` : ""}Retry with a clear, well-lit photo of your ID and face.
                        </div>
                      </div>
                      <button onClick={handleStartVerification} disabled={verifying}
                              className="flex-shrink-0 py-2 px-4 rounded-xl font-mono text-[11px] font-semibold transition-all"
                              style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", opacity: verifying ? 0.7 : 1 }}
                              data-testid="button-verify-retry">
                        {verifying ? "Starting…" : "Try again →"}
                      </button>
                    </div>
                  ) : user?.identityVerificationId && !verifyTimedOut ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full animate-spin flex-shrink-0"
                           style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.2)", borderTopColor: "var(--roam-electric)" }} />
                      <div>
                        <div className="font-mono text-[11px] font-semibold" style={{ color: "var(--roam-cream)" }}>Verification in progress</div>
                        <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Usually under a minute — hang tight</div>
                      </div>
                    </div>
                  ) : verifyTimedOut ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] font-semibold" style={{ color: "var(--roam-ember)" }}>Verification is taking longer than expected</div>
                        <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Documents can take a moment to process</div>
                      </div>
                      <button onClick={handleResetVerification} disabled={resetting}
                              className="flex-shrink-0 px-3 py-2 rounded-xl font-mono text-[10px] font-semibold"
                              style={{ background: "rgba(var(--roam-cream-rgb),0.08)", border: "1px solid rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.6)" }}
                              data-testid="button-retry-verification">
                        {resetting ? "Resetting…" : "Start over"}
                      </button>
                    </div>
                  ) : verifySubmitted ? (
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: "16px" }}>⏳</span>
                      <div>
                        <div className="font-mono text-[11px] font-semibold" style={{ color: "var(--roam-electric)" }}>Verification submitted</div>
                        <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>You'll get your ✓ badge shortly</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span style={{ fontSize: "14px" }}>🛡️</span>
                          <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Verify your identity</span>
                        </div>
                        <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                          Gov ID + selfie · 2 min · builds real trust with matches
                        </div>
                        {verifyError && <div className="font-mono text-[10px] mt-1" style={{ color: "var(--roam-ember)" }}>{verifyError}</div>}
                      </div>
                      <button onClick={handleStartVerification} disabled={verifying}
                              className="flex-shrink-0 py-2 px-4 rounded-xl font-mono text-[11px] font-semibold transition-all"
                              style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", opacity: verifying ? 0.7 : 1 }}
                              data-testid="button-verify-identity">
                        {verifying ? "Starting…" : "Verify →"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Upgrade prompt — compact, links to /plans ── */}
            {user?.tier === "free" && (
              <Link href="/plans">
                <div className="mb-4 flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.07)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                      <Zap size={15} style={{ color: "var(--roam-electric)" }} />
                    </div>
                    <div>
                      <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Unlock Adventurer</div>
                      <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                        Unlimited matches · full messaging · $5/mo NZD
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: "rgba(var(--roam-electric-rgb),0.7)" }} />
                </div>
              </Link>
            )}

            {/* ── Squad Leader upsell — compact ── */}
            {!isOrganiser && (
              <button onClick={handleOrganiser} disabled={organisingUp}
                      className="w-full mb-4 flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.01] text-left"
                      style={{ background: "rgba(var(--roam-ember-rgb),0.05)", border: "1px solid rgba(var(--roam-ember-rgb),0.2)" }}
                      data-testid="button-upgrade-organiser">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-ember-rgb),0.1)" }}>
                    <span style={{ fontSize: "15px" }}>🏕️</span>
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Become a Squad Leader</div>
                    <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                      Run groups & ticketed events · $20 one-time NZD
                    </div>
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: "rgba(var(--roam-ember-rgb),0.6)" }} />
              </button>
            )}

            {/* ── Boost ── */}
            {!boostActive && (
              <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-2xl"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                <div>
                  <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>⚡ Boost your profile</div>
                  <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Top of discovery for 24 hours</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-[14px] font-bold" style={{ color: "var(--roam-cream)" }}>$5</span>
                  <button onClick={handleBoost} disabled={boosting}
                          className="py-1.5 px-4 rounded-xl font-mono text-[10px] font-semibold transition-all"
                          style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)", opacity: boosting ? 0.7 : 1 }}
                          data-testid="button-boost-profile">
                    {boosting ? "…" : "Boost"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Adventure DNA ── */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                  Adventure DNA
                </div>
                <button className="flex items-center gap-1 font-mono text-[9px] tracking-wider uppercase py-1 px-2.5 rounded-lg transition-all"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}
                        onClick={openEdit} data-testid="button-edit-dna">
                  <Plus size={10} /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="dna-tags">
                {profileData.dna.map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* ── My groups ── */}
            {myGroups.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                    My groups
                  </div>
                  <Link href="/groups">
                    <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-electric-rgb),0.7)" }}>See all →</span>
                  </Link>
                </div>
                <div className="space-y-2">
                  {myGroups.slice(0, 3).map((g: any) => (
                    <Link key={g.id} href={`/groups/${g.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl"
                           style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                           data-testid={`my-group-${g.id}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-serif font-black text-base"
                               style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
                            r.
                          </div>
                          <div>
                            <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{g.name}</div>
                            <div className="text-[10px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                              {g.type} · {g.memberCount ?? 0} members
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── Crew up with your connections ── */}
            {connections.length > 0 && (
              <div className="mb-5 rounded-2xl p-4"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.22)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(var(--roam-electric-rgb),0.15)" }}>
                    <Tent size={15} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <h3 className="font-serif text-lg font-black" style={{ color: "var(--roam-cream)" }}>Crew up with your people</h3>
                </div>
                <p className="text-[12px] mb-3.5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                  Turn any connection into a squad in one tap — a private crew + campsite chat, and the adventures begin.
                </p>
                <div className="space-y-2.5">
                  {connections.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-2xl"
                         style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                         data-testid={`crew-up-row-${c.id}`}>
                      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "rgba(var(--roam-electric-rgb),0.1)" }}>
                        {c.avatarUrl
                          ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Users size={16} style={{ color: "var(--roam-electric)" }} /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold truncate" style={{ color: "var(--roam-cream)" }}>{c.name}</div>
                        {c.tagline && <div className="text-[11px] truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>{c.tagline}</div>}
                      </div>
                      <button onClick={() => crewUp.mutate({ id: c.id, name: c.name })}
                              disabled={crewUp.isPending}
                              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50"
                              style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                              data-testid={`button-crew-up-${c.id}`}>
                        <Tent size={14} /> Crew up
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Adventure photos CTA ── */}
            <Link href="/upload">
              <div className="mb-4 flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                    <Camera size={15} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Your adventure photos</div>
                    <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                      Photos with you get 3× more matches
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
              </div>
            </Link>

            {/* ── Safety net ── */}
            <Link href="/safety">
              <div className="mb-4 flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.04)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                    <ShieldCheck size={15} style={{ color: "var(--roam-electric)" }} />
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Safety net</div>
                    <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                      Contacts, check-ins & emergency SOS
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }} />
              </div>
            </Link>

            {/* ── Year in adventure ── */}
            <button
              className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, rgba(var(--roam-electric-rgb),0.08), rgba(var(--roam-sky-rgb),0.06))", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
              onClick={() => setShowYearCard(true)}
              data-testid="button-year-in-adventure">
              <span style={{ fontSize: "24px" }}>🌍</span>
              <div className="flex-1">
                <div className="font-mono text-[12px] font-semibold mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.9)" }}>Your 2025 in Adventure</div>
                <div className="font-mono text-[10px]" style={{ color: "var(--roam-electric)" }}>47 adventures · 12 locations · 3 matches</div>
              </div>
              <div className="font-mono text-[10px] font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
                   style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                View &amp; Share
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* ── Edit profile sheet ── */}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Profile photo
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <img src={editForm.avatarUrl || FALLBACK_HERO} alt="Avatar preview" className="w-full h-full object-cover" />
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                     onChange={handleAvatarChange} data-testid="input-avatar-file" />
              <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-[12px] font-mono tracking-wider"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                      onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                      data-testid="button-upload-avatar">
                {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Name</label>
              <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                     value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                     data-testid="input-edit-name" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Age</label>
              <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={{ ...inputStyle, opacity: 0.5 }}
                     value={editForm.age} type="number" min="18" max="99" disabled data-testid="input-edit-age" />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Nickname</label>
            <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                   value={editForm.nickname} maxLength={40} placeholder="What your crew calls you (optional)"
                   onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                   data-testid="input-edit-nickname" />
            <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Shown to your crews and in chat instead of your name.</p>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Tagline</label>
            <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                   value={editForm.tagline} maxLength={60} placeholder="e.g. Chasing summits and night markets"
                   onChange={e => setEditForm(f => ({ ...f, tagline: e.target.value }))}
                   data-testid="input-edit-tagline" />
            <p className="text-[10px] font-mono mt-1 text-right" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>
              {60 - editForm.tagline.length} left
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Base location</label>
            <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                   value={editForm.location} placeholder="e.g. Auckland, NZ"
                   onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                   data-testid="input-edit-location" />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
              Adventure DNA — tap to select
            </label>
            <p className="text-[11px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
              These are auto-detected from your photos too. Manual picks always show first.
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="dna-selector">
              {ALL_DNA_TAGS.map(tag => {
                const active = editForm.dna.includes(tag);
                return (
                  <button key={tag}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-mono tracking-wider transition-all"
                          style={{
                            background: active ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.04)",
                            border: active ? "1px solid rgba(var(--roam-electric-rgb),0.45)" : "1px solid rgba(var(--roam-cream-rgb),0.1)",
                            color: active ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.72)",
                          }}
                          onClick={() => toggleDnaTag(tag)}
                          data-testid={`dna-tag-${tag.replace(/[\s/]+/g, "-")}`}>
                    {active && <Check size={9} className="inline mr-1" />}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && (
            <div className="text-xs font-mono py-2.5 px-4 rounded-xl"
                 style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}
                 data-testid="text-save-error">
              {saveError}
            </div>
          )}

          <button className="w-full py-3.5 rounded-2xl font-mono text-sm tracking-wider uppercase font-medium transition-all hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                  onClick={saveEdit} disabled={saving} data-testid="button-save-profile">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save changes</>}
          </button>
        </div>
      </Sheet>

      {/* ── Settings sheet ── */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-2">

          <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
            Discover preferences
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl mb-2"
               style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            <div>
              <div className="text-sm font-medium">Open to roaming</div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                Show an <span className="font-serif font-black" style={{ color: "var(--roam-electric)" }}>r.</span> badge on your discover card
              </div>
            </div>
            <button className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                    style={{ background: openToRoaming ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.12)" }}
                    onClick={() => toggleOpenToRoaming(!openToRoaming)} disabled={savingRoaming}
                    data-testid="toggle-open-to-roaming">
              <div className="w-4 h-4 rounded-full absolute top-1 transition-all"
                   style={{ background: "white", left: openToRoaming ? "calc(100% - 20px)" : "4px" }} />
            </button>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl mb-4"
               style={{ background: "rgba(var(--roam-electric-rgb),0.05)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold mb-0.5" style={{ color: "var(--roam-cream)" }}>
                🛡️ Safety Mode
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                Only show ID-verified profiles in discover. Fewer matches, but every person has confirmed their real identity.
              </div>
            </div>
            <button className="w-11 h-6 rounded-full relative transition-all flex-shrink-0 mt-0.5"
                    style={{ background: safetyMode ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.12)" }}
                    onClick={() => toggleSafetyMode(!safetyMode)} disabled={savingSafety}
                    data-testid="toggle-safety-mode">
              <div className="w-4 h-4 rounded-full absolute top-1 transition-all"
                   style={{ background: "white", left: safetyMode ? "calc(100% - 20px)" : "4px" }} />
            </button>
          </div>

          <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
            Notifications
          </div>

          {[
            { key: "matches" as const, label: "New matches", desc: "When your adventure DNA aligns with someone's" },
            { key: "messages" as const, label: "Messages", desc: "When a match sends you a message" },
            { key: "bucketList" as const, label: "Bucket list alerts", desc: "When matches share a destination you've pinned" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl"
                 style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{item.desc}</div>
              </div>
              <button className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                      style={{ background: notifications[item.key] ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.12)" }}
                      onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
                      data-testid={`toggle-notif-${item.key}`}>
                <div className="w-4 h-4 rounded-full absolute top-1 transition-all"
                     style={{ background: "white", left: notifications[item.key] ? "calc(100% - 20px)" : "4px" }} />
              </button>
            </div>
          ))}

          {/* Stripe Connect — organisers only */}
          {isOrganiser && (
            <>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3 mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                Organiser
              </div>
              <div className="rounded-2xl overflow-hidden mb-2"
                   style={{ border: `1px solid ${connectStatus?.status === "active" ? "rgba(var(--roam-electric-rgb),0.35)" : "rgba(var(--roam-ember-rgb),0.3)"}`, background: connectStatus?.status === "active" ? "rgba(var(--roam-electric-rgb),0.05)" : "rgba(var(--roam-ember-rgb),0.05)" }}>
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Banknote size={15} style={{ color: connectStatus?.status === "active" ? "var(--roam-electric)" : "var(--roam-ember)" }} />
                    <div>
                      <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Stripe Payouts</div>
                      <div className="font-mono text-[10px]" style={{ color: connectStatus?.status === "active" ? "rgba(var(--roam-electric-rgb),0.7)" : "rgba(var(--roam-ember-rgb),0.7)" }}>
                        {connectStatus?.status === "active" ? "Connected · payouts active · 90% yours" : connectStatus?.status === "pending" ? "Setup incomplete" : "Connect bank to receive ticket revenue"}
                      </div>
                    </div>
                  </div>
                  {connectSuccess && connectStatus?.status === "active" && (
                    <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
                      <Check size={12} style={{ color: "var(--roam-electric)" }} />
                      <span className="font-mono text-[10px]" style={{ color: "var(--roam-electric)" }}>Bank account connected — ticket sales paid out automatically.</span>
                    </div>
                  )}
                  {connectRefresh && (
                    <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
                         style={{ background: "rgba(var(--roam-ember-rgb),0.1)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)" }}>
                      <AlertCircle size={12} style={{ color: "var(--roam-ember)" }} />
                      <span className="font-mono text-[10px]" style={{ color: "var(--roam-ember)" }}>Setup link expired. Click below to restart.</span>
                    </div>
                  )}
                  {connectStatus?.status === "active" ? (
                    <a href={connectStatus.dashboardUrl} target="_blank" rel="noopener noreferrer"
                       className="w-full py-2.5 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all"
                       style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}
                       data-testid="link-stripe-dashboard">
                      <ExternalLink size={12} /> Open Stripe dashboard
                    </a>
                  ) : (
                    <button onClick={handleConnectStripe} disabled={connectingStripe}
                            className="w-full py-2.5 rounded-xl font-mono text-[11px] tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all"
                            style={{ background: "rgba(var(--roam-ember-rgb),0.15)", border: "1px solid rgba(var(--roam-ember-rgb),0.4)", color: "var(--roam-ember)", opacity: connectingStripe ? 0.7 : 1 }}
                            data-testid="button-connect-stripe">
                      {connectingStripe ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
                      {connectingStripe ? "Opening Stripe…" : connectStatus?.status === "pending" ? "Continue bank setup →" : "Connect bank account →"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="pt-3 pb-1">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2"
                 style={{ color: "rgba(var(--roam-cream-rgb),0.45)", borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)", paddingTop: "12px" }}>
              Signed in as
            </div>
            <div className="font-mono text-[11px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>
              {user?.email}
            </div>
          </div>

          {canInstall && (
            <button className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all mb-2"
                    style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.18)" }}
                    onClick={isIos ? undefined : triggerInstall} data-testid="button-install-pwa">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                <Shield size={15} style={{ color: "var(--roam-electric)" }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--roam-electric)" }}>
                  {isIos ? "Add to Home Screen" : "Install roam. app"}
                </div>
                {isIos && (
                  <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-electric-rgb),0.6)" }}>
                    Tap Share → Add to Home Screen
                  </div>
                )}
              </div>
            </button>
          )}

          <button className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                  style={{ background: "rgba(232,98,26,0.06)", border: "1px solid rgba(232,98,26,0.15)" }}
                  onClick={async () => { await logout(); navigate("/login"); }}
                  data-testid="button-logout">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(232,98,26,0.1)" }}>
              <LogOut size={15} style={{ color: "var(--roam-ember)" }} />
            </div>
            <span className="text-sm font-medium" style={{ color: "var(--roam-ember)" }}>Sign out</span>
          </button>

          {/* Delete account */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            {!confirmDelete ? (
              <button className="flex items-center gap-2.5 font-mono text-[11px] tracking-wider transition-all w-full"
                      style={{ color: "rgba(var(--roam-ember-rgb),0.5)" }}
                      onClick={() => setConfirmDelete(true)} data-testid="button-delete-account-prompt">
                <Trash2 size={13} />
                Delete my account and all data
              </button>
            ) : (
              <div>
                <p className="font-mono text-[11px] leading-relaxed mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                  This permanently deletes your profile, photos, matches, and messages. Cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase font-semibold px-4 py-2.5 rounded-xl transition-all"
                          style={{ background: "var(--roam-ember)", color: "#fff", opacity: deleting ? 0.7 : 1 }}
                          onClick={handleDeleteAccount} disabled={deleting} data-testid="button-delete-account-confirm">
                    {deleting ? <><Loader2 size={11} className="animate-spin" /> Deleting…</> : <><Trash2 size={11} /> Yes, delete everything</>}
                  </button>
                  <button className="font-mono text-[10px] tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all"
                          style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.5)" }}
                          onClick={() => setConfirmDelete(false)} disabled={deleting} data-testid="button-delete-account-cancel">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </Sheet>

      {/* ── Year in adventure overlay ── */}
      {showYearCard && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: "var(--roam-forest)" }} data-testid="overlay-year-in-adventure">
          <div className="h-5" />
          <div className="mx-3.5 mb-8 rounded-[24px] overflow-hidden"
               style={{ background: "linear-gradient(160deg, var(--roam-moss) 0%, var(--roam-forest) 100%)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)", boxShadow: "0 16px 48px rgba(0,0,0,0.55)" }}>

            <div className="p-6 pb-5" style={{ background: "linear-gradient(135deg, rgba(var(--roam-electric-rgb),0.07), rgba(var(--roam-sky-rgb),0.04))", borderBottom: "1px solid rgba(var(--roam-electric-rgb),0.1)" }}>
              <div className="font-mono text-[10px] tracking-[2px] uppercase mb-1.5" style={{ color: "var(--roam-electric)" }}>🌍 Your 2025 in adventure</div>
              <div className="font-serif text-[30px] font-black leading-[1.05] mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.95)" }}>
                What a <span style={{ color: "var(--roam-electric)", fontStyle: "italic" }}>year</span><br />on the road.
              </div>
              <div className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                {profileData.name.toLowerCase().replace(/\s/g, "")} on roam.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[2px]" style={{ gridTemplateRows: "145px 145px", gridTemplateColumns: "1fr 1fr" }}>
              {PROFILE_PHOTOS.slice(0, 3).map((p, i) => (
                <div key={i} className={`relative overflow-hidden ${i === 0 ? "row-span-2" : ""}`} style={{ background: "var(--roam-moss)" }}>
                  <img src={p.url} alt={p.tags[0]} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-2 left-2">
                    <span className="font-mono text-[8px] tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                      📍 {p.tags[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2" style={{ gap: "1px", background: "rgba(var(--roam-cream-rgb),0.04)", marginTop: "2px" }}>
              {[
                { val: "47", label: "Adventures posted" },
                { val: "12", label: "Locations tagged" },
                { val: "3",  label: "Matches made" },
                { val: "1",  label: "Almost met" },
              ].map((s, i) => (
                <div key={i} className="p-4" style={{ background: "var(--roam-moss)" }}>
                  <div className="font-serif text-[28px] font-black leading-none mb-1" style={{ color: "var(--roam-electric)" }}>{s.val}</div>
                  <div className="font-mono text-[9px] tracking-[0.8px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3.5 p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.3)" }}>
                <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=96&q=80&fit=crop" alt="Top match" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[9px] tracking-[0.8px] uppercase mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>Top match of the year</div>
                <div className="text-[15px] font-semibold mb-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.92)" }}>Mia</div>
                <div className="text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>78% adventure overlap · Franz Josef almost-met</div>
              </div>
              <div className="font-serif text-[26px] font-black flex-shrink-0" style={{ color: "var(--roam-electric)" }}>78%</div>
            </div>

            <div className="flex items-start gap-3 p-5" style={{ background: "rgba(var(--roam-ember-rgb),0.06)", borderTop: "1px solid rgba(var(--roam-ember-rgb),0.14)" }}>
              <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "1px" }}>⚡</span>
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.68)" }}>
                <span style={{ color: "var(--roam-ember)", fontWeight: 600 }}>Almost met.</span>{" "}
                You and Mia were both at Milford Sound in November — 3 days apart.
              </p>
            </div>

            <div className="p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="font-mono text-[9px] tracking-[0.8px] uppercase mb-2.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>Places you adventured</div>
              <div className="flex flex-wrap gap-1.5">
                {["Milford Sound", "Raglan", "Franz Josef", "Abel Tasman", "Tongariro", "Coromandel", "Bay of Islands", "Fiordland"].map(p => (
                  <span key={p} className="font-mono text-[10px] px-2.5 py-1 rounded-xl"
                        style={{ background: "rgba(var(--roam-sky-rgb),0.08)", border: "1px solid rgba(var(--roam-sky-rgb),0.22)", color: "var(--roam-sky)" }}>
                    📍 {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <button onClick={() => setShowYearCard(false)}
                      className="flex flex-col items-start transition-opacity hover:opacity-70"
                      data-testid="button-close-year-logo">
                <div className="font-serif text-[20px] font-black tracking-tight leading-none" style={{ color: "rgba(var(--roam-cream-rgb),0.92)" }}>
                  roam<span style={{ color: "var(--roam-electric)" }}>.</span>
                </div>
                <div className="font-mono text-[8px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>← back to profile</div>
              </button>
              <button
                className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-wider px-4 py-2.5 rounded-xl transition-all hover:scale-105"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                onClick={async () => {
                  const text = `My 2025 in Adventure on roam. ⛰️\n47 adventures · 12 locations · 3 matches\nTop match: Mia (78% overlap)\nAlmost met at Milford Sound 👻\n\nroam.app`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    try { await navigator.share({ title: "My 2025 in Adventure", text }); } catch {}
                  } else {
                    navigator.clipboard?.writeText(text);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                data-testid="button-share-year">
                {shareCopied ? "✓ Copied!" : "📤 Share my year"}
              </button>
            </div>
          </div>

          <div className="px-3.5 py-5">
            <button onClick={() => setShowYearCard(false)}
                    className="w-full py-4 rounded-2xl font-mono text-[12px] tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                    data-testid="button-close-year-bottom">
              ← Back to profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
