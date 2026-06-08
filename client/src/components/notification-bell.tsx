import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bell, X } from "lucide-react";
import { useLocation } from "wouter";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: string | null;
  isRead: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function notifIcon(type: string) {
    switch (type) {
      case "match":             return "⚡";
      case "message":           return "💬";
      case "group_message":     return "💬";
      case "event_promotion":   return "🎟️";
      case "group_event":       return "📅";
      case "join_request":      return "🙋";
      case "join_approved":     return "✅";
      case "group_invite_accepted": return "🤝";
      case "group_invite":      return "✉️";
      case "group_broadcast":   return "📢";
      default:                  return "🔔";
    }
  }

  function handleNotifClick(notif: Notification) {
    if (!notif.isRead) markOneMutation.mutate(notif.id);
    setOpen(false);
    try {
      const d = notif.data ? JSON.parse(notif.data) : {};
      // Route based on notification type first, fall back to data fields
      if (notif.type === "match" || notif.type === "message") {
        navigate("/matches");
      } else if (notif.type === "group_event" && d.groupId) {
        navigate(`/groups/${d.groupId}?tab=events`);
      } else if (notif.type === "event_promotion" && d.groupId) {
        navigate(`/groups/${d.groupId}?tab=events`);
      } else if (notif.type === "event_promotion") {
        navigate("/whats-on");
      } else if (notif.type === "group_broadcast" && d.groupId) {
        navigate(`/groups/${d.groupId}?tab=campsite`);
      } else if (notif.type === "group_message" && d.groupId) {
        navigate(`/groups/${d.groupId}?tab=campsite`);
      } else if (d.groupId) {
        navigate(`/groups/${d.groupId}`);
      }
    } catch {}
  }

  const count = unread?.count ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); }}
        className="relative p-2 rounded-xl transition-all"
        style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}
        data-testid="button-notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold leading-none"
                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                data-testid="badge-unread-count">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-2xl z-50 shadow-2xl overflow-hidden"
             style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
          <div className="flex items-center justify-between px-4 py-3"
               style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--roam-cream)" }}>Notifications</span>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={() => markAllMutation.mutate()}
                        className="text-[11px] font-mono"
                        style={{ color: "rgba(var(--roam-electric-rgb),0.85)" }}
                        data-testid="button-mark-all-read">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}
                      style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="py-10 text-center text-sm" style={{ color: "rgba(var(--roam-cream-rgb),0.62)" }}>
                No notifications yet
              </div>
            )}
            {notifications.map(n => (
              <button key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full text-left px-4 py-3 transition-all"
                      style={{
                        background: n.isRead ? "transparent" : "rgba(var(--roam-electric-rgb),0.05)",
                        borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.05)",
                      }}
                      data-testid={`notif-${n.id}`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-[16px] flex-shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium leading-snug" style={{ color: "var(--roam-cream)" }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "rgba(var(--roam-cream-rgb),0.75)" }}>
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] mt-1 font-mono" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                         style={{ background: "var(--roam-electric)" }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
