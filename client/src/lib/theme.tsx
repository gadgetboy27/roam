import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "forest-dark" | "daylight" | "ocean" | "ember";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatch: string;
  accentSwatch: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "forest-dark", label: "Forest Dark", swatch: "#0e1a0d", accentSwatch: "#c8e64a" },
  { id: "daylight",    label: "Daylight",    swatch: "#f0ebe0", accentSwatch: "#2d7d1f" },
  { id: "ocean",       label: "Ocean Deep",  swatch: "#080f1e", accentSwatch: "#38bdf8" },
  { id: "ember",       label: "Ember Night", swatch: "#140703", accentSwatch: "#e8621a" },
];

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "forest-dark", setTheme: () => {} });

function safeGetStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetStorage(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* sandboxed iframe */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    return (safeGetStorage("roam-theme") as ThemeId) || "forest-dark";
  });

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    safeSetStorage("roam-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
