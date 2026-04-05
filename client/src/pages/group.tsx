import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { io as ioClient } from "socket.io-client";
import {
  ArrowLeft, MapPin, Users, Lock, Globe, Send, Calendar, Plus,
  Trash2, CheckCircle, XCircle, LogOut, Crown, UserPlus, CalendarPlus,
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
    `ORGANIZER;CN=${groupName}:MAILTO:noreply@roam.app`,
    `UID:${ev.id}@roam.app`,
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

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"about" | "campsite" | "events">("about");
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

  const myMembership = members.find((m: any) => m.userId === user?.id);
  const isLeader = group?.leaderId === user?.id;
  const isApproved = myMembership?.status === "approved";
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
    const socket = ioClient({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.emit("join_group", id);
    socket.on("new_group_message", (msg: any) => {
      setLocalMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev.filter(m => m.tempId !== msg.tempId), msg];
      });
    });
    return () => {
      socket.emit("leave_group", id);
      socket.disconnect();
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
  const [eventForm, setEventForm] = useState({ title: "", description: "", location: "", startAt: "", endAt: "" });

  const createEventMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${id}/events`, eventForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "events"] });
      setShowEventForm(false);
      setEventForm({ title: "", description: "", location: "", startAt: "", endAt: "" });
      toast({ title: "Event created!" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => apiRequest("DELETE", `/api/groups/${id}/events/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", id, "events"] }),
  });

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
                <span className="text-[11px] font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  {GROUP_TYPE_LABEL[group.type]} · {GROUP_TYPE_RANGE[group.type]}
                </span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  {group.visibility === "closed" ? <Lock size={10} /> : <Globe size={10} />}
                  {group.visibility === "closed" ? "Closed" : "Open"}
                </span>
                {group.location && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                    <MapPin size={10} /> {group.location}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
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
                    style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                <Crown size={12} style={{ color: "rgba(var(--roam-electric-rgb),0.8)" }} /> leader
              </span>
            )}
          </div>

          <div className="flex gap-0 mt-4 border-b" style={{ borderColor: "rgba(var(--roam-cream-rgb),0.08)" }}>
            {(["about", "campsite", "events"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                      className="px-4 py-2 text-[12px] font-mono tracking-wider capitalize transition-all"
                      style={{
                        color: tab === t ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.4)",
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
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
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
                <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  Members ({approvedMembers.length})
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
                            <div className="text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>{m.user.location}</div>
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
                                  style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
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
                  <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                    Pending requests ({pendingMembers.length})
                  </div>
                  <div className="space-y-2">
                    {pendingMembers.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl"
                           style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                        <div className="flex items-center gap-3">
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt={m.user?.name ?? ""} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                 style={{ background: "rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}>
                              {(m.user?.name ?? "?")[0]}
                            </div>
                          )}
                          <div className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>{m.user?.name ?? "Unknown"}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveMutation.mutate(m.userId)}
                                  className="p-1.5 rounded-lg" style={{ color: "var(--roam-electric)" }}
                                  data-testid={`button-approve-${m.userId}`}>
                            <CheckCircle size={18} />
                          </button>
                          <button onClick={() => rejectMutation.mutate(m.userId)}
                                  className="p-1.5 rounded-lg" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}
                                  data-testid={`button-reject-${m.userId}`}>
                            <XCircle size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "campsite" && (
            <div className="flex flex-col h-full">
              {!isApproved ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center">
                  <div className="text-3xl" style={{ color: "rgba(var(--roam-cream-rgb),0.12)" }}>🏕</div>
                  <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                    {myMembership?.status === "pending"
                      ? "Your join request is pending approval."
                      : "Join the group to access the campsite chat."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {localMessages.length === 0 && (
                      <div className="text-center py-10">
                        <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                          No messages yet. Say hello to the crew!
                        </p>
                      </div>
                    )}
                    {localMessages.map((msg: any, i) => {
                      const isMe = msg.senderId === user?.id;
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
                                    style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
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
                            style={{ background: message.trim() ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.08)", color: message.trim() ? "var(--roam-bg)" : "rgba(var(--roam-cream-rgb),0.3)" }}
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
                      <div className="font-mono text-[10px] tracking-[1.5px] uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>New event</div>
                      {[
                        { key: "title", label: "Title *", type: "text", placeholder: "Event title" },
                        { key: "location", label: "Location", type: "text", placeholder: "Where?" },
                        { key: "startAt", label: "Starts *", type: "datetime-local", placeholder: "" },
                        { key: "endAt", label: "Ends", type: "datetime-local", placeholder: "" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-[11px] font-mono block mb-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>{f.label}</label>
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
                      <div className="flex gap-2">
                        <button onClick={() => setShowEventForm(false)}
                                className="flex-1 py-2 rounded-xl text-sm"
                                style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.5)" }}>
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
                  <p className="text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>No events planned yet.</p>
                </div>
              )}

              {events.map((ev: any) => (
                <div key={ev.id} className="p-4 rounded-2xl"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium" style={{ color: "var(--roam-cream)" }}>{ev.title}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                        {formatDatetime(ev.startAt)}{ev.endAt ? ` → ${formatDatetime(ev.endAt)}` : ""}
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                          <MapPin size={10} /> {ev.location}
                        </div>
                      )}
                      {ev.description && (
                        <p className="text-[12px] mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>{ev.description}</p>
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
                                className="p-1.5 rounded-lg" style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
                                data-testid={`button-delete-event-${ev.id}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
