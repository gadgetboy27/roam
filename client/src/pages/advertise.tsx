import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Megaphone, Zap, Star, Crown, ChevronRight, Loader2, AlertCircle, CalendarDays, Users, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

const TIERS = [
  {
    id: "explorer",
    label: "Explorer",
    icon: <Zap size={18} />,
    price: "$49",
    days: 7,
    color: "rgba(var(--roam-electric-rgb),0.9)",
    bg: "rgba(var(--roam-electric-rgb),0.06)",
    border: "rgba(var(--roam-electric-rgb),0.2)",
    features: ["Image ad", "7-day slot", "Basic rotation", "Shown every 7 swipes"],
    contentTypes: ["image"],
  },
  {
    id: "trailblazer",
    label: "Trailblazer",
    icon: <Star size={18} />,
    price: "$129",
    days: 14,
    color: "rgba(var(--roam-sky-rgb),0.95)",
    bg: "rgba(var(--roam-sky-rgb),0.06)",
    border: "rgba(var(--roam-sky-rgb),0.2)",
    features: ["Image ad + clickthrough link", "14-day slot", "Priority rotation", "Shown every 7 swipes"],
    contentTypes: ["image"],
    popular: true,
  },
  {
    id: "summit",
    label: "Summit",
    icon: <Crown size={18} />,
    price: "$299",
    days: 30,
    color: "rgba(var(--roam-ember-rgb),0.95)",
    bg: "rgba(var(--roam-ember-rgb),0.06)",
    border: "rgba(var(--roam-ember-rgb),0.2)",
    features: ["Image or video ad", "30-day slot", "Featured rotation (fastest)", "Shown every 7 swipes", "YouTube, Vimeo, or direct video"],
    contentTypes: ["image", "video"],
  },
];

const GUIDELINES = [
  "No content that discriminates based on race, gender, religion, ethnicity, disability, or sexual orientation",
  "No violent, threatening, or hateful imagery or language",
  "No offensive, obscene, or sexually explicit material",
  "No misleading or deceptive claims",
  "Content must be relevant to adventure, outdoor activities, events, sports, social gatherings, or lifestyle",
  "All ads must link to a real, operational website or page",
  "We reserve the right to reject any submission that doesn't fit the roam. community",
];

