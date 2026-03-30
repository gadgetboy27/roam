import { useState } from "react";
import { useLocation, Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowLeft } from "lucide-react";

const inputStyle = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const valid = email.includes("@") && email.includes(".");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSending(true);
    setError("");
    try {
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (sbError) throw sbError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-5" data-testid="page-forgot-password">
      <div className="topo-bg" />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">

        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-black tracking-tight mb-1">
            roam<span style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
        </div>

        {!sent ? (
          <>
            <div className="mb-6">
              <h1 className="font-serif text-[26px] font-black leading-tight mb-1">
                Reset your <span className="italic" style={{ color: "var(--roam-electric)" }}>password</span>
              </h1>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                Enter your email and we'll send you a link to set a new one.
              </p>
            </div>

            <form onSubmit={handleSend} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  Email
                </label>
                <input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  className="w-full py-3 px-4 rounded-2xl text-sm outline-none"
                  style={inputStyle}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  data-testid="input-email" />
              </div>

              {error && (
                <div className="text-xs font-mono py-2.5 px-4 rounded-xl"
                     style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}
                     data-testid="text-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!valid || sending}
                className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium mt-1 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                data-testid="button-send-reset">
                {sending ? (
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full"
                           style={{ background: "var(--roam-forest)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <Mail size={14} />
                    Send reset link
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1.5px solid var(--roam-electric)" }}>
              <Mail size={28} style={{ color: "var(--roam-electric)" }} />
            </div>
            <h1 className="font-serif text-[26px] font-black leading-tight mb-2">
              Check your <span className="italic" style={{ color: "var(--roam-electric)" }}>inbox</span>
            </h1>
            <p className="text-[13px] leading-relaxed mb-6" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              We sent a reset link to <strong style={{ color: "var(--roam-cream)" }}>{email}</strong>.<br />
              It expires in 1 hour.
            </p>
            <button
              className="text-xs font-mono underline"
              style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}
              onClick={() => setSent(false)}
              data-testid="button-resend">
              Didn't receive it? Try again
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/login">
            <button className="flex items-center justify-center gap-1.5 mx-auto font-mono text-[11px] tracking-wider"
                    style={{ color: "rgba(var(--roam-cream-rgb),0.28)" }}
                    data-testid="link-back-to-login">
              <ArrowLeft size={12} />
              back to sign in
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
