import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "./queryClient";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await apiRequest("POST", "/api/auth/login", { email, password });
    } catch (err: any) {
      const raw = err?.message || "";
      const jsonStr = raw.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(jsonStr);
        throw new Error(parsed.message || "Invalid email or password");
      } catch (inner: any) {
        if (inner?.message && inner.message !== jsonStr) throw inner;
        throw new Error("Invalid email or password");
      }
    }
    setUser(await res.json());
  };

  const logout = async () => {
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
