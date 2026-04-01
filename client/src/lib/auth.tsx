import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  dob: string | null;
  gender: string | null;
  ethnicity: string | null;
  location: string | null;
  tagline: string | null;
  tier: string;
  photoLicenseAgreed: boolean;
  adventureTags: string[] | null;
  avatarUrl: string | null;
  identityVerified?: boolean;
  identityVerificationId?: string | null;
  identityVerifiedAt?: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

async function fetchProfile(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const profile = await fetchProfile(session.access_token);
        setUser(profile);
      } else {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) setUser(await res.json());
        else setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        } else if (session?.access_token) {
          setLoading(true);
          const profile = await fetchProfile(session.access_token);
          setUser(profile);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    // Try Supabase auth first (covers all new signups and OAuth users)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session?.access_token) {
      const profile = await fetchProfile(data.session.access_token);
      if (!profile) throw new Error("Account not found. Please sign up first.");
      setUser(profile);
      return;
    }

    // Fallback: try legacy bcrypt auth for accounts created before Supabase sync.
    // If this succeeds it sets a server session, then silently registers them in
    // Supabase so future logins go through the normal path.
    const fallback = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!fallback.ok) throw new Error("Invalid email or password");
    const profile = await fallback.json();
    setUser(profile);

    // Fire-and-forget: register this user in Supabase so next login is seamless
    fetch("/api/auth/migrate-to-supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    }).catch(() => {});
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <div className="topo-bg" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full"
                   style={{ background: "var(--roam-electric)", animation: `bounce-dot 0.9s ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <p className="font-mono text-[11px] tracking-wider uppercase" style={{ color: "rgba(242,237,227,0.3)" }}>
            Loading
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
