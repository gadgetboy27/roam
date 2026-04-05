import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/lib/adminAuth";
import { Shield, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { admin, isLoading, login } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--roam-electric)" }} />
      </div>
    );
  }

  if (admin) {
    navigate("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <div className="topo-bg" />
      <div className="relative z-10 w-full max-w-sm">

        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
            <Shield size={24} style={{ color: "var(--roam-electric)" }} />
          </div>
          <h1 className="font-serif text-[28px] font-black text-center"
              style={{ color: "rgba(var(--roam-cream-rgb),0.92)" }}>
            roam. <span style={{ color: "var(--roam-electric)" }}>admin</span>
          </h1>
          <p className="font-mono text-[11px] mt-1 tracking-wider"
             style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            RESTRICTED ACCESS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-widest mb-1.5"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              USERNAME
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              data-testid="input-admin-username"
              className="w-full px-4 py-3 rounded-xl font-mono text-[13px] outline-none transition-all"
              style={{
                background: "rgba(var(--roam-cream-rgb),0.05)",
                border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
                color: "rgba(var(--roam-cream-rgb),0.85)",
              }}
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest mb-1.5"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                data-testid="input-admin-password"
                className="w-full px-4 py-3 pr-11 rounded-xl font-mono text-[13px] outline-none transition-all"
                style={{
                  background: "rgba(var(--roam-cream-rgb),0.05)",
                  border: "1px solid rgba(var(--roam-cream-rgb),0.1)",
                  color: "rgba(var(--roam-cream-rgb),0.85)",
                }}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl font-mono text-[11px]"
                 style={{
                   background: "rgba(var(--roam-ember-rgb),0.1)",
                   border: "1px solid rgba(var(--roam-ember-rgb),0.3)",
                   color: "var(--roam-ember)",
                 }}
                 data-testid="text-admin-login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            data-testid="button-admin-login"
            className="w-full py-3.5 rounded-xl font-mono text-[12px] tracking-widest uppercase font-bold transition-all"
            style={{
              background: submitting || !username.trim() || !password
                ? "rgba(var(--roam-electric-rgb),0.3)"
                : "var(--roam-electric)",
              color: submitting || !username.trim() || !password
                ? "rgba(var(--roam-cream-rgb),0.4)"
                : "#1a1a2e",
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-8 text-center font-mono text-[10px]"
           style={{ color: "rgba(var(--roam-cream-rgb),0.2)" }}>
          All access attempts are logged.
        </p>
      </div>
    </div>
  );
}
