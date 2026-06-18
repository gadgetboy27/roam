import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { isLeakedPasswordError, PWNED_PASSWORD_MESSAGE } from "@/lib/passwordError";
import { Eye, EyeOff, Lock } from "lucide-react";

const inputStyle = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        navigate("/forgot-password");
      }
    });
  }, []);

  const pwStrong = password.length >= 8;
  const match = password === confirm;
  const valid = pwStrong && match && confirm.length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await refresh();
      setDone(true);
      setTimeout(() => navigate("/discover"), 1500);
    } catch (err: any) {
      if (isLeakedPasswordError(err)) {
        toast({ variant: "destructive", title: "That password isn't safe", description: PWNED_PASSWORD_MESSAGE });
        setError(PWNED_PASSWORD_MESSAGE);
      } else {
        setError(err.message || "Could not update password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <div className="topo-bg" />
        <div className="relative z-10 flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full"
                 style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-5" data-testid="page-reset-password">
      <div className="topo-bg" />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">

        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-black tracking-tight mb-1">
            roam<span style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
        </div>

        {!done ? (
          <>
            <div className="mb-6">
              <h1 className="font-serif text-[26px] font-black leading-tight mb-1">
                New <span className="italic" style={{ color: "var(--roam-electric)" }}>password</span>
              </h1>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                Choose something you haven't used before.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    autoFocus
                    className="w-full py-3 px-4 pr-12 rounded-2xl text-sm outline-none"
                    style={{
                      ...inputStyle,
                      borderColor: password.length > 0 && !pwStrong
                        ? "rgba(232,98,26,0.5)"
                        : "rgba(var(--roam-cream-rgb),0.14)",
                    }}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    data-testid="input-password" />
                  <button type="button" tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
                          onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {[1,2,3,4].map(n => (
                      <div key={n} className="h-0.5 flex-1 rounded-full transition-all"
                           style={{
                             background: password.length >= n * 2
                               ? password.length >= 12 ? "var(--roam-electric)" : "var(--roam-sand)"
                               : "rgba(var(--roam-cream-rgb),0.1)"
                           }} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  className="w-full py-3 px-4 rounded-2xl text-sm outline-none"
                  style={{
                    ...inputStyle,
                    borderColor: confirm.length > 0 && !match
                      ? "rgba(232,98,26,0.5)"
                      : "rgba(var(--roam-cream-rgb),0.14)",
                  }}
                  placeholder="Same password again"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(""); }}
                  data-testid="input-confirm-password" />
                {confirm.length > 0 && !match && (
                  <p className="text-[10px] font-mono mt-1.5" style={{ color: "var(--roam-ember)" }}>
                    Passwords don't match
                  </p>
                )}
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
                disabled={!valid || saving}
                className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium mt-1 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                data-testid="button-save-password">
                {saving ? (
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full"
                           style={{ background: "var(--roam-forest)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <Lock size={14} />
                    Save new password
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1.5px solid var(--roam-electric)" }}>
              <span className="text-2xl" style={{ color: "var(--roam-electric)" }}>✓</span>
            </div>
            <h1 className="font-serif text-[26px] font-black mb-2">
              Password <span className="italic" style={{ color: "var(--roam-electric)" }}>updated</span>
            </h1>
            <p className="text-[13px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Taking you to your feed…
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
