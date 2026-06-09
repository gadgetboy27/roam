import { ReactNode } from "react";
import { Users, Lock, Crown, AlertCircle, LogIn } from "lucide-react";

export type ModalState = {
  open: boolean;
  title: string;
  message: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export const closedModal: ModalState = { open: false, title: "", message: "" };

// Maps a thrown API error into friendly, context-aware modal content so users
// see a clear explanation instead of a raw "409"/"403" toast.
export function friendlyError(err: any, ctx?: { what?: string; groupType?: string; onUpgrade?: () => void; onDiscover?: () => void }): ModalState {
  const msg = String(err?.message || "");
  const type = ctx?.groupType || "group";

  if (/409|already in/i.test(msg)) {
    return { open: true, icon: <Users size={26} />, title: "Already in the crew",
      message: `They're already a member of this ${type}. No need to add them again.` };
  }
  if (/group is full/i.test(msg)) {
    return { open: true, icon: <Users size={26} />, title: "This crew is full",
      message: `Your ${type} has reached its size limit. Upgrade to a larger Community or Organiser plan to add more people.`,
      actionLabel: ctx?.onUpgrade ? "See plans" : "Got it", onAction: ctx?.onUpgrade };
  }
  if (/only the (group )?leader/i.test(msg)) {
    return { open: true, icon: <Crown size={26} />, title: "Leaders only",
      message: "Only the group leader can do that." };
  }
  if (/connected with|you can only invite/i.test(msg)) {
    return { open: true, icon: <Users size={26} />, title: "Connect first",
      message: "You can only add people you've matched with. Head to Discover, connect, then crew up.",
      actionLabel: ctx?.onDiscover ? "Go to Discover" : "Got it", onAction: ctx?.onDiscover };
  }
  if (/community .* plan|need an adventurer|requires? .*plan|needsUpgrade/i.test(msg)) {
    return { open: true, icon: <Lock size={26} />, title: "Plan required",
      message: "Squad and Crew are free. Community and Organiser groups need an Adventurer or Organiser plan.",
      actionLabel: ctx?.onUpgrade ? "See plans" : "Got it", onAction: ctx?.onUpgrade };
  }
  if (/401|unauthor|not authenticated|sign in/i.test(msg)) {
    return { open: true, icon: <LogIn size={26} />, title: "Please sign in again",
      message: "Your session expired. Sign in again to continue." };
  }
  return { open: true, icon: <AlertCircle size={26} />, title: ctx?.what ? `Couldn't ${ctx.what}` : "Something went wrong",
    message: msg.replace(/^\d+:\s*/, "") || "Please try again in a moment." };
}

export function ActionModal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  if (!state.open) return null;
  const action = () => { state.onAction?.(); onClose(); };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5"
         style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)" }}
         onClick={onClose} data-testid="action-modal">
      <div className="w-full max-w-[340px] rounded-3xl p-6 text-center animate-fade-up"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }}
           onClick={e => e.stopPropagation()}>
        {state.icon && (
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: "rgba(var(--roam-electric-rgb),0.12)", color: "var(--roam-electric)" }}>
            {state.icon}
          </div>
        )}
        <h2 className="font-serif text-xl font-black mb-1.5" style={{ color: "var(--roam-cream)" }}>{state.title}</h2>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>{state.message}</p>
        <button onClick={action}
                className="w-full py-3 rounded-2xl font-semibold text-[14px] transition-all active:scale-[0.98]"
                style={{ background: "var(--roam-electric)", color: "var(--roam-bg)" }}
                data-testid="action-modal-button">
          {state.actionLabel ?? "Got it"}
        </button>
      </div>
    </div>
  );
}
