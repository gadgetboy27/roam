import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, X, Plus } from "lucide-react";

interface VisitedPlace {
  id: string;
  place: string;
  year: number | null;
}

// "Places you've roamed" — the data behind Almost Met. When you and another
// roamer have logged the same place, it surfaces as an "Almost Met" on Discover.
export default function PlacesRoamed() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [place, setPlace] = useState("");
  const [year, setYear] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    apiRequest("GET", `/api/places/${user.id}`)
      .then((r) => r.json())
      .then((rows: VisitedPlace[]) => setPlaces(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, [user?.id]);

  const add = async () => {
    const name = place.trim();
    if (!name || adding) return;
    setAdding(true);
    setError("");
    try {
      const res = await apiRequest("POST", "/api/places", {
        place: name,
        year: year.trim() || undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.message || "Couldn't add that place.");
        return;
      }
      const created = (await res.json()) as VisitedPlace;
      setPlaces((prev) => [...prev, created]);
      setPlace("");
      setYear("");
    } catch {
      setError("Couldn't add that place.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id)); // optimistic
    try {
      await apiRequest("DELETE", `/api/places/${id}`);
    } catch {
      /* best-effort; the row reappears on next load if it failed */
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(var(--roam-violet-rgb),0.08)", border: "1px solid rgba(var(--roam-violet-rgb),0.25)" }}
      data-testid="section-places-roamed"
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "13px" }}>👻</span>
          <div>
            <div className="font-mono text-[12px] font-semibold" style={{ color: "var(--roam-cream)" }}>
              Places you've roamed
            </div>
            <div className="font-mono text-[9px] mt-0.5" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
              When someone's roamed the same place, you'll see an Almost Met on Discover.
            </div>
          </div>
        </div>

        {/* Existing places */}
        {places.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3" data-testid="list-places">
            {places.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg font-mono text-[10px]"
                style={{ background: "rgba(var(--roam-violet-rgb),0.18)", color: "var(--roam-cream)" }}
                data-testid={`chip-place-${p.id}`}
              >
                <MapPin size={10} style={{ opacity: 0.7 }} />
                {p.place}
                {p.year ? <span style={{ opacity: 0.55 }}>· {p.year}</span> : null}
                <button
                  onClick={() => remove(p.id)}
                  className="ml-0.5 rounded p-0.5 transition-opacity hover:opacity-100"
                  style={{ opacity: 0.5 }}
                  aria-label={`Remove ${p.place}`}
                  data-testid={`button-remove-place-${p.id}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add a place */}
        <div className="flex items-center gap-1.5 mt-3">
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Where have you been?"
            maxLength={80}
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg font-mono text-[11px] outline-none"
            style={{ background: "rgba(var(--roam-cream-rgb),0.08)", color: "var(--roam-cream)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }}
            data-testid="input-place"
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Year"
            inputMode="numeric"
            className="w-14 px-2 py-2 rounded-lg font-mono text-[11px] outline-none text-center"
            style={{ background: "rgba(var(--roam-cream-rgb),0.08)", color: "var(--roam-cream)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)" }}
            data-testid="input-place-year"
          />
          <button
            onClick={add}
            disabled={adding || !place.trim()}
            className="flex-shrink-0 flex items-center gap-1 py-2 px-3 rounded-lg font-mono text-[11px] font-semibold transition-all"
            style={{ background: "var(--roam-electric)", color: "var(--roam-forest)", opacity: adding || !place.trim() ? 0.5 : 1 }}
            data-testid="button-add-place"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {error && (
          <div className="font-mono text-[10px] mt-1.5" style={{ color: "var(--roam-ember)" }} data-testid="text-place-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
