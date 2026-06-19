import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Compass, MessageCircle, Plus, User, Palette, Check, Users, CalendarDays,
  Camera, X, ChevronRight, Tent, Ship, Mountain, Building2, ArrowRight, Megaphone, Zap,
  MessageSquarePlus, Send, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useConnectionStatus } from "@/lib/useConnectionStatus";
import { useTheme, THEMES } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/notification-bell";

const NAV_ITEMS = [
  { path: "/discover",  label: "Discover",    icon: Compass },
  { path: "/home",      label: "Dashboard",   icon: LayoutDashboard },
  { path: "/matches",   label: "Adventurers", icon: MessageCircle },
];

const QUICK_TYPES = [
  { id: "squad", label: "Squad", icon: <Tent size={13} />, range: "2–5", desc: "Tight-knit crew" },
  { id: "crew", label: "Crew", icon: <Ship size={13} />, range: "6–20", desc: "Social group" },
  { id: "community", label: "Community", icon: <Mountain size={13} />, range: "20–100", desc: "Open community" },
  { id: "organiser", label: "Organiser", icon: <Building2 size={13} />, range: "∞", desc: "Business / events" },
];

export default function AppNav() {
  const [location, navigate] = useLocation();
  const status = useConnectionStatus();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createView, setCreateView] = useState<"menu" | "group-picker" | "quick-create">("menu");
  const [quickForm, setQuickForm] = useState({ name: "", type: "" });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackHp, setFeedbackHp] = useState(""); // honeypot — must stay empty
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  const { data: ledGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/my-led"],
    enabled: !!user,
  });

  const { data: activeCheckins = [] } = useQuery<any[]>({
    queryKey: ["/api/safety/checkins"],
    enabled: !!user,
    select: (data: any[]) => data.filter((c: any) => !c.confirmed_at && !c.cancelled_at),
    refetchInterval: 60_000,
  });

  const { data: eligibility } = useQuery<{ eligible: boolean }>({
    queryKey: ["/api/groups/eligibility/check"],
    enabled: !!user,
  });

  const quickCreateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/groups", {
      name: quickForm.name.trim(),
      type: quickForm.type,
    }),
    onSuccess: async (res) => {
      const group = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my-led"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateOpen(false);
      setCreateView("menu");
      setQuickForm({ name: "", type: "" });
      toast({ description: `${group.name} created! Plan your first event.` });
      navigate(`/groups/${group.id}?tab=events`);
    },
    onError: (e: any) => toast({ variant: "destructive", description: e.message || "Could not create group" }),
  });

  const dotColor = status === "online" ? "var(--roam-electric)" : status === "offline" ? "var(--roam-ember)" : "#f59e0b";
  const dotTitle = status === "online" ? "Connected" : status === "offline" ? "Offline" : "Connecting…";

  const handleFeedbackSubmit = async () => {
    if (!feedbackMsg.trim() || feedbackSending) return;
    setFeedbackSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: feedbackMsg.trim(), page: location, company: feedbackHp }),
      });
      setFeedbackDone(true);
      setFeedbackMsg("");
      setTimeout(() => { setFeedbackDone(false); setFeedbackOpen(false); }, 2200);
    } catch {}
    finally { setFeedbackSending(false); }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false);
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
        setCreateView("menu");
        setFeedbackOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handlePlanEvent = () => {
    if (ledGroups.length === 1) {
      setCreateOpen(false);
      setCreateView("menu");
      navigate(`/groups/${ledGroups[0].id}?tab=events`);
    } else if (ledGroups.length > 1) {
      setCreateView("group-picker");
    } else if (eligibility?.eligible) {
      setCreateView("quick-create");
    } else {
      setCreateOpen(false);
      navigate("/groups");
    }
  };

  const planEventSubtitle =
    !user ? "Sign in first"
    : ledGroups.length === 1 ? ledGroups[0].name
    : ledGroups.length > 1 ? "Pick your group"
    : eligibility?.eligible ? "Quick-create a group"
    : "See requirements";

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl"
           style={{ background: `rgba(var(--roam-forest-rgb),0.78)`, borderBottom: `1px solid rgba(var(--roam-cream-rgb),0.08)` }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer flex items-start gap-1.5 flex-shrink-0">
              <div>
                <span className="font-serif text-[22px] font-black tracking-tight leading-none" style={{ color: "var(--roam-cream)" }}>roam</span>
                <span style={{ color: "var(--roam-electric)" }} className="font-serif text-[22px] font-black">.</span>
                <div className="font-mono text-[8px] tracking-[2px] uppercase" style={{ color: `rgba(var(--roam-cream-rgb),0.32)` }}>adventure matching</div>
              </div>
              {status !== "online" && (
                <div className="flex items-center gap-1 mt-0.5" title={dotTitle}>
                  <div className="w-1.5 h-1.5 rounded-full"
                       style={{ background: dotColor }} />
                  <span className="font-mono text-[8px] tracking-wider" style={{ color: dotColor }}>
                    {status === "offline" ? "offline" : "…"}
                  </span>
                </div>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-1">
            {user && <NotificationBell />}
            <div className="relative" ref={paletteRef}>
              <button className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: paletteOpen ? `rgba(var(--roam-electric-rgb),0.15)` : "transparent",
                        color: paletteOpen ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.38)`,
                        border: `1px solid ${paletteOpen ? `rgba(var(--roam-electric-rgb),0.35)` : "transparent"}`,
                      }}
                      onClick={() => setPaletteOpen(o => !o)}
                      aria-label="Switch colour palette"
                      data-testid="button-theme-switcher">
                <Palette size={14} />
              </button>

              {paletteOpen && (
                <div className="absolute right-0 top-10 rounded-2xl p-3 z-[60] min-w-[172px] animate-fade-up shadow-2xl"
                     style={{ background: "var(--roam-surface)", border: `1px solid rgba(var(--roam-cream-rgb),0.10)` }}
                     data-testid="palette-dropdown">
                  <p className="font-mono text-[8px] tracking-[1.5px] uppercase mb-2.5" style={{ color: `rgba(var(--roam-cream-rgb),0.62)` }}>Colour palette</p>
                  <div className="flex flex-col gap-1.5">
                    {THEMES.map(t => (
                      <button key={t.id}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all w-full text-left"
                              style={{
                                background: theme === t.id ? `rgba(var(--roam-electric-rgb),0.12)` : "transparent",
                                border: `1px solid ${theme === t.id ? `rgba(var(--roam-electric-rgb),0.3)` : "transparent"}`,
                              }}
                              onClick={() => { setTheme(t.id); setPaletteOpen(false); }}
                              data-testid={`theme-${t.id}`}>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="w-4 h-4 rounded-full border-2" style={{ background: t.swatch, borderColor: `rgba(var(--roam-cream-rgb),0.2)` }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: t.accentSwatch }} />
                        </div>
                        <span className="font-mono text-[10px] tracking-wider flex-1"
                              style={{ color: theme === t.id ? "var(--roam-electric)" : `rgba(var(--roam-cream-rgb),0.7)` }}>
                          {t.label}
                        </span>
                        {theme === t.id && <Check size={11} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {user && (
              <Link href="/profile">
                <button
                  title="Profile"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all overflow-hidden"
                  style={{
                    background: location === "/profile" ? "rgba(var(--roam-electric-rgb),0.15)" : "transparent",
                    border: `1px solid ${location === "/profile" ? "rgba(var(--roam-electric-rgb),0.5)" : "rgba(var(--roam-cream-rgb),0.14)"}`,
                    color: location === "/profile" ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)",
                  }}
                  data-testid="nav-profile">
                  {(user as any)?.avatarUrl
                    ? <img src={(user as any).avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    : <User size={14} />}
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Side nav */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50" ref={createRef} data-testid="side-nav">
        {/* Unified pill — all nav + utility + create icons in one background */}
        <div className="flex flex-col items-center py-3 px-2 rounded-2xl"
             style={{
               gap: "3px",
               background: "rgba(var(--roam-forest-rgb),0.92)",
               backdropFilter: "blur(20px)",
               WebkitBackdropFilter: "blur(20px)",
               border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
               boxShadow: "0 4px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
             }}>
          {NAV_ITEMS.map(item => {
            const active = location === item.path || (item.path === "/groups" && location.startsWith("/groups/"));
            return (
              <Link key={item.path} href={item.path}>
                <button title={item.label}
                        className="relative w-10 h-10 rounded-[14px] flex items-center justify-center transition-all"
                        style={{
                          background: active ? "rgba(var(--roam-electric-rgb),0.15)" : "transparent",
                          color: active ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.4)",
                        }}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <item.icon size={18} strokeWidth={1.8} />
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                         style={{ background: "var(--roam-electric)" }} />
                  )}
                </button>
              </Link>
            );
          })}
          <div style={{ width: 20, height: 1, background: "rgba(var(--roam-cream-rgb),0.12)", flexShrink: 0, margin: "1px 0" }} />
          <Link href="/plans">
            <button title="Plans & pricing"
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center transition-all"
                    style={{
                      background: location === "/plans" ? "rgba(var(--roam-electric-rgb),0.15)" : "transparent",
                      color: location === "/plans" ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.35)",
                    }}
                    data-testid="nav-plans">
              <Zap size={17} strokeWidth={1.8} />
            </button>
          </Link>
          {user && (
            <>
              <div style={{ width: 20, height: 1, background: "rgba(var(--roam-cream-rgb),0.12)", flexShrink: 0, margin: "1px 0" }} />
              <button
                title="Send feedback"
                onClick={() => { setFeedbackOpen(o => !o); if (feedbackDone) { setFeedbackDone(false); } }}
                className="w-10 h-10 rounded-[14px] flex items-center justify-center transition-all"
                style={{
                  background: feedbackOpen ? "rgba(var(--roam-electric-rgb),0.15)" : "transparent",
                  color: feedbackOpen ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.55)",
                }}
                data-testid="nav-feedback">
                <MessageSquarePlus size={17} strokeWidth={1.8} />
              </button>
            </>
          )}
          <div style={{ width: 20, height: 1, background: "rgba(var(--roam-cream-rgb),0.12)", flexShrink: 0, margin: "1px 0" }} />
          <button title="Create"
                  className="relative w-10 h-10 rounded-[14px] flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: createOpen ? "rgba(var(--roam-electric-rgb),0.8)" : "var(--roam-electric)",
                    boxShadow: "0 2px 12px rgba(var(--roam-electric-rgb),0.4)",
                  }}
                  onClick={() => { setCreateOpen(o => !o); if (createOpen) setCreateView("menu"); }}
                  data-testid="nav-post">
            {createOpen
              ? <X size={16} strokeWidth={2.5} style={{ color: "var(--roam-forest)" }} />
              : <Plus size={18} strokeWidth={2.5} style={{ color: "var(--roam-forest)" }} />}
            {!createOpen && activeCheckins.length > 0 && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full"
                   style={{ background: "#ef4444", boxShadow: "0 0 0 1.5px var(--roam-forest)" }} />
            )}
          </button>
        </div>
        {feedbackOpen && user && (
          <div className="absolute right-14 bottom-0 w-[272px] rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
               style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
            {feedbackDone ? (
              <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1.5px solid var(--roam-electric)" }}>
                  <CheckCircle2 size={20} style={{ color: "var(--roam-electric)" }} />
                </div>
                <div>
                  <p className="font-serif text-[15px] font-black" style={{ color: "var(--roam-cream)" }}>Feedback received</p>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                    Thank you, {user.name?.split(" ")[0] || "explorer"} 🙏
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3"
                     style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                  <div>
                    <p className="font-serif text-[15px] font-black" style={{ color: "var(--roam-cream)" }}>Share feedback</p>
                    <p className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>From {user.name}</p>
                  </div>
                  <button onClick={() => setFeedbackOpen(false)}
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }}
                          data-testid="button-close-feedback">
                    <X size={13} style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }} />
                  </button>
                </div>
                <div className="px-4 py-4">
                  <textarea
                    autoFocus
                    className="w-full rounded-2xl p-3 text-[12px] font-mono leading-relaxed resize-none outline-none"
                    style={{
                      background: "rgba(var(--roam-cream-rgb),0.05)",
                      border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
                      color: "var(--roam-cream)",
                      minHeight: "88px",
                    }}
                    placeholder="What's on your mind? Bugs, ideas, anything…"
                    value={feedbackMsg}
                    onChange={e => setFeedbackMsg(e.target.value)}
                    data-testid="input-feedback-message"
                  />
                  {/* Honeypot — hidden from real users, bots fill it and get silently dropped */}
                  <input
                    type="text"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={feedbackHp}
                    onChange={e => setFeedbackHp(e.target.value)}
                    style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                  />
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedbackMsg.trim() || feedbackSending}
                    className="w-full mt-3 py-2.5 rounded-2xl font-mono text-[11px] tracking-wider uppercase font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    data-testid="button-submit-feedback">
                    {feedbackSending ? (
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full"
                               style={{ background: "var(--roam-forest)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                        ))}
                      </div>
                    ) : (
                      <><Send size={12} /> Send feedback</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {createOpen && (
          <div className="absolute right-14 bottom-0 w-56 rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
               style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>

              {createView === "menu" && (
                <div className="p-1">
                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left hover:bg-white/5"
                          style={{ color: "var(--roam-cream)" }}
                          onClick={() => { setCreateOpen(false); navigate("/upload"); }}
                          data-testid="create-upload-photos">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                      <Camera size={15} style={{ color: "var(--roam-electric)" }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium leading-tight">Upload photos</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Share your adventure</div>
                    </div>
                  </button>

                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left hover:bg-white/5"
                          style={{ color: "var(--roam-cream)" }}
                          onClick={handlePlanEvent}
                          data-testid="create-plan-event">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                      <CalendarDays size={15} style={{ color: "var(--roam-electric)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-tight">Plan an event</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{planEventSubtitle}</div>
                    </div>
                    {ledGroups.length > 1 && <ChevronRight size={12} style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }} />}
                  </button>

                  <div className="mx-3 my-0.5 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.06)" }} />

                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left hover:bg-white/5"
                          style={{ color: "var(--roam-cream)" }}
                          onClick={() => { setCreateOpen(false); navigate("/advertise?mode=event"); }}
                          data-testid="create-promote-event">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-sky-rgb),0.12)" }}>
                      <Megaphone size={15} style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-tight">Promote an event</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Paid · public listing</div>
                    </div>
                  </button>

                  <div className="mx-3 my-0.5 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.06)" }} />

                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left hover:bg-white/5"
                          style={{ color: "var(--roam-cream)" }}
                          onClick={() => { setCreateOpen(false); navigate("/whats-on"); }}
                          data-testid="create-whats-on">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                      <CalendarDays size={15} style={{ color: "var(--roam-electric)" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-tight">What's on</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Events & communities near you</div>
                    </div>
                  </button>

                  <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left hover:bg-white/5"
                          style={{ color: "var(--roam-cream)" }}
                          onClick={() => { setCreateOpen(false); navigate("/safety"); }}
                          data-testid="create-safety">
                    <div className="relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                      <ShieldCheck size={15} style={{ color: "var(--roam-electric)" }} />
                      {activeCheckins.length > 0 && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                             style={{ background: "#ef4444", boxShadow: "0 0 0 1.5px var(--roam-surface)" }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-tight">Safety</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                        {activeCheckins.length > 0 ? `${activeCheckins.length} active check-in${activeCheckins.length > 1 ? "s" : ""}` : "Check-ins & safety net"}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {createView === "group-picker" && (
                <div className="p-1">
                  <div className="px-3 pt-2 pb-1">
                    <div className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Your groups</div>
                  </div>
                  {ledGroups.map((g: any) => (
                    <button key={g.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left hover:bg-white/5"
                            style={{ color: "var(--roam-cream)" }}
                            onClick={() => { setCreateOpen(false); setCreateView("menu"); navigate(`/groups/${g.id}?tab=events`); }}
                            data-testid={`create-pick-group-${g.id}`}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
                           style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
                        {g.name[0]}
                      </div>
                      <span className="text-[13px] font-medium">{g.name}</span>
                    </button>
                  ))}
                  <button className="w-full px-3 py-2 text-[10px] font-mono text-left hover:bg-white/5 rounded-xl"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}
                          onClick={() => setCreateView("menu")}>← Back</button>
                </div>
              )}

              {createView === "quick-create" && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>New group</div>
                    <button onClick={() => setCreateView("menu")} className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>← back</button>
                  </div>
                  <input
                    value={quickForm.name}
                    onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Group name"
                    maxLength={60}
                    className="w-full px-3 py-2.5 rounded-xl font-mono text-[12px] outline-none mb-2"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.85)" }}
                    data-testid="input-quick-group-name"
                  />
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {QUICK_TYPES.map(t => (
                      <button key={t.id}
                              onClick={() => setQuickForm(f => ({ ...f, type: t.id }))}
                              className="flex flex-col gap-0.5 px-2.5 py-2 rounded-xl text-left transition-all"
                              style={{
                                background: quickForm.type === t.id ? "rgba(var(--roam-electric-rgb),0.12)" : "rgba(var(--roam-cream-rgb),0.05)",
                                border: `1px solid ${quickForm.type === t.id ? "rgba(var(--roam-electric-rgb),0.35)" : "rgba(var(--roam-cream-rgb),0.08)"}`,
                              }}
                              data-testid={`quick-type-${t.id}`}>
                        <div className="flex items-center gap-1" style={{ color: quickForm.type === t.id ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.72)" }}>
                          {t.icon}
                          <span className="font-mono text-[10px] font-semibold">{t.label}</span>
                        </div>
                        <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>{t.desc}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => quickCreateMutation.mutate()}
                    disabled={!quickForm.name.trim() || !quickForm.type || quickCreateMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-[11px] font-semibold transition-all"
                    style={{
                      background: quickForm.name.trim() && quickForm.type ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.08)",
                      color: quickForm.name.trim() && quickForm.type ? "var(--roam-forest)" : "rgba(var(--roam-cream-rgb),0.55)",
                    }}
                    data-testid="button-quick-create-group">
                    {quickCreateMutation.isPending ? "Creating…" : <>Create & plan <ArrowRight size={12} /></>}
                  </button>
                </div>
              )}
            </div>
          )}
      </div>
    </>
  );
}
