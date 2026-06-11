import { useState } from "react";
import { SiFacebook, SiWhatsapp, SiX, SiTelegram } from "react-icons/si";
import { Mail, Link2, Share2, Check, X as XIcon } from "lucide-react";
import { SHARE_TARGETS, nativeShare, canNativeShare, copyLink, type SharePayload } from "@/lib/share";

const ICONS: Record<string, any> = { facebook: SiFacebook, x: SiX, whatsapp: SiWhatsapp, telegram: SiTelegram, email: Mail };

export default function ShareSheet({ open, onClose, payload, heading = "Share" }: {
  open: boolean; onClose: () => void; payload: SharePayload; heading?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
         style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={onClose} data-testid="share-sheet">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-fade-up"
           style={{ background: "var(--roam-surface)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-black" style={{ color: "var(--roam-cream)" }}>{heading}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.5)" }}>
            <XIcon size={15} />
          </button>
        </div>

        {canNativeShare() && (
          <button onClick={() => { nativeShare(payload); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl mb-3"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                  data-testid="share-native">
            <Share2 size={16} /> <span className="font-mono text-[12px] font-semibold">Share via…</span>
          </button>
        )}

        <div className="grid grid-cols-4 gap-2">
          {SHARE_TARGETS.map(t => {
            const Icon = ICONS[t.id];
            return (
              <a key={t.id} href={t.href(payload)} target="_blank" rel="noopener noreferrer" onClick={onClose}
                 className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                 data-testid={`share-${t.id}`}>
                <Icon size={18} style={{ color: "var(--roam-cream)" }} />
                <span className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{t.label}</span>
              </a>
            );
          })}
          <button onClick={async () => { const ok = await copyLink(payload.url); setCopied(ok); setTimeout(() => setCopied(false), 1500); }}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}
                  data-testid="share-copy">
            {copied ? <Check size={18} style={{ color: "var(--roam-electric)" }} /> : <Link2 size={18} style={{ color: "var(--roam-cream)" }} />}
            <span className="font-mono text-[9px]" style={{ color: copied ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.5)" }}>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