export default function Advertise() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isEventMode = params.get("mode") === "event";
  const prefillTitle = params.get("title") || "";
  const prefillDesc = params.get("desc") || "";
  const prefillGroupId = params.get("groupId") || "";
  const prefillEventId = params.get("eventId") || "";
  const prefillGroupName = params.get("groupName") || "";

  const [selectedTier, setSelectedTier] = useState("trailblazer");
  const [form, setForm] = useState({
    advertiserName: "",
    advertiserEmail: "",
    advertiserCompany: "",
    headline: prefillTitle,
    tagline: prefillDesc,
    ctaText: isEventMode ? "View event" : "",
    ctaUrl: "",
    imageUrl: "",
    videoUrl: "",
    contentType: "image",
    agreedToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        advertiserName: f.advertiserName || user.name || "",
        advertiserEmail: f.advertiserEmail || (user as any).email || "",
      }));
    }
  }, [user]);

  const tier = TIERS.find(t => t.id === selectedTier)!;
  const set = (field: string, val: string | boolean) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreedToTerms) { setError("You must agree to the content guidelines to continue."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("POST", "/api/ads/submit", {
        advertiserName: form.advertiserName,
        advertiserEmail: form.advertiserEmail,
        advertiserCompany: form.advertiserCompany || null,
        tier: selectedTier,
        headline: form.headline,
        tagline: form.tagline || null,
        ctaText: form.ctaText || null,
        ctaUrl: form.ctaUrl || null,
        imageUrl: form.imageUrl || null,
        videoUrl: form.videoUrl || null,
        contentType: form.contentType,
        adType: isEventMode ? "event" : "standard",
        linkedGroupId: prefillGroupId || null,
        linkedEventId: prefillEventId || null,
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.message || "Unexpected error.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl font-mono text-[12px] outline-none transition-all";
  const inputStyle = {
    background: "rgba(var(--roam-cream-rgb),0.05)",
    border: "1px solid rgba(var(--roam-cream-rgb),0.12)",
    color: "rgba(var(--roam-cream-rgb),0.85)",
  };

  return (
    <div className="min-h-screen relative" data-testid="page-advertise">
      <div className="topo-bg" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <button onClick={() => navigate(isEventMode && prefillGroupId ? `/groups/${prefillGroupId}?tab=events` : "/")}
                className="flex items-center gap-2 mb-8 font-mono text-[11px] tracking-wider uppercase transition-all"
                style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
          <ArrowLeft size={13} />
          {isEventMode ? `Back to ${prefillGroupName || "group"}` : "Back to roam."}
        </button>

        {isEventMode ? (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: "rgba(var(--roam-sky-rgb),0.12)", border: "1px solid rgba(var(--roam-sky-rgb),0.25)" }}>
                <CalendarDays size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }} />
              </div>
              <h1 className="font-serif text-[28px] font-black leading-tight">
                Promote your <span style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }}>event</span>
              </h1>
            </div>
            <p className="font-mono text-[11px] leading-relaxed mb-4"
               style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Reach beyond your group — your event ad appears in the discover feed to all roam. users.
            </p>

            <div className="rounded-2xl px-5 py-4 mb-8 flex items-start gap-4"
                 style={{ background: "rgba(var(--roam-sky-rgb),0.06)", border: "1px solid rgba(var(--roam-sky-rgb),0.15)" }}>
              <Sparkles size={16} style={{ color: "rgba(var(--roam-sky-rgb),0.8)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="font-mono text-[11px] font-semibold mb-1" style={{ color: "rgba(var(--roam-sky-rgb),0.9)" }}>
                  What happens when your event ad is approved
                </div>
                <ul className="space-y-1">
                  {[
                    "Your event card appears in the discover feed",
                    "All your matches get a personal notification",
                    "Anyone can RSVP from the What's On page",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
                      <ChevronRight size={10} style={{ color: "rgba(var(--roam-sky-rgb),0.6)", flexShrink: 0, marginTop: 2 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl px-5 py-4 mb-8 flex items-start gap-4"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.03)", border: "1px solid rgba(var(--roam-cream-rgb),0.07)" }}>
              <Users size={14} style={{ color: "rgba(var(--roam-cream-rgb),0.3)", flexShrink: 0, marginTop: 2 }} />
              <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
                <span className="font-semibold" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>Group members get event notifications for free.</span>{" "}
                Promoting reaches your matches and the wider roam. community — that's the paid difference.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
                <Megaphone size={16} style={{ color: "var(--roam-electric)" }} />
              </div>
              <h1 className="font-serif text-[28px] font-black leading-tight">
                Advertise on <span style={{ color: "var(--roam-electric)" }}>roam.</span>
              </h1>
            </div>
            <p className="font-mono text-[11px] leading-relaxed mb-8"
               style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              Reach adventure-minded people across New Zealand and beyond. Your ad appears as a native card in the discover feed — every 7 swipes.
            </p>
          </>
        )}

        {/* Tier selection */}
        <div className="font-mono text-[10px] tracking-wider uppercase mb-3"
             style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Choose your tier</div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {TIERS.map(t => (
            <button key={t.id} onClick={() => setSelectedTier(t.id)} data-testid={`tier-${t.id}`}
                    className="relative rounded-2xl p-3.5 text-left transition-all"
                    style={{
                      background: selectedTier === t.id ? t.bg : "rgba(var(--roam-cream-rgb),0.03)",
                      border: `1px solid ${selectedTier === t.id ? t.border : "rgba(var(--roam-cream-rgb),0.08)"}`,
                      outline: selectedTier === t.id ? `2px solid ${t.color}` : "2px solid transparent",
                      outlineOffset: "2px",
                    }}>
              {t.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-wider px-2 py-0.5 rounded-full"
                     style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}>
                  Popular
                </div>
              )}
              <div className="mb-2" style={{ color: t.color }}>{t.icon}</div>
              <div className="font-serif text-[14px] font-black mb-0.5"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.9)" }}>{t.label}</div>
              <div className="font-mono text-[11px] font-semibold mb-1" style={{ color: t.color }}>{t.price} NZD</div>
              <div className="font-mono text-[9px]" style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>{t.days} days</div>
            </button>
          ))}
        </div>

        {/* Features for selected tier */}
        <div className="rounded-2xl px-5 py-4 mb-8"
             style={{ background: tier.bg, border: `1px solid ${tier.border}` }}>
          <div className="font-mono text-[10px] tracking-wider uppercase mb-3" style={{ color: tier.color }}>
            {tier.label} includes
          </div>
          <div className="space-y-1.5">
            {tier.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <ChevronRight size={10} style={{ color: tier.color }} />
                <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.65)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Submission form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="font-mono text-[10px] tracking-wider uppercase mb-2"
               style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>Your details</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Contact name *</label>
              <input className={inputCls} style={inputStyle} required
                     value={form.advertiserName} onChange={e => set("advertiserName", e.target.value)}
                     placeholder="Your name" data-testid="input-advertiser-name" />
            </div>
            <div>
              <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Email *</label>
              <input className={inputCls} style={inputStyle} type="email" required
                     value={form.advertiserEmail} onChange={e => set("advertiserEmail", e.target.value)}
                     placeholder="you@company.com" data-testid="input-advertiser-email" />
            </div>
          </div>

          {!isEventMode && (
            <div>
              <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Company / Organisation</label>
              <input className={inputCls} style={inputStyle}
                     value={form.advertiserCompany} onChange={e => set("advertiserCompany", e.target.value)}
                     placeholder="Aotearoa Adventures Ltd" data-testid="input-advertiser-company" />
            </div>
          )}

          <div className="font-mono text-[10px] tracking-wider uppercase mt-6 mb-2"
               style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            {isEventMode ? "Event details" : "Ad content"}
          </div>

          <div>
            <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              {isEventMode ? "Event title *" : "Headline * (shown large on card)"}
            </label>
            <input className={inputCls} style={inputStyle} required maxLength={60}
                   value={form.headline} onChange={e => set("headline", e.target.value)}
                   placeholder={isEventMode ? "e.g. Sunrise hike — Mt Eden" : "e.g. Summit the South Island this weekend"}
                   data-testid="input-headline" />
          </div>

          <div>
            <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              {isEventMode ? "Description (optional)" : "Tagline (optional, smaller text)"}
            </label>
            <input className={inputCls} style={inputStyle} maxLength={100}
                   value={form.tagline} onChange={e => set("tagline", e.target.value)}
                   placeholder={isEventMode ? "What's happening, when, and where?" : "e.g. Guided hikes from Queenstown — all levels welcome"}
                   data-testid="input-tagline" />
          </div>

          <div>
            <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>
              {isEventMode ? "Event image URL *" : "Image URL *"}
            </label>
            <input className={inputCls} style={inputStyle} required
                   value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)}
                   placeholder="https://... (landscape image, min 800×600px)" data-testid="input-image-url" />
          </div>

          {(tier.id === "trailblazer" || tier.id === "summit") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>CTA button text</label>
                <input className={inputCls} style={inputStyle}
                       value={form.ctaText} onChange={e => set("ctaText", e.target.value)}
                       placeholder={isEventMode ? "View event" : "Book now"} data-testid="input-cta-text" />
              </div>
              <div>
                <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>CTA link URL</label>
                <input className={inputCls} style={inputStyle}
                       value={form.ctaUrl} onChange={e => set("ctaUrl", e.target.value)}
                       placeholder="https://yoursite.co.nz" data-testid="input-cta-url" />
              </div>
            </div>
          )}

          {tier.id === "summit" && (
            <div>
              <label className="font-mono text-[9px] tracking-wider uppercase mb-1 block"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.4)" }}>Video URL (YouTube, Vimeo, or direct .mp4)</label>
              <input className={inputCls} style={inputStyle}
                     value={form.videoUrl} onChange={e => {
                       set("videoUrl", e.target.value);
                       if (e.target.value) set("contentType", "video");
                       else set("contentType", "image");
                     }}
                     placeholder="https://youtu.be/..." data-testid="input-video-url" />
            </div>
          )}

          {/* Content guidelines */}
          <div className="rounded-2xl overflow-hidden mt-6"
               style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
            <div className="px-5 py-3"
                 style={{ background: "rgba(var(--roam-cream-rgb),0.04)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
              <div className="font-mono text-[10px] tracking-wider uppercase"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>Content guidelines</div>
            </div>
            <div className="px-5 py-4 space-y-2" style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
              {GUIDELINES.map((g, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="font-mono text-[10px] flex-shrink-0 mt-0.5"
                        style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }}>—</span>
                  <p className="font-mono text-[10px] leading-relaxed"
                     style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>{g}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input type="checkbox" id="agree-guidelines" className="mt-0.5 flex-shrink-0" style={{ accentColor: "var(--roam-electric)" }}
                   checked={form.agreedToTerms}
                   onChange={e => set("agreedToTerms", e.target.checked)}
                   data-testid="checkbox-agree-guidelines" />
            <label htmlFor="agree-guidelines" className="font-mono text-[10px] leading-relaxed cursor-pointer"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
              I confirm this {isEventMode ? "event promotion" : "ad"} complies with the roam. content guidelines and our{" "}
              <Link href="/terms"><span className="underline" style={{ color: "var(--roam-electric)" }}>Terms of Service</span></Link>.
              I understand all submissions are reviewed before going live and may be rejected if they don't meet community standards.
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
                 style={{ background: "rgba(var(--roam-ember-rgb),0.08)", border: "1px solid rgba(var(--roam-ember-rgb),0.2)" }}>
              <AlertCircle size={13} style={{ color: "var(--roam-ember)", flexShrink: 0 }} />
              <span className="font-mono text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-mono text-[12px] tracking-wider font-semibold transition-all"
                  style={{ background: loading ? "rgba(var(--roam-electric-rgb),0.5)" : "var(--roam-electric)", color: "var(--roam-forest)" }}
                  data-testid="button-submit-ad">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : <>Continue to payment — {tier.price} NZD</>}
          </button>

          <p className="font-mono text-[9px] text-center" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
            Secure payment via Stripe · All prices NZD inc. GST · No automatic renewal
          </p>
        </form>

        <div className="mt-12 text-center">
          <div className="font-serif text-[20px] font-black">
            roam<span style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
          <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
            Questions? advertising@letsroam.life
          </p>
        </div>

      </div>
    </div>
  );
}
