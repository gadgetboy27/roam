import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { io as ioClient } from "socket.io-client";
import {
  ArrowLeft, MapPin, Users, Lock, Globe, Send, Calendar, Plus,
  Trash2, CheckCircle, XCircle, LogOut, Crown, UserPlus, CalendarPlus, Check, Megaphone,
  Mail, Copy, CheckCheck, Camera, Tag, MessageSquare,
} from "lucide-react";

function addToCalendar(ev: any, groupName: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const start = new Date(ev.startAt);
  const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//roam.//roam. Adventure App//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${ev.title}`,
    ev.location ? `LOCATION:${ev.location}` : null,
    ev.description ? `DESCRIPTION:${ev.description}` : null,
    `ORGANIZER;CN=${groupName}:MAILTO:noreply@letsroam.life`,
    `UID:${ev.id}@letsroam.life`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const GROUP_TYPE_LABEL: Record<string, string> = { squad: "Squad", crew: "Crew", community: "Community" };
const GROUP_TYPE_RANGE: Record<string, string> = { squad: "2–5", crew: "6–20", community: "20–100" };

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatDatetime(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function GroupEventCard({ ev, group, isLeader, isApproved, userId, deleteEventMutation }: {
  ev: any; group: any; isLeader: boolean; isApproved: boolean; userId?: string; deleteEventMutation: any;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: attendees = [] } = useQuery<any[]>({
    queryKey: ["/api/events", ev.id, "attendees"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${ev.id}/attendees`);
      return r.ok ? r.json() : [];
    },
  });
  const isRsvpd = !!userId && attendees.some((a: any) => a.userId === userId);

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      if (isRsvpd) return apiRequest("DELETE", `/api/events/${ev.id}/rsvp`);
      const res = await apiRequest("POST", `/api/events/${ev.id}/rsvp`);
      if (res.status === 402) {
        const data = await res.json();
        if (data.requiresTicket) {
          const ticketRes = await apiRequest("POST", `/api/events/${ev.id}/ticket/start`);
          const ticketData = await ticketRes.json();
          if (ticketData.url) { window.location.href = ticketData.url; return; }
        }
        throw new Error(data.error || "Payment required");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", ev.id, "attendees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/upcoming"] });
      if (!isRsvpd && !ev.ticketPriceNzd) toast({ description: "You're going! 🎉" });
      if (isRsvpd) toast({ description: "RSVP removed." });
    },
    onError: (err: any) => toast({ description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 rounded-2xl"
         style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="font-medium" style={{ color: "var(--roam-cream)" }}>{ev.title}</div>
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
            {formatDatetime(ev.startAt)}{ev.endAt ? ` → ${formatDatetime(ev.endAt)}` : ""}
          </div>
          {ev.location && (
            <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
              <MapPin size={10} /> {ev.location}
            </div>
          )}
          {ev.description && (
            <p className="text-[12px] mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>{ev.description}</p>
          )}
          {ev.ticketPriceNzd && (
            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg font-mono text-[9px]"
                 style={{ background: "rgba(var(--roam-ember-rgb),0.12)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)", color: "var(--roam-ember)" }}>
              🎟 ${(ev.ticketPriceNzd / 100 * 1.1).toFixed(2)} NZD entry
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => addToCalendar(ev, group.name)}
                  className="p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-mono"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)" }}
                  title="Add to calendar"
                  data-testid={`button-add-to-calendar-${ev.id}`}>
            <CalendarPlus size={13} />
          </button>
          {isLeader && (
            <button onClick={() => deleteEventMutation.mutate(ev.id)}
                    className="p-1.5 rounded-lg" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}
                    data-testid={`button-delete-event-${ev.id}`}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
        <div className="flex items-center gap-1.5">
          {attendees.length > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {attendees.slice(0, 3).map((a: any) => (
                  <div key={a.userId} className="w-5 h-5 rounded-full overflow-hidden border"
                       style={{ borderColor: "var(--roam-surface)" }}>
                    {a.avatarUrl
                      ? <img src={a.avatarUrl} alt={a.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold"
                             style={{ background: "rgba(var(--roam-electric-rgb),0.2)", color: "var(--roam-electric)" }}>
                          {a.name[0]}
                        </div>
                    }
                  </div>
                ))}
              </div>
              <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                {attendees.length} going
              </span>
            </>
          ) : (
            <span className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>No RSVPs yet</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLeader && (
            <button
              onClick={() => {
                const params = new URLSearchParams({
                  mode: "event",
                  title: ev.title,
                  desc: ev.description || "",
                  groupId: group.id,
                  eventId: ev.id,
                  groupName: group.name,
                });
                navigate(`/advertise?${params.toString()}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] tracking-wider font-medium transition-all"
              style={{ background: "rgba(var(--roam-sky-rgb),0.1)", color: "rgba(var(--roam-sky-rgb),0.8)", border: "1px solid rgba(var(--roam-sky-rgb),0.2)" }}
              data-testid={`button-promote-event-${ev.id}`}>
              <Megaphone size={10} />
              Promote
            </button>
          )}
          {isApproved && userId && (
            <button
              onClick={() => rsvpMutation.mutate()}
              disabled={rsvpMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] tracking-wider font-medium transition-all"
              style={isRsvpd
                ? { background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.35)" }
                : ev.ticketPriceNzd
                  ? { background: "rgba(var(--roam-ember-rgb),0.15)", color: "var(--roam-ember)", border: "1px solid rgba(var(--roam-ember-rgb),0.4)" }
                  : { background: "var(--roam-electric)", color: "var(--roam-forest)" }}
              data-testid={`button-rsvp-${ev.id}`}>
              {isRsvpd && <Check size={10} />}
              {rsvpMutation.isPending ? "…" : isRsvpd ? "Going ✓" : ev.ticketPriceNzd ? "🎟 Get Ticket" : "RSVP"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { toast } = useToast();
  const initialTab = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<"about" | "campsite" | "events">(
    initialTab === "events" ? "events" : initialTab === "campsite" ? "campsite" : "about"
  );
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const socketRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: group, isLoading } = useQuery<any>({
    queryKey: ["/api/groups", id],
    queryFn: async () => {
      const r = await fetch(`/api/groups/${id}`);
      if (!r.ok) throw new Error("Group not found");
      return r.json();
    },
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "members"],
    queryFn: async () => {
      const r = await fetch(`/api/groups/${id}/members`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const myMembership = members.find((m: any) => m.userId === user?.id);
  const isLeader = group?.leaderId === user?.id;
  const isApproved = myMembership?.status === "approved";

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "events"],
    queryFn: async () => {
      const r = await fetch(`/api/groups/${id}/events`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: tab === "events",
  });

  const { data: chatHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "messages"],
    queryFn: async () => {
      const r = await fetch(`/api/groups/${id}/messages`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: tab === "campsite" && !!myMembership,
  });
  const approvedMembers = members.filter((m: any) => m.status === "approved");
  const pendingMembers = members.filter((m: any) => m.status === "pending");

  useEffect(() => {
    if (chatHistory.length > 0) setLocalMessages(chatHistory);
  }, [chatHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, tab]);

  useEffect(() => {
    if (tab !== "campsite" || !isApproved || !user) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (cancelled) return;
      const socket = ioClient({ path: "/socket.io", auth: token ? { token } : undefined, transports: ["websocket", "polling"] });
      socketRef.current = socket;
      socket.emit("join_group", id);
      socket.on("new_group_message", (msg: any) => {
        setLocalMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev.filter(m => m.tempId !== msg.tempId), msg];
        });
      });
    })();
    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("leave_group", id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [tab, isApproved, id, user]);

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id] });
      toast({ title: group?.visibility === "open" ? "Joined!" : "Request sent to the leader" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] });
      toast({ title: "You've left the group" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/groups/${id}/members/${userId}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/groups/${id}/members/${userId}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/groups/${id}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] }),
  });

  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", description: "", location: "", startAt: "", endAt: "", ticketPriceNzd: "" });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [showConnections, setShowConnections] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Broadcast state
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastSelected, setBroadcastSelected] = useState<Set<string>>(new Set());

  // Member admin panel state
  const [manageOpen, setManageOpen] = useState(false);

  const createEventMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/events`, {
      ...eventForm,
      ticketPriceNzd: eventForm.ticketPriceNzd && parseFloat(eventForm.ticketPriceNzd) > 0 ? eventForm.ticketPriceNzd : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "events"] });
      setShowEventForm(false);
      setEventForm({ title: "", description: "", location: "", startAt: "", endAt: "", ticketPriceNzd: "" });
      toast({ title: "Event created!" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => apiRequest("DELETE", `/api/groups/${id}/events/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "events"] }),
  });

  const { data: groupInvites = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "invites"],
    enabled: isLeader && tab === "about",
    retry: false,
  });

  const sendInviteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/invites`, { email: inviteEmail, message: inviteMessage }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "invites"] });
      setInviteEmail("");
      setInviteMessage("");
      setShowInviteForm(false);
      if (data.inviteUrl) {
        navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
        toast({ title: "Invite sent!", description: process.env.RESEND_API_KEY ? "Email sent + link copied to clipboard" : "Invite link copied to clipboard" });
      } else {
        toast({ title: "Invite created!" });
      }
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  // Your matched connections you can pull straight into the group (no email).
  const { data: invitableConnections = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", id, "invitable-connections"],
    queryFn: async () => {
      const r = await fetch(`/api/groups/${id}/invitable-connections`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: showConnections,
  });

  const refreshGroupLists = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "invitable-connections"] });
  };
  const inviteConnectionMutation = useMutation({
    mutationFn: (targetUserId: string) => apiRequest("POST", `/api/groups/${id}/invite-connection`, { userId: targetUserId }),
    onSuccess: () => { refreshGroupLists(); toast({ title: "Added to your group!" }); },
    onError: (err: any) => {
      // "Already in this group" isn't a real failure — just refresh so they drop off the list.
      if (String(err?.message).includes("409") || /already in/i.test(err?.message || "")) {
        refreshGroupLists();
        toast({ title: "They're already in this group" });
      } else {
        toast({ title: err.message?.replace(/^\d+:\s*/, "") || "Couldn't add them", variant: "destructive" });
      }
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/groups/${id}/broadcast`, {
        message: broadcastText.trim(),
        recipientIds: Array.from(broadcastSelected),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to send");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setBroadcastOpen(false);
      setBroadcastText("");
      setBroadcastSelected(new Set());
      // Optimistically show the announcement in the campsite
      if (data.message) {
        setLocalMessages(prev => [...prev, { ...data.message, isAnnouncement: true }]);
      }
      toast({ title: `Announcement sent to ${data.recipientCount} member${data.recipientCount !== 1 ? "s" : ""}` });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function sendMessage() {
    if (!message.trim() || !user || !socketRef.current) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: null, tempId, groupId: id, senderId: user.id, content: message.trim(),
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    };
    setLocalMessages(prev => [...prev, optimistic]);
    socketRef.current.emit("send_group_message", { groupId: id, senderId: user.id, content: message.trim(), tempId });
    setMessage("");
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--roam-moss)",
    border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
    color: "var(--roam-cream)",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)" }}>
        <AppNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: "rgba(var(--roam-electric-rgb),0.6)", borderTopColor: "transparent" }} />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
        <AppNav />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>Group not found</p>
          <button onClick={() => navigate("/groups")} className="text-sm underline"
                  style={{ color: "var(--roam-electric)" }}>Back to Groups</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--roam-bg)", color: "var(--roam-cream)" }}>
      <AppNav />

      <div className="flex-1 flex flex-col overflow-hidden">
        {group.coverImageUrl ? (
          <div className="relative w-full h-40 flex-shrink-0">
            <img src={group.coverImageUrl} alt={group.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0"
                 style={{ background: "linear-gradient(to top,rgba(var(--roam-bg-rgb,14,20,15),0.9) 0%,transparent 60%)" }} />
            <button onClick={() => navigate("/groups")}
                    className="absolute top-4 left-4 p-2 rounded-full backdrop-blur-sm"
                    style={{ background: "rgba(0,0,0,0.45)" }}
                    data-testid="button-back">
              <ArrowLeft size={18} style={{ color: "white" }} />
            </button>
          </div>
        ) : (
          <div className="px-5 pt-4 flex items-center gap-3">
            <button onClick={() => navigate("/groups")} data-testid="button-back">
              <ArrowLeft size={20} style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }} />
            </button>
          </div>
        )}

        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-black" style={{ color: "var(--roam-cream)" }}>
                {group.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="text-[11px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                  {GROUP_TYPE_LABEL[group.type]} · {GROUP_TYPE_RANGE[group.type]}
                </span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.72)" }}>
                  {group.visibility === "closed" ? <Lock size={10} /> : <Globe size={10} />}
                  {group.visibility === "closed" ? "Closed" : "Open"}
                </span>
                {group.location && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                    <MapPin size={10} /> {group.location}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                  <Users size={10} /> {group.memberCount ?? 0} / {group.maxSize}
                </span>
              </div>
            </div>
            {user && !myMembership && (
              <button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending || (group.memberCount ?? 0) >= group.maxSize}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                data-testid="button-join-group"
              >
                <UserPlus size={14} />
                {(group.memberCount ?? 0) >= group.maxSize ? "Full" : group.visibility === "open" ? "Join" : "Request"}
              </button>
            )}
            {user && myMembership && !isLeader && (
              <button
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
                style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.6)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                data-testid="button-leave-group"
              >
                <LogOut size={14} /> Leave
              </button>
            )}
            {isLeader && (
              <span className="flex items-center gap-1 text-[11px] font-mono flex-shrink-0 mt-1"
                    style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                <Crown size={12} style={{ color: "rgba(var(--roam-electric-rgb),0.8)" }} /> leader
              </span>
            )}
          </div>

          <div className="flex gap-0 mt-4 border-b" style={{ borderColor: "rgba(var(--roam-cream-rgb),0.08)" }}>
            {(["about", "campsite", "events"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                      className="px-4 py-2 text-[12px] font-mono tracking-wider capitalize transition-all"
                      style={{
                        color: tab === t ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.65)",
                        borderBottom: tab === t ? "2px solid var(--roam-electric)" : "2px solid transparent",
                        marginBottom: "-1px",
                      }}
                      data-testid={`tab-${t}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "about" && (
            <div className="px-5 py-4 space-y-5">
              {group.description && (
                <p className="text-sm leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                  {group.description}
                </p>
              )}

              {(group.adventureTags ?? []).length > 0 && (
                <div>
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                    Adventure DNA
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(group.adventureTags as string[]).map(t => (
                      <span key={t} className="text-[11px] font-mono px-2.5 py-1 rounded-full"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "rgba(var(--roam-electric-rgb),0.8)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                    Members ({approvedMembers.length})
                  </div>
                  {isLeader && (
                    <button
                      onClick={() => setManageOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-semibold"
                      style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.75)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                      data-testid="button-manage-crew"
                    >
                      <Crown size={11} style={{ color: "rgba(var(--roam-electric-rgb),0.8)" }} /> Manage Crew
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {approvedMembers.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                      <div className="flex items-center gap-3">
                        {m.user?.avatarUrl ? (
                          <img src={m.user.avatarUrl} alt={m.user?.name ?? ""}
                               className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                               style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
                            {(m.user?.name ?? "?")[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Unknown"}</div>
                          {m.user?.location && (
                            <div className="text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>{m.user.location}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.role === "leader" && (
                          <Crown size={13} style={{ color: "rgba(var(--roam-electric-rgb),0.7)" }} />
                        )}
                        {isLeader && m.userId !== user?.id && (
                          <button onClick={() => removeMutation.mutate(m.userId)}
                                  className="p-1 rounded-lg transition-all"
                                  style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}
                                  data-testid={`button-remove-${m.userId}`}>
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isLeader && pendingMembers.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                    Pending requests ({pendingMembers.length})
                  </div>
                  <div className="space-y-2">
                    {pendingMembers.map((m: any) => {
                      const hasPhoto = !!m.user?.avatarUrl;
                      const hasTagline = !!m.user?.tagline;
                      const completedChecks = [hasPhoto, hasTagline].filter(Boolean).length;
                      return (
                        <div key={m.id} className="p-3 rounded-xl"
                             style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {m.user?.avatarUrl ? (
                                <img src={m.user.avatarUrl} alt={m.user?.name ?? ""} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                     style={{ background: "rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}>
                                  {(m.user?.name ?? "?")[0]}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Unknown"}</div>
                                <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                                  {completedChecks}/2 profile checks complete
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => approveMutation.mutate(m.userId)}
                                      className="p-1.5 rounded-lg" style={{ color: "var(--roam-electric)" }}
                                      data-testid={`button-approve-${m.userId}`}>
                                <CheckCircle size={18} />
                              </button>
                              <button onClick={() => rejectMutation.mutate(m.userId)}
                                      className="p-1.5 rounded-lg" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}
                                      data-testid={`button-reject-${m.userId}`}>
                                <XCircle size={18} />
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              {hasPhoto ? <Check size={9} style={{ color: "var(--roam-electric)" }} /> : <XCircle size={9} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
                              <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>photo</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {hasTagline ? <Check size={9} style={{ color: "var(--roam-electric)" }} /> : <XCircle size={9} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
                              <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>tagline</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isLeader && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                      Invite your connections
                    </div>
                    <button onClick={() => setShowConnections(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px]"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
                            data-testid="button-toggle-connections">
                      <UserPlus size={11} /> {showConnections ? "Close" : "Add people"}
                    </button>
                  </div>
                  {showConnections && (
                    <div className="rounded-2xl p-3 mb-3"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                      {invitableConnections.length === 0 ? (
                        <p className="font-mono text-[10px] text-center py-3 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                          No connections to add yet. Match with adventurers in Discover, then bring them into your crew here.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {invitableConnections.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl"
                                 style={{ background: "rgba(var(--roam-cream-rgb),0.03)" }}
                                 data-testid={`connection-row-${c.id}`}>
                              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "rgba(var(--roam-electric-rgb),0.1)" }}>
                                {c.avatarUrl
                                  ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><Users size={14} style={{ color: "var(--roam-electric)" }} /></div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-serif text-[13px] font-bold truncate" style={{ color: "var(--roam-cream)" }}>{c.name}</div>
                                {c.tagline && <div className="font-mono text-[9px] truncate" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>{c.tagline}</div>}
                              </div>
                              <button onClick={() => inviteConnectionMutation.mutate(c.id)}
                                      disabled={inviteConnectionMutation.isPending}
                                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[10px] font-semibold disabled:opacity-50"
                                      style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                                      data-testid={`button-add-connection-${c.id}`}>
                                <Plus size={11} /> Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                      Invite by email
                    </div>
                    <button onClick={() => setShowInviteForm(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px]"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
                            data-testid="button-toggle-invite-form">
                      <Mail size={11} /> {showInviteForm ? "Cancel" : "Send invite"}
                    </button>
                  </div>

                  {showInviteForm && (
                    <div className="rounded-2xl p-4 mb-3 space-y-3"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                      <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                             type="email" placeholder="their@email.com"
                             className="w-full px-3 py-2.5 rounded-xl font-mono text-[11px] outline-none"
                             style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                             data-testid="input-invite-email" />
                      <textarea value={inviteMessage} onChange={e => setInviteMessage(e.target.value)}
                                placeholder="Add a personal note… (optional)"
                                rows={2}
                                className="w-full px-3 py-2.5 rounded-xl font-mono text-[11px] outline-none resize-none"
                                style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                                data-testid="input-invite-message" />
                      <button onClick={() => sendInviteMutation.mutate()}
                              disabled={!inviteEmail.trim() || sendInviteMutation.isPending}
                              className="w-full py-2.5 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-2"
                              style={{ background: inviteEmail.trim() ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)", color: inviteEmail.trim() ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.58)" }}
                              data-testid="button-send-invite">
                        {sendInviteMutation.isPending ? "Sending…" : <><Mail size={12} /> Send invite &amp; copy link</>}
                      </button>
                    </div>
                  )}

                  {groupInvites.filter((i: any) => i.status === "pending").length > 0 && (
                    <div className="space-y-2">
                      {groupInvites.filter((i: any) => i.status === "pending").map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                             style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}
                             data-testid={`invite-row-${inv.id}`}>
                          <div>
                            <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.82)" }}>{inv.invitedEmail}</div>
                            <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>invited · pending response</div>
                          </div>
                          <button onClick={() => copyInviteLink(inv.token)}
                                  className="p-2 rounded-lg"
                                  style={{ color: copiedToken === inv.token ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.62)" }}
                                  data-testid={`button-copy-invite-${inv.id}`}>
                            {copiedToken === inv.token ? <CheckCheck size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "campsite" && (
            <div className="flex flex-col h-full">
              {!isApproved ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center">
                  <div className="text-3xl" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }}>🏕</div>
                  <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                    {myMembership?.status === "pending"
                      ? "Your join request is pending approval."
                      : "Join the group to access the campsite chat."}
                  </p>
                </div>
              ) : (
                <>
                  {isLeader && (
                    <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
                         style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                      <span className="font-mono text-[10px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                        {approvedMembers.length} members online
                      </span>
                      <button
                        onClick={() => {
                          setBroadcastSelected(new Set(approvedMembers.filter((m: any) => m.userId !== user?.id).map((m: any) => m.userId)));
                          setBroadcastOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-semibold transition-all"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.22)" }}
                        data-testid="button-broadcast"
                      >
                        <Megaphone size={12} /> Announce
                      </button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {localMessages.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                          No messages yet. Say hello to the crew!
                        </p>
                      </div>
                    )}
                    {localMessages.map((msg: any, i) => {
                      const isMe = msg.senderId === user?.id;
                      // Announcement banner (full-width, centred)
                      if (msg.isAnnouncement) {
                        return (
                          <div key={msg.id ?? msg.tempId ?? i} className="mx-2">
                            <div className="rounded-2xl px-4 py-3"
                                 style={{ background: "rgba(var(--roam-electric-rgb),0.08)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <Megaphone size={12} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
                                <span className="font-mono text-[10px] tracking-wider" style={{ color: "var(--roam-electric)" }}>
                                  ANNOUNCEMENT · {msg.sender?.name ?? "Leader"}
                                </span>
                              </div>
                              <p className="text-[13px] leading-relaxed" style={{ color: "var(--roam-cream)" }}>{msg.content}</p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id ?? msg.tempId ?? i} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden"
                                 style={{ background: "rgba(var(--roam-cream-rgb),0.1)" }}>
                              {msg.sender?.avatarUrl ? (
                                <img src={msg.sender.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold"
                                     style={{ color: "var(--roam-cream)" }}>
                                  {(msg.sender?.name ?? "?")[0]}
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                            {!isMe && msg.sender && (
                              <span className="text-[10px] font-mono px-1"
                                    style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                                {msg.sender.name}
                              </span>
                            )}
                            <div className="px-3 py-2 rounded-2xl text-[13px] leading-relaxed"
                                 style={{
                                   background: isMe ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.08)",
                                   color: isMe ? "var(--roam-bg)" : "var(--roam-cream)",
                                   opacity: msg.id === null ? 0.6 : 1,
                                 }}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="px-4 py-3 flex gap-2 flex-shrink-0"
                       style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Message the campsite…"
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                      data-testid="input-group-message"
                    />
                    <button onClick={sendMessage} disabled={!message.trim()}
                            className="p-2.5 rounded-xl flex-shrink-0 transition-opacity"
                            style={{ background: message.trim() ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.08)", color: message.trim() ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.55)" }}
                            data-testid="button-send-message">
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "events" && (
            <div className="px-5 py-4 space-y-4">
              {isLeader && (
                <div>
                  {!showEventForm ? (
                    <button onClick={() => setShowEventForm(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)", border: "1px dashed rgba(var(--roam-electric-rgb),0.3)" }}
                            data-testid="button-add-event">
                      <Plus size={15} /> Add event
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl space-y-3"
                         style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                      <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>New event</div>
                      {[
                        { key: "title", label: "Title *", type: "text", placeholder: "Event title" },
                        { key: "location", label: "Location", type: "text", placeholder: "Where?" },
                        { key: "startAt", label: "Starts *", type: "datetime-local", placeholder: "" },
                        { key: "endAt", label: "Ends", type: "datetime-local", placeholder: "" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-[11px] font-mono block mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{f.label}</label>
                          <input
                            type={f.type}
                            value={(eventForm as any)[f.key]}
                            onChange={e => setEventForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.14)", color: "var(--roam-cream)" }}
                            data-testid={`input-event-${f.key}`}
                          />
                        </div>
                      ))}
                      <textarea
                        value={eventForm.description}
                        onChange={e => setEventForm(ef => ({ ...ef, description: e.target.value }))}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                        style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.14)", color: "var(--roam-cream)" }}
                        data-testid="input-event-description"
                      />
                      <div>
                        <label className="text-[11px] font-mono block mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>Ticket price (NZD) — optional</label>
                        <input
                          type="number"
                          min="0"
                          step="0.50"
                          value={eventForm.ticketPriceNzd}
                          onChange={e => setEventForm(ef => ({ ...ef, ticketPriceNzd: e.target.value }))}
                          placeholder="0.00 — leave blank for free event"
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.14)", color: "var(--roam-cream)" }}
                          data-testid="input-event-ticketPrice"
                        />
                        {eventForm.ticketPriceNzd && parseFloat(eventForm.ticketPriceNzd) > 0 && (
                          <div className="mt-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[9px]"
                               style={{ background: "rgba(var(--roam-ember-rgb),0.07)", border: "1px solid rgba(var(--roam-ember-rgb),0.2)", color: "rgba(var(--roam-cream-rgb),0.75)" }}>
                            Attendees pay <span style={{ color: "var(--roam-cream)" }}>${(parseFloat(eventForm.ticketPriceNzd) * 1.10).toFixed(2)} NZD</span> — includes 10% roam. platform fee. You receive <span style={{ color: "var(--roam-cream)" }}>${parseFloat(eventForm.ticketPriceNzd).toFixed(2)} NZD</span> per ticket.
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowEventForm(false)}
                                className="flex-1 py-2 rounded-xl text-sm"
                                style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.75)" }}>
                          Cancel
                        </button>
                        <button onClick={() => createEventMutation.mutate()}
                                disabled={createEventMutation.isPending || !eventForm.title || !eventForm.startAt}
                                className="flex-1 py-2 rounded-xl text-sm font-medium"
                                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                                data-testid="button-save-event">
                          {createEventMutation.isPending ? "Saving…" : "Create event"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {events.length === 0 && (
                <div className="text-center py-10">
                  <Calendar size={28} className="mx-auto mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }} />
                  <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>No events planned yet.</p>
                </div>
              )}

              {events.map((ev: any) => (
                <GroupEventCard key={ev.id} ev={ev} group={group} isLeader={isLeader} isApproved={isApproved} userId={user?.id} deleteEventMutation={deleteEventMutation} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Broadcast / Announcement Modal ──────────────────────────────── */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--roam-bg)" }}>
          <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
               style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
            <button onClick={() => setBroadcastOpen(false)} data-testid="button-close-broadcast">
              <ArrowLeft size={20} style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }} />
            </button>
            <div className="flex-1">
              <h2 className="font-serif text-lg font-black" style={{ color: "var(--roam-cream)" }}>Send Announcement</h2>
              <p className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                Pins in the campsite + sends notification to selected members
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                Your message
              </div>
              <textarea
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder="Hey crew — reminder about Sunday's hike. Meet at 7am at the carpark…"
                rows={4}
                className="w-full px-4 py-3 rounded-2xl text-[13px] leading-relaxed outline-none resize-none"
                style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                data-testid="input-broadcast-text"
                autoFocus
              />
              <div className="text-right font-mono text-[10px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                {broadcastText.length} chars
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                  Recipients ({broadcastSelected.size})
                </div>
                <button
                  onClick={() => {
                    const others = approvedMembers.filter((m: any) => m.userId !== user?.id).map((m: any) => m.userId);
                    if (broadcastSelected.size === others.length) {
                      setBroadcastSelected(new Set());
                    } else {
                      setBroadcastSelected(new Set(others));
                    }
                  }}
                  className="font-mono text-[10px]"
                  style={{ color: "var(--roam-electric)" }}
                  data-testid="button-select-all-recipients"
                >
                  {broadcastSelected.size === approvedMembers.filter((m: any) => m.userId !== user?.id).length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="space-y-2">
                {approvedMembers.filter((m: any) => m.userId !== user?.id).map((m: any) => {
                  const selected = broadcastSelected.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      onClick={() => {
                        setBroadcastSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(m.userId)) next.delete(m.userId); else next.add(m.userId);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                      style={{
                        background: selected ? "rgba(var(--roam-electric-rgb),0.08)" : "rgba(var(--roam-cream-rgb),0.04)",
                        border: `1px solid ${selected ? "rgba(var(--roam-electric-rgb),0.25)" : "rgba(var(--roam-cream-rgb),0.06)"}`,
                      }}
                      data-testid={`checkbox-recipient-${m.userId}`}
                    >
                      {m.user?.avatarUrl ? (
                        <img src={m.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                             style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
                          {(m.user?.name ?? "?")[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Member"}</div>
                        {m.user?.location && (
                          <div className="text-[10px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>{m.user.location}</div>
                        )}
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                           style={{ borderColor: selected ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.3)", background: selected ? "var(--roam-electric)" : "transparent" }}>
                        {selected && <Check size={11} style={{ color: "var(--roam-bg)" }} />}
                      </div>
                    </button>
                  );
                })}
                {approvedMembers.filter((m: any) => m.userId !== user?.id).length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                    No other approved members yet
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
            <button
              onClick={() => broadcastMutation.mutate()}
              disabled={!broadcastText.trim() || broadcastSelected.size === 0 || broadcastMutation.isPending}
              className="w-full py-3.5 rounded-2xl font-mono text-[13px] font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: broadcastText.trim() && broadcastSelected.size > 0 ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.06)",
                color: broadcastText.trim() && broadcastSelected.size > 0 ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.45)",
              }}
              data-testid="button-send-broadcast"
            >
              <Megaphone size={14} />
              {broadcastMutation.isPending ? "Sending…" : `Send to ${broadcastSelected.size} member${broadcastSelected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Member Admin Panel ───────────────────────────────────────────── */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--roam-bg)" }}>
          <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
               style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
            <button onClick={() => setManageOpen(false)} data-testid="button-close-manage">
              <ArrowLeft size={20} style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }} />
            </button>
            <div>
              <h2 className="font-serif text-lg font-black" style={{ color: "var(--roam-cream)" }}>Manage Crew</h2>
              <p className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                {approvedMembers.length} approved · {pendingMembers.length} pending
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {pendingMembers.length > 0 && (
              <div>
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3 flex items-center gap-2"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                  Pending requests
                  <span className="px-1.5 py-0.5 rounded-full text-[9px]"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
                    {pendingMembers.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingMembers.map((m: any) => {
                    const hasPhoto = !!m.user?.avatarUrl;
                    const hasTagline = !!m.user?.tagline;
                    return (
                      <div key={m.id} className="p-4 rounded-2xl"
                           style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
                        <div className="flex items-center gap-3 mb-3">
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                                 style={{ background: "rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}>
                              {(m.user?.name ?? "?")[0]}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Unknown"}</div>
                            {m.user?.location && (
                              <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{m.user.location}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 text-[10px] font-mono mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                          <span className="flex items-center gap-1">
                            {hasPhoto ? <Check size={9} style={{ color: "var(--roam-electric)" }} /> : <XCircle size={9} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
                            photo
                          </span>
                          <span className="flex items-center gap-1">
                            {hasTagline ? <Check size={9} style={{ color: "var(--roam-electric)" }} /> : <XCircle size={9} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
                            tagline
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMutation.mutate(m.userId)}
                            disabled={approveMutation.isPending}
                            className="flex-1 py-2 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}
                            data-testid={`button-approve-admin-${m.userId}`}
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(m.userId)}
                            disabled={rejectMutation.isPending}
                            className="flex-1 py-2 rounded-xl font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5"
                            style={{ background: "rgba(var(--roam-cream-rgb),0.05)", color: "rgba(var(--roam-cream-rgb),0.7)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
                            data-testid={`button-reject-admin-${m.userId}`}
                          >
                            <XCircle size={13} /> Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingMembers.length === 0 && (
              <div className="rounded-2xl px-4 py-3"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.05)", border: "1px solid rgba(var(--roam-electric-rgb),0.1)" }}>
                <p className="text-[12px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                  No pending requests
                </p>
              </div>
            )}

            <div>
              <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                Approved members
              </div>
              <div className="space-y-2">
                {approvedMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                       style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                    {m.user?.avatarUrl ? (
                      <img src={m.user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                           style={{ background: "rgba(var(--roam-electric-rgb),0.15)", color: "var(--roam-electric)" }}>
                        {(m.user?.name ?? "?")[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Member"}</div>
                      {m.user?.location && (
                        <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.58)" }}>{m.user.location}</div>
                      )}
                    </div>
                    {m.role === "leader" ? (
                      <span className="flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded-full"
                            style={{ background: "rgba(var(--roam-electric-rgb),0.1)", color: "var(--roam-electric)" }}>
                        <Crown size={9} /> Leader
                      </span>
                    ) : (
                      <button
                        onClick={() => removeMutation.mutate(m.userId)}
                        disabled={removeMutation.isPending}
                        className="p-2 rounded-lg transition-all"
                        style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}
                        data-testid={`button-remove-admin-${m.userId}`}
                        title="Remove member"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
