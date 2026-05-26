import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Plus, X, MapPin, Clock, CheckCircle2, AlertTriangle, UserCheck, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AppNav from "@/components/app-nav";
import { useAuth } from "@/lib/auth";

interface Contact {
  id: string;
  name: string;
  avatar_url?: string;
  identity_verified?: boolean;
}

interface Checkin {
  id: string;
  scheduled_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
  place?: string;
  meeting_with?: string;
  alert_level: number;
  created_at: string;
}

function Avatar({ contact }: { contact: Contact }) {
  if (contact.avatar_url) {
    return (
      <img src={contact.avatar_url} alt={contact.name}
           className="w-10 h-10 rounded-full object-cover flex-shrink-0"
           style={{ border: "2px solid rgba(var(--roam-cream-rgb),0.1)" }} />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-serif font-black text-[14px]"
         style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
      {contact.name[0]}
    </div>
  );
}

function formatScheduled(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = (d.getTime() - now.getTime()) / 60000;
  if (diffMins < -60) return d.toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" });
  if (diffMins < 0) return `${Math.abs(Math.round(diffMins))} min ago`;
  if (diffMins < 60) return `in ${Math.round(diffMins)} min`;
  if (diffMins < 1440) return `at ${d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" });
}

export default function Safety() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sosConfirm, setSosConfirm] = useState(false);
  const [sosPlace, setSosPlace] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ place: "", meetingWith: "", time: "" });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/safety/contacts"],
    enabled: !!user,
  });

  const { data: eligible = [] } = useQuery<Contact[]>({
    queryKey: ["/api/safety/eligible-contacts"],
    enabled: showAddContact && !!user,
  });

  const { data: checkins = [] } = useQuery<Checkin[]>({
    queryKey: ["/api/safety/checkins"],
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const addContact = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/safety/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/safety/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/safety/eligible-contacts"] });
    },
  });

  const removeContact = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/safety/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/safety/contacts"] }),
  });

  const sosMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/safety/alert", { place: sosPlace.trim() || undefined }),
    onSuccess: () => { setSosConfirm(false); setSosPlace(""); },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => {
      const dt = new Date(scheduleForm.time);
      return apiRequest("POST", "/api/safety/checkin", {
        scheduledAt: dt.toISOString(),
        place: scheduleForm.place.trim() || undefined,
        meetingWith: scheduleForm.meetingWith.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/safety/checkins"] });
      setShowSchedule(false);
      setScheduleForm({ place: "", meetingWith: "", time: "" });
    },
  });

  const confirmCheckin = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/safety/checkin/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/safety/checkins"] }),
  });

  const cancelCheckin = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/safety/checkin/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/safety/checkins"] }),
  });

  const activeCheckins = checkins.filter(c => !c.confirmed_at && !c.cancelled_at);
  const pastCheckins = checkins.filter(c => c.confirmed_at || c.cancelled_at).slice(0, 5);

  const minTime = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen" style={{ background: "var(--roam-forest)" }}>
      <AppNav />
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
            <ShieldCheck size={28} style={{ color: "var(--roam-electric)" }} />
          </div>
          <h1 className="font-serif text-[24px] font-black mb-1" style={{ color: "var(--roam-cream)" }}>
            Safety net
          </h1>
          <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
            Set up contacts & check-ins so someone always knows where you are
          </p>
        </div>

        {/* SOS Button */}
        {!sosConfirm ? (
          <button
            onClick={() => setSosConfirm(true)}
            className="w-full py-5 rounded-3xl mb-6 flex items-center justify-center gap-3 transition-all active:scale-98"
            style={{
              background: "rgba(220,38,38,0.12)",
              border: "1.5px solid rgba(220,38,38,0.45)",
            }}>
            <ShieldAlert size={22} style={{ color: "#ef4444" }} />
            <div className="text-left">
              <div className="font-mono text-[13px] font-bold tracking-wide" style={{ color: "#ef4444" }}>Emergency Alert</div>
              <div className="font-mono text-[10px]" style={{ color: "rgba(239,68,68,0.6)" }}>
                Alerts all your safety contacts immediately
              </div>
            </div>
          </button>
        ) : (
          <div className="rounded-3xl mb-6 overflow-hidden"
               style={{ background: "rgba(220,38,38,0.1)", border: "1.5px solid rgba(220,38,38,0.5)" }}>
            <div className="px-5 pt-5 pb-3">
              <div className="font-mono text-[12px] font-bold mb-2" style={{ color: "#ef4444" }}>
                Confirm emergency alert
              </div>
              <p className="font-mono text-[10px] mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                All {contacts.length} safety contact{contacts.length !== 1 ? "s" : ""} will be notified immediately with your name and location.
              </p>
              <input
                value={sosPlace}
                onChange={e => setSosPlace(e.target.value)}
                placeholder="Your current location (optional)"
                className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none mb-3"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "var(--roam-cream)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => sosMutation.mutate()}
                  disabled={sosMutation.isPending || contacts.length === 0}
                  className="flex-1 py-3 rounded-2xl font-mono text-[11px] font-bold tracking-wider uppercase disabled:opacity-40"
                  style={{ background: "#dc2626", color: "#fff" }}>
                  {sosMutation.isPending ? "Sending…" : contacts.length === 0 ? "No contacts set" : "Send Alert Now"}
                </button>
                <button
                  onClick={() => { setSosConfirm(false); setSosPlace(""); }}
                  className="px-4 py-3 rounded-2xl font-mono text-[11px]"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.07)", color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                  Cancel
                </button>
              </div>
              {sosMutation.isSuccess && (
                <p className="font-mono text-[10px] mt-2 text-center" style={{ color: "var(--roam-electric)" }}>
                  Alert sent to {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active check-ins */}
        {activeCheckins.length > 0 && (
          <div className="mb-6">
            <div className="font-mono text-[10px] tracking-wider uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              Active check-ins
            </div>
            <div className="space-y-3">
              {activeCheckins.map(c => {
                const isOverdue = new Date(c.scheduled_at) < new Date();
                const isUrgent = c.alert_level >= 1;
                return (
                  <div key={c.id} className="rounded-3xl overflow-hidden"
                       style={{
                         background: isUrgent ? "rgba(220,38,38,0.08)" : "var(--roam-surface)",
                         border: `1px solid ${isUrgent ? "rgba(220,38,38,0.35)" : "rgba(var(--roam-cream-rgb),0.1)"}`,
                       }}>
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock size={13} style={{ color: isUrgent ? "#ef4444" : "var(--roam-electric)", flexShrink: 0 }} />
                            <span className="font-mono text-[12px] font-semibold"
                                  style={{ color: isUrgent ? "#ef4444" : "var(--roam-cream)" }}>
                              {formatScheduled(c.scheduled_at)}
                            </span>
                            {isUrgent && (
                              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full font-bold"
                                    style={{ background: "rgba(220,38,38,0.15)", color: "#ef4444" }}>
                                {c.alert_level >= 2 ? "URGENT" : "MISSED"}
                              </span>
                            )}
                          </div>
                          {c.place && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={11} style={{ color: "rgba(var(--roam-cream-rgb),0.4)", flexShrink: 0 }} />
                              <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{c.place}</span>
                            </div>
                          )}
                          {c.meeting_with && (
                            <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                              With: {c.meeting_with}
                            </div>
                          )}
                        </div>
                        <button onClick={() => cancelCheckin.mutate(c.id)}
                                className="p-1.5 rounded-xl transition-opacity hover:opacity-60">
                          <X size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} />
                        </button>
                      </div>
                      <button
                        onClick={() => confirmCheckin.mutate(c.id)}
                        disabled={confirmCheckin.isPending}
                        className="w-full py-3 rounded-2xl font-mono text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                        style={{ background: "rgba(var(--roam-electric-rgb),0.15)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}>
                        <CheckCircle2 size={15} />
                        I'm safe — check in
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Schedule check-in */}
        <div className="rounded-3xl mb-6 overflow-hidden"
             style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
          <button
            onClick={() => setShowSchedule(s => !s)}
            className="w-full px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={16} style={{ color: "var(--roam-electric)" }} />
              <div className="text-left">
                <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>Schedule a check-in</div>
                <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Set a time — we'll alert your contacts if you miss it
                </div>
              </div>
            </div>
            {showSchedule
              ? <ChevronUp size={15} style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }} />
              : <ChevronDown size={15} style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }} />}
          </button>
          {showSchedule && (
            <div className="px-5 pb-5 space-y-3">
              <div className="h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.07)" }} />
              <div>
                <label className="font-mono text-[10px] tracking-wider uppercase mb-1.5 block" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Check-in time *
                </label>
                <input
                  type="datetime-local"
                  min={minTime}
                  value={scheduleForm.time}
                  onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none"
                  style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)", colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-wider uppercase mb-1.5 block" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Location
                </label>
                <input
                  value={scheduleForm.place}
                  onChange={e => setScheduleForm(f => ({ ...f, place: e.target.value }))}
                  placeholder="e.g. Mount Maunganui beach"
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none"
                  style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-wider uppercase mb-1.5 block" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  Meeting with
                </label>
                <input
                  value={scheduleForm.meetingWith}
                  onChange={e => setScheduleForm(f => ({ ...f, meetingWith: e.target.value }))}
                  placeholder="e.g. James from roam."
                  className="w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none"
                  style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                />
              </div>
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.12)" }}>
                <p className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                  If you miss this check-in, your contacts get an alert at +15 min, and an urgent alert at +45 min. Time, date, and location are logged in case they're ever needed.
                </p>
              </div>
              <button
                onClick={() => scheduleMutation.mutate()}
                disabled={!scheduleForm.time || scheduleMutation.isPending}
                className="w-full py-3.5 rounded-2xl font-mono text-[12px] font-bold tracking-wider uppercase disabled:opacity-40"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                {scheduleMutation.isPending ? "Scheduling…" : "Schedule check-in"}
              </button>
              {scheduleMutation.isError && (
                <p className="font-mono text-[10px] text-center" style={{ color: "#ef4444" }}>
                  {(scheduleMutation.error as any)?.message || "Could not schedule — time must be in the future"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Safety contacts */}
        <div className="rounded-3xl overflow-hidden mb-6"
             style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
          <div className="px-5 pt-5 pb-4 flex items-center justify-between"
               style={{ borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
            <div>
              <div className="font-mono text-[13px] font-semibold" style={{ color: "var(--roam-cream)" }}>Safety contacts</div>
              <div className="font-mono text-[10px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                {contacts.length === 0 ? "Add people to alert when you need help" : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} — notified on SOS or missed check-in`}
              </div>
            </div>
            <button
              onClick={() => setShowAddContact(s => !s)}
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all"
              style={{
                background: showAddContact ? "rgba(var(--roam-electric-rgb),0.15)" : "rgba(var(--roam-cream-rgb),0.06)",
                border: `1px solid ${showAddContact ? "rgba(var(--roam-electric-rgb),0.3)" : "rgba(var(--roam-cream-rgb),0.1)"}`,
                color: showAddContact ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)",
              }}>
              {showAddContact ? <X size={14} /> : <Plus size={14} />}
            </button>
          </div>

          {contactsLoading && (
            <div className="px-5 py-4 font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Loading…</div>
          )}

          {contacts.length > 0 && (
            <div className="px-3 py-3 space-y-1">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-2 py-2.5 rounded-2xl"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.03)" }}>
                  <Avatar contact={c} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[13px] font-semibold truncate" style={{ color: "var(--roam-cream)" }}>{c.name}</div>
                    {c.identity_verified && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck size={10} style={{ color: "var(--roam-electric)" }} />
                        <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-electric-rgb),0.8)" }}>ID verified</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeContact.mutate(c.id)}
                    className="p-1.5 rounded-xl transition-opacity hover:opacity-60">
                    <X size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {contacts.length === 0 && !contactsLoading && !showAddContact && (
            <div className="px-5 py-5 text-center">
              <p className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                No safety contacts yet. Add from your matches or squad.
              </p>
            </div>
          )}

          {showAddContact && (
            <div className="px-3 pb-3 pt-2">
              <p className="font-mono text-[10px] px-2 mb-2" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                From your matches & squad members
              </p>
              {eligible.length === 0 && (
                <p className="font-mono text-[11px] px-2 py-3 text-center" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
                  No eligible contacts yet — match with people or join a squad first.
                </p>
              )}
              <div className="space-y-1">
                {eligible.map(c => (
                  <button
                    key={c.id}
                    onClick={() => addContact.mutate(c.id)}
                    disabled={addContact.isPending}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl transition-all text-left"
                    style={{ background: "rgba(var(--roam-cream-rgb),0.03)" }}>
                    <Avatar contact={c} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[13px] font-semibold truncate" style={{ color: "var(--roam-cream)" }}>{c.name}</div>
                      {c.identity_verified && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <UserCheck size={10} style={{ color: "var(--roam-electric)" }} />
                          <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-electric-rgb),0.8)" }}>ID verified</span>
                        </div>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
                      <Plus size={13} style={{ color: "var(--roam-electric)" }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Past check-ins log */}
        {pastCheckins.length > 0 && (
          <div className="mb-4">
            <div className="font-mono text-[10px] tracking-wider uppercase mb-3" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
              Recent check-in log
            </div>
            <div className="space-y-2">
              {pastCheckins.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                     style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{
                         background: c.confirmed_at ? "rgba(var(--roam-electric-rgb),0.1)" : "rgba(220,38,38,0.1)",
                       }}>
                    {c.confirmed_at
                      ? <CheckCircle2 size={13} style={{ color: "var(--roam-electric)" }} />
                      : <AlertTriangle size={13} style={{ color: "#ef4444" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-semibold" style={{ color: "var(--roam-cream)" }}>
                      {c.confirmed_at ? "Checked in safe" : "Cancelled"}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                      {new Date(c.scheduled_at).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })}
                      {c.place ? ` · ${c.place}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="px-4 py-4 rounded-2xl" style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
          <p className="font-mono text-[10px] text-center leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            All check-in times, dates, and locations are securely logged. This information can be provided to NZ Police or emergency services if ever needed.
          </p>
        </div>

      </div>
    </div>
  );
}
