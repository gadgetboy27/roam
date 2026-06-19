import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { fileToDataUrl } from "@/lib/file";
import { Bookmark, MapPin, Plus, X, ImagePlus, Loader2 } from "lucide-react";

const BUCKET_LIST = [
  { name: "Faroe Islands", url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&q=80&fit=crop" },
  { name: "Patagonia", url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=80&fit=crop" },
  { name: "Kyoto autumn", url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=300&q=80&fit=crop" },
  { name: "Iceland", url: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=300&q=80&fit=crop" },
  { name: "Lofoten", url: "https://images.unsplash.com/photo-1559628376-f3fe8b41e8e0?w=300&q=80&fit=crop" },
];

// "Dream destinations" — the user's bucket list (places they want to go).
// Powers Bucket List matching: roamers who share a pinned destination get
// highlighted. Lives in Profile, beside "Places you've roamed".
export default function DreamDestinations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddDest, setShowAddDest] = useState(false);
  const [newDestName, setNewDestName] = useState("");
  const [destImage, setDestImage] = useState<{ preview: string; dataUrl: string } | null>(null);
  const destFileRef = useRef<HTMLInputElement>(null);

  const { data: bucketList = [] } = useQuery<{ id: string; destinationName: string; imageUrl: string | null }[]>({
    queryKey: ["/api/bucket-list", user?.id],
    enabled: !!user,
  });

  const pickDestImage = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Image too large", description: "Please use a photo under 8 MB.", variant: "destructive" }); return; }
    try { setDestImage({ preview: URL.createObjectURL(file), dataUrl: await fileToDataUrl(file) }); }
    catch { toast({ title: "Couldn't read that image", variant: "destructive" }); }
  };

  const addDestMutation = useMutation({
    mutationFn: async ({ name, dataUrl, imageUrl }: { name: string; dataUrl?: string; imageUrl?: string }) => {
      let finalImageUrl = imageUrl;
      if (dataUrl) {
        const up = await apiRequest("POST", "/api/bucket-list/image", { dataUrl });
        finalImageUrl = (await up.json()).url;
      }
      const res = await apiRequest("POST", "/api/bucket-list", { destinationName: name, imageUrl: finalImageUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bucket-list", user?.id] });
      setShowAddDest(false); setNewDestName(""); setDestImage(null);
      toast({ title: "Destination pinned", description: "Matches who share it will be highlighted." });
    },
    onError: (e: any) => toast({ title: "Couldn't add destination", description: e?.message?.replace(/^\d+:\s*/, "") || "Please try again.", variant: "destructive" }),
  });

  const removeDestMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bucket-list/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bucket-list", user?.id] }),
    onError: (e: any) => toast({ title: "Couldn't remove destination", description: e?.message?.replace(/^\d+:\s*/, "") || "Please try again.", variant: "destructive" }),
  });

  const submitDest = () => {
    const name = newDestName.trim();
    if (!name) { toast({ title: "Give your destination a name", variant: "destructive" }); return; }
    addDestMutation.mutate({ name, dataUrl: destImage?.dataUrl });
  };

  const quickAddPreset = (name: string, imageUrl: string) => {
    if (bucketList.some(bl => bl.destinationName.trim().toLowerCase() === name.toLowerCase())) return;
    addDestMutation.mutate({ name, imageUrl });
  };

  return (
    <div data-testid="section-dream-destinations">
      <div className="font-mono text-[10px] tracking-[1.5px] uppercase mb-2.5 flex items-center gap-1.5"
           style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
        <Bookmark size={10} />
        Dream destinations
        {bucketList.length > 0 && (
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-lg ml-1"
                style={{ background: "rgba(var(--roam-electric-rgb),0.1)", border: "1px solid rgba(var(--roam-electric-rgb),0.22)", color: "var(--roam-electric)" }}>
            {bucketList.length} pinned
          </span>
        )}
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {/* The user's own pinned destinations — each removable */}
        {bucketList.map((b) => (
          <div key={b.id} className="flex-shrink-0 w-[110px] rounded-2xl overflow-hidden relative"
               style={{ border: "2px solid rgba(var(--roam-electric-rgb),0.65)" }}
               data-testid={`bucket-${b.destinationName.replace(/\s+/g, "-")}`}>
            {b.imageUrl
              ? <img src={b.imageUrl} alt={b.destinationName} className="w-[110px] h-[110px] object-cover" loading="lazy" />
              : <div className="w-[110px] h-[110px] flex items-center justify-center" style={{ background: "rgba(var(--roam-electric-rgb),0.12)" }}>
                  <MapPin size={22} style={{ color: "var(--roam-electric)" }} />
                </div>}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 55%)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <div className="font-semibold text-[10px] text-white leading-tight">{b.destinationName}</div>
            </div>
            <button
              onClick={() => removeDestMutation.mutate(b.id)}
              disabled={removeDestMutation.isPending}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.55)" }}
              aria-label={`Remove ${b.destinationName}`}
              data-testid={`remove-bucket-${b.destinationName.replace(/\s+/g, "-")}`}>
              <X size={11} style={{ color: "#fff" }} />
            </button>
          </div>
        ))}

        {/* Add-your-own card */}
        <button
          onClick={() => setShowAddDest(true)}
          className="flex-shrink-0 w-[110px] h-[110px] rounded-2xl flex flex-col items-center justify-center gap-1.5"
          style={{ border: "1.5px dashed rgba(var(--roam-cream-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.03)" }}
          data-testid="button-add-destination">
          <Plus size={20} style={{ color: "var(--roam-electric)" }} />
          <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>Add your own</span>
        </button>
      </div>

      {/* Inline composer */}
      {showAddDest && (
        <div className="mt-1 rounded-2xl p-3 animate-fade-up"
             style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)" }}>
          <div className="flex gap-2.5">
            <button
              onClick={() => destFileRef.current?.click()}
              className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center relative"
              style={{ border: "1.5px dashed rgba(var(--roam-cream-rgb),0.2)", background: "rgba(var(--roam-cream-rgb),0.04)" }}
              data-testid="button-pick-dest-image">
              {destImage
                ? <img src={destImage.preview} alt="" className="w-full h-full object-cover" />
                : <ImagePlus size={18} style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }} />}
            </button>
            <input ref={destFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                   className="hidden" onChange={e => { pickDestImage(e.target.files?.[0]); e.target.value = ""; }}
                   data-testid="input-dest-image" />
            <div className="flex-1 min-w-0 flex flex-col">
              <input
                value={newDestName}
                onChange={e => setNewDestName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitDest(); }}
                placeholder="Where do you dream of going?"
                maxLength={80}
                autoFocus
                className="w-full py-2 px-3 rounded-lg text-sm outline-none"
                style={{ background: "rgba(var(--roam-cream-rgb),0.06)", border: "1px solid rgba(var(--roam-cream-rgb),0.1)", color: "var(--roam-cream)" }}
                data-testid="input-dest-name" />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={submitDest}
                  disabled={addDestMutation.isPending}
                  className="flex-1 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                  data-testid="button-submit-dest">
                  {addDestMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
                  {addDestMutation.isPending ? "Pinning…" : "Pin it"}
                </button>
                <button
                  onClick={() => { setShowAddDest(false); setNewDestName(""); setDestImage(null); }}
                  className="px-3 py-2 rounded-lg font-mono text-[11px] tracking-wider uppercase"
                  style={{ background: "rgba(var(--roam-cream-rgb),0.06)", color: "rgba(var(--roam-cream-rgb),0.6)" }}
                  data-testid="button-cancel-dest">
                  Cancel
                </button>
              </div>
              <p className="font-mono text-[9px] mt-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Photo optional · JPEG/PNG/WebP, max 8 MB</p>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions — tap to pin */}
      {BUCKET_LIST.some(b => !bucketList.some(bl => bl.destinationName.trim().toLowerCase() === b.name.toLowerCase())) && (
        <div className="mt-2.5">
          <div className="font-mono text-[9px] tracking-wider uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Popular — tap to pin</div>
          <div className="flex flex-wrap gap-1.5">
            {BUCKET_LIST.filter(b => !bucketList.some(bl => bl.destinationName.trim().toLowerCase() === b.name.toLowerCase())).map((b, i) => (
              <button key={i}
                onClick={() => quickAddPreset(b.name, b.url)}
                disabled={addDestMutation.isPending}
                className="px-2.5 py-1.5 rounded-lg font-mono text-[10px] tracking-wider flex items-center gap-1 disabled:opacity-50"
                style={{ background: "rgba(var(--roam-cream-rgb),0.05)", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "rgba(var(--roam-cream-rgb),0.7)" }}
                data-testid={`suggest-${b.name.replace(/\s+/g, "-")}`}>
                <Plus size={10} style={{ color: "var(--roam-electric)" }} />{b.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
