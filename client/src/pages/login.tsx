import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { consumeNextRoute } from "@/lib/nextRoute";
import { Eye, EyeOff, Compass } from "lucide-react";
import { SiFacebook, SiGoogle } from "react-icons/si";

const HERO_URLS = [
  "/photo-1551632811-561732d1e306.jpeg",
  "/photo-1505118380757-91f5f5632de0.jpeg",
  "/photo-1473773508845-188df298d2d1.jpeg",
];

const inputStyle: React.CSSProperties = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

export default function Login() {
  const [, navigate] = useLocation();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  // If a failed email/password login is actually an OAuth-only account, hint
  // which social button to use instead of leaving the user stuck.
  const [oauthHint, setOauthHint] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) navigate(consumeNextRoute());
  }, [user, authLoading, navigate]);

  const valid = email.includes("@") && password.length >= 6;

  const handleFacebook = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSigningIn(true);
    setError("");
    setOauthHint(null);
    try {
      await login(email, password);
      navigate(consumeNextRoute());
    } catch (err: any) {
      const msg = err?.message || "Invalid email or password";
      setError(msg.includes("fetch") ? "Could not reach the server. Please try again." : msg);
      // Was this actually a social-login account? If so, nudge them to it.
      try {
        const res = await fetch("/api/auth/login-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        const provider = (data?.oauthProviders || []).find((p: string) => p === "google" || p === "facebook");
        if (provider) setOauthHint(provider);
      } catch { /* hint is best-effort */ }
    } finally {
      setSigningIn(false);
    }
  };

  if (authLoading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen relative" data-testid="page-login">
      <div className="topo-bg" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          <div className="grid grid-cols-3 h-full gap-0.5">
            {HERO_URLS.map((u, i) => (
              <div key={i} className="overflow-hidden">
                <img src={u} alt="" className="w-full h-full object-cover brightness-[0.5]" loading="lazy"
                     draggable={false} />
              </div>
            ))}
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 20%, rgba(var(--roam-forest-rgb),0.97) 100%)" }} />
          <div className="absolute bottom-5 left-0 right-0 text-center">
            <div className="font-serif text-4xl font-black tracking-tight">
              roam<span style={{ color: "var(--roam-electric)" }}>.</span>
            </div>
            <div className="font-mono text-[10px] tracking-[2.5px] uppercase mt-0.5" style={{ color: "var(--roam-sand)" }}>
              welcome back, adventurer
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-5 pt-8 pb-10 max-w-md mx-auto w-full">
          <div className="animate-fade-up">
            <h2 className="font-serif text-[26px] font-black leading-tight mb-1">
              Sign <span className="italic" style={{ color: "var(--roam-electric)" }}>in</span>
            </h2>
            <p className="text-[13px] mb-6 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
              Your adventures are waiting.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  Email
                </label>
                <input type="email" autoComplete="email" autoFocus
                       className="w-full py-3 px-4 rounded-2xl text-sm outline-none"
                       style={inputStyle}
                       placeholder="you@example.com"
                       value={email}
                       onChange={e => { setEmail(e.target.value); setError(""); setOauthHint(null); }}
                       data-testid="input-email" />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                  Password
                </label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="current-password"
                         className="w-full py-3 px-4 pr-12 rounded-2xl text-sm outline-none"
                         style={inputStyle}
                         placeholder="Your password"
                         value={password}
                         onChange={e => { setPassword(e.target.value); setError(""); setOauthHint(null); }}
                         data-testid="input-password" />
                  <button type="button" tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.3)" }}
                          onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs font-mono py-2.5 px-4 rounded-xl animate-fade-up"
                     style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}
                     data-testid="text-login-error">
                  {error}
                </div>
              )}

              {oauthHint && (
                <button
                  type="button"
                  onClick={oauthHint === "facebook" ? handleFacebook : handleGoogle}
                  className="w-full text-left text-xs font-mono py-2.5 px-4 rounded-xl animate-fade-up flex items-center gap-2"
                  style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.3)", color: "var(--roam-electric)" }}
                  data-testid="oauth-hint">
                  {oauthHint === "facebook" ? <SiFacebook size={13} /> : <SiGoogle size={13} />}
                  This email signed up with {oauthHint === "facebook" ? "Facebook" : "Google"} — tap to continue with it.
                </button>
              )}

              <div className="text-right -mt-1 mb-1">
                <Link href="/forgot-password">
                  <button type="button" className="font-mono text-[10px] tracking-wider"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}
                          data-testid="link-forgot-password">
                    Forgot password?
                  </button>
                </Link>
              </div>

              <button type="submit"
                      className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium mt-1 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                      disabled={!valid || signingIn}
                      data-testid="button-signin">
                {signingIn ? (
                  <>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                             style={{ background: "var(--roam-forest)", animation: `bounce-dot 0.9s ${i*0.15}s infinite` }} />
                      ))}
                    </div>
                    Signing in…
                  </>
                ) : (
                  <>
                    <Compass size={14} />
                    Sign in
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.08)" }} />
                <span className="font-mono text-[10px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.08)" }} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="py-3.5 rounded-2xl text-[12px] font-mono tracking-wide uppercase font-medium flex items-center justify-center gap-2 transition-all"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-cream)" }}
                  data-testid="button-google-login">
                  <SiGoogle size={14} />
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleFacebook}
                  className="py-3.5 rounded-2xl text-[12px] font-mono tracking-wide uppercase font-medium flex items-center justify-center gap-2 transition-all"
                  style={{ background: "#1877f2", color: "#fff" }}
                  data-testid="button-facebook-login">
                  <SiFacebook size={14} />
                  Facebook
                </button>
              </div>

              <div className="text-center text-[13px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                New to roam?{" "}
                <Link href="/signup">
                  <button className="underline font-medium" style={{ color: "var(--roam-electric)" }}
                          data-testid="link-signup">
                    Create an account
                  </button>
                </Link>
              </div>

              <div className="text-center">
                <Link href="/">
                  <button className="font-mono text-[11px] tracking-wider"
                          style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}
                          data-testid="link-home">
                    ← back to home
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
