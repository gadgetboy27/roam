import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as any;
        const errorParam = params.get("error");
        const errorDesc = params.get("error_description");

        if (errorParam) {
          setErrorMsg(errorDesc || errorParam);
          setStatus("error");
          return;
        }

        let session: any = null;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
          session = data.session;
        } else {
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (!existing) throw new Error("No confirmation token found in this link.");
          session = existing;
        }

        if (type === "recovery") {
          setStatus("success");
          setTimeout(() => navigate("/reset-password"), 800);
          return;
        }

        if (session?.access_token) {
          const profileRes = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: "include",
          });

          if (!profileRes.ok) {
            const sbUser = session.user;
            const fullName =
              sbUser?.user_metadata?.full_name ||
              sbUser?.user_metadata?.name ||
              sbUser?.email?.split("@")[0] ||
              "Adventurer";

            const createRes = await fetch("/api/auth/profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              credentials: "include",
              body: JSON.stringify({ name: fullName, tier: "free" }),
            });
            if (!createRes.ok) {
              const err = await createRes.json().catch(() => ({ message: "Profile creation failed" }));
              throw new Error(err.message);
            }
          }
        }

        await refresh();
        setStatus("success");
        setTimeout(() => navigate("/discover"), 1100);
      } catch (err: any) {
        setErrorMsg(err.message || "Verification failed. Try signing in again.");
        setStatus("error");
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center px-6">
      <div className="topo-bg" />
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs">

        {status === "loading" && (
          <>
            <div className="flex gap-1.5 mb-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full"
                     style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <p className="font-serif text-2xl font-black mb-1">
              {new URLSearchParams(window.location.search).get("type") === "recovery"
                ? <>Verifying your<br /><span className="italic" style={{ color: "var(--roam-electric)" }}>reset link</span></>
                : <>Confirming your<br /><span className="italic" style={{ color: "var(--roam-electric)" }}>account</span></>
              }
            </p>
            <p className="text-sm mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              Just a moment…
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                 style={{ background: "rgba(var(--roam-electric-rgb),0.15)", border: "1.5px solid var(--roam-electric)" }}>
              <span className="text-2xl" style={{ color: "var(--roam-electric)" }}>✓</span>
            </div>
            <p className="font-serif text-2xl font-black mb-1">
              You're <span className="italic" style={{ color: "var(--roam-electric)" }}>in.</span>
            </p>
            <p className="text-sm mt-2" style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
              Taking you to your feed…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                 style={{ background: "rgba(232,98,26,0.12)", border: "1.5px solid var(--roam-ember)" }}>
              <span className="text-2xl" style={{ color: "var(--roam-ember)" }}>✕</span>
            </div>
            <p className="font-serif text-2xl font-black mb-2">
              Something went <span className="italic" style={{ color: "var(--roam-ember)" }}>wrong</span>
            </p>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
              {errorMsg}
            </p>
            <button
              className="w-full py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium"
              style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
              onClick={() => navigate("/login")}
              data-testid="button-back-to-login">
              Back to sign in
            </button>
            <button
              className="w-full mt-2 py-2 text-xs font-mono underline"
              style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}
              onClick={() => navigate("/signup")}
              data-testid="button-back-to-signup">
              Try signing up again
            </button>
          </>
        )}

      </div>
    </div>
  );
}
