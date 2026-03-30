import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Check, X, Camera, Compass } from "lucide-react";
import { SiFacebook } from "react-icons/si";

const TIERS = [
  {
    id: "free" as const,
    name: "Explorer",
    badge: "Free",
    badgeColor: "sky",
    price: "$0",
    priceSub: "forever",
    desc: "Get started, find your people, see if the vibe is right.",
    features: [
      { included: true, text: "Up to 9 photos" },
      { included: true, text: "See your adventure DNA matches" },
      { included: true, text: "3 match connections per month" },
      { included: false, text: "Messaging locked (read only)" },
      { included: false, text: "No Bucket List matching" },
    ],
  },
  {
    id: "adventurer" as const,
    name: "Adventurer",
    badge: "Most popular",
    badgeColor: "electric",
    price: "$12",
    priceSub: "NZD / month",
    desc: "Unlimited matches, full messaging, and the Almost Met radar.",
    features: [
      { included: true, text: "Unlimited photo uploads" },
      { included: true, text: "Full messaging with all matches" },
      { included: true, text: "Bucket List destination matching" },
      { included: true, text: "Almost Met alerts" },
      { included: true, text: "See who liked your profile" },
    ],
  },
  {
    id: "contributor" as const,
    name: "Contributor",
    badge: "Free access",
    badgeColor: "ember",
    price: "Free",
    priceSub: "licence trade",
    desc: "Get full Adventurer access free — in exchange for a non-exclusive licence to your photos.",
    features: [
      { included: true, text: "Everything in Adventurer — free", sky: true },
      { included: true, text: "Photos may be licensed to travel brands", sky: true },
      { included: true, text: "You keep full ownership — non-exclusive only", sky: true },
      { included: true, text: "Earn royalties if a photo sells above $200 NZD", sky: true },
      { included: true, text: "Opt out any photo at any time", sky: true },
    ],
  },
];

const CONSENTS = [
  {
    id: "terms",
    required: true,
    label: "Terms of Service & Privacy Policy",
    desc: "I agree to the ROAM Terms of Service and Privacy Policy, including how my data is stored and used to power adventure matching.",
    linkText: "Read full terms",
  },
  {
    id: "age",
    required: true,
    label: "Age confirmation",
    desc: "I confirm I am 18 years of age or older.",
  },
  {
    id: "authentic",
    required: true,
    label: "Authentic content pledge",
    desc: "I agree to only post photos I personally took or appear in. I will not post AI-generated images, stock photos, or images manipulated to misrepresent reality.",
  },
  {
    id: "photo_license",
    required: false,
    label: "Photo licensing (Contributor tier only)",
    desc: "I grant ROAM a non-exclusive, worldwide licence to sublicense my approved photos to third-party travel brands, tourism operators, and stock libraries.",
    isLicense: true,
  },
  {
    id: "marketing",
    required: false,
    label: "Adventure inspiration emails",
    desc: "Send me occasional emails about new features, Bucket List destination matches, and adventure ideas. Unsubscribe anytime.",
  },
];

const HERO_URLS = [
  "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=75&fit=crop",
  "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=75&fit=crop",
  "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=75&fit=crop",
];

const ETHNICITIES = [
  "Prefer not to say",
  "Asian",
  "East Asian",
  "Hispanic",
  "Indigenous / First Nations",
  "Latino",
  "Māori",
  "Middle Eastern",
  "Mixed / Multiracial",
  "New Zealander",
  "North African",
  "Pacific Islander",
  "South Asian",
  "Southeast Asian",
  "Other",
];

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[10px] tracking-[1px] uppercase mb-1.5" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "var(--roam-moss)",
  border: "1px solid rgba(var(--roam-cream-rgb),0.14)",
  color: "var(--roam-cream)",
};

export default function Signup() {
  const [, navigate] = useLocation();
  const { refresh, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) navigate("/discover");
  }, [user, authLoading, navigate]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", email: "", password: "", dob: "",
    gender: "", ethnicity: "", location: "", tagline: "",
  });
  const [tier, setTier] = useState<"free" | "adventurer" | "contributor">("adventurer");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [warnConsent, setWarnConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (id: string) => { setChecked(c => ({ ...c, [id]: !c[id] })); setWarnConsent(false); };

  const handleFacebook = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const step1Valid = form.name && form.email && form.password && form.password.length >= 8 && form.dob;
  const requiredConsents = CONSENTS.filter(c => c.required).map(c => c.id);
  const consentValid = requiredConsents.every(id => checked[id]);
  const taglineLen = form.tagline.length;

  const handleSubmit = async () => {
    if (!consentValid) { setWarnConsent(true); return; }
    setSubmitting(true);
    setError("");
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (signUpError) throw new Error(signUpError.message);

      const token = signUpData.session?.access_token;
      if (!token) throw new Error("Signup succeeded but no session returned — please check your email to confirm, then sign in.");

      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          dob: form.dob,
          gender: form.gender,
          ethnicity: form.ethnicity,
          location: form.location,
          tagline: form.tagline,
          tier,
          photoLicenseAgreed: tier === "contributor" && !!checked["photo_license"],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Profile creation failed" }));
        throw new Error(err.message);
      }
      await refresh();
      setStep(4);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
    setSubmitting(false);
  };

  const selectedTierData = TIERS.find(t => t.id === tier)!;

  if (step === 4) {
    return (
      <div className="min-h-screen relative" data-testid="page-signup-success">
        <div className="topo-bg" />
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 animate-pop">
            <Compass size={56} style={{ color: "var(--roam-electric)" }} />
          </div>
          <h1 className="font-serif text-4xl font-black mb-3 animate-fade-up">
            Welcome to<br /><span className="italic" style={{ color: "var(--roam-electric)" }}>roam.</span>
          </h1>
          <p className="text-sm max-w-xs mb-6 animate-fade-up-1" style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
            Your adventure profile is ready. Upload your first photos and let the AI find your people.
          </p>
          <div className="font-mono text-xs px-5 py-3 rounded-2xl mb-8 animate-fade-up-2"
               style={{ background: "var(--roam-moss)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)", color: "var(--roam-electric)" }}>
            {selectedTierData.name} plan{tier === "contributor" ? " · Photo contributor" : ""}
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs animate-fade-up-3">
            <button className="py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase font-medium transition-all"
                    style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                    onClick={() => navigate("/upload")}
                    data-testid="button-upload-photos">
              Upload my first photos
            </button>
            <button className="py-3.5 rounded-2xl text-sm font-mono tracking-wider uppercase transition-all"
                    style={{ background: "transparent", border: "1px solid rgba(var(--roam-cream-rgb),0.12)", color: "var(--roam-sand)" }}
                    onClick={() => navigate("/discover")}
                    data-testid="button-browse-matches">
              Browse matches first
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="page-signup">
      <div className="topo-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="relative h-48 overflow-hidden flex-shrink-0">
          <div className="grid grid-cols-3 h-full gap-0.5">
            {HERO_URLS.map((u, i) => (
              <div key={i} className="overflow-hidden">
                <img src={u} alt="" className="w-full h-full object-cover brightness-[0.55]" loading="lazy"
                     draggable={false} onContextMenu={e => e.preventDefault()} />
              </div>
            ))}
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(var(--roam-forest-rgb),0.97) 100%)" }} />
          <div className="absolute bottom-5 left-0 right-0 text-center">
            <div className="font-serif text-4xl font-black tracking-tight">
              roam<span style={{ color: "var(--roam-electric)" }}>.</span>
            </div>
            <div className="font-mono text-[10px] tracking-[2.5px] uppercase mt-0.5" style={{ color: "var(--roam-sand)" }}>
              match on where you've been
            </div>
          </div>
        </div>

        <div className="flex-1 px-5 pt-6 pb-10 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-center gap-0 mb-6 animate-fade-up">
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-medium transition-all flex-shrink-0"
                     style={{
                       background: step > n ? "var(--roam-electric)" : "transparent",
                       borderColor: step >= n ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.14)",
                       border: step > n ? "none" : "1.5px solid",
                       color: step > n ? "var(--roam-forest)" : step === n ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.38)"
                     }}
                     data-testid={`step-dot-${n}`}>
                  {step > n ? <Check size={12} /> : n}
                </div>
                {i < 2 && (
                  <div className="w-9 h-px mx-1"
                       style={{ background: step > n ? "var(--roam-electric)" : "rgba(var(--roam-cream-rgb),0.14)" }} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="animate-fade-up">
              <h2 className="font-serif text-[24px] font-black leading-tight mb-1">
                Create your <span className="italic" style={{ color: "var(--roam-electric)" }}>account</span>
              </h2>
              <p className="text-[13px] mb-5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Takes 60 seconds. Your photos do the talking.
              </p>

              <button
                type="button"
                onClick={handleFacebook}
                className="w-full py-3.5 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium flex items-center justify-center gap-2.5 mb-4 transition-all"
                style={{ background: "#1877f2", color: "#fff" }}
                data-testid="button-facebook-signup">
                <SiFacebook size={16} />
                Continue with Facebook
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.08)" }} />
                <span className="font-mono text-[10px] tracking-wider" style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>or sign up with email</span>
                <div className="flex-1 h-px" style={{ background: "rgba(var(--roam-cream-rgb),0.08)" }} />
              </div>

              <div className="space-y-3">
                <InputField label="Full name">
                  <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                         placeholder="Your name" value={form.name} onChange={e => set("name", e.target.value)}
                         data-testid="input-name" />
                </InputField>

                <InputField label="Email">
                  <input type="email" className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                         placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)}
                         data-testid="input-email" />
                </InputField>

                <InputField label="Password">
                  <input type="password" className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                         placeholder="Min. 8 characters" value={form.password} onChange={e => set("password", e.target.value)}
                         data-testid="input-password" />
                </InputField>

                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Date of birth">
                    <input type="date" className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                           value={form.dob} onChange={e => set("dob", e.target.value)}
                           data-testid="input-dob" />
                  </InputField>
                  <InputField label="I identify as">
                    <select className="w-full py-3 px-4 rounded-2xl text-sm outline-none appearance-none" style={inputStyle}
                            value={form.gender} onChange={e => set("gender", e.target.value)}
                            data-testid="select-gender">
                      <option value="">Select...</option>
                      <option>Woman</option>
                      <option>Man</option>
                      <option>Non-binary</option>
                      <option>Prefer not to say</option>
                    </select>
                  </InputField>
                </div>

                <InputField label="Ethnicity (optional)">
                  <select className="w-full py-3 px-4 rounded-2xl text-sm outline-none appearance-none" style={inputStyle}
                          value={form.ethnicity} onChange={e => set("ethnicity", e.target.value)}
                          data-testid="select-ethnicity">
                    <option value="">Prefer not to say</option>
                    {ETHNICITIES.map(e => <option key={e}>{e}</option>)}
                  </select>
                </InputField>

                <InputField label="Base location (city)">
                  <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={inputStyle}
                         placeholder="e.g. Auckland, NZ" value={form.location} onChange={e => set("location", e.target.value)}
                         data-testid="input-location" />
                </InputField>

                <InputField label={`One-line tagline (${taglineLen}/60)`}>
                  <input className="w-full py-3 px-4 rounded-2xl text-sm outline-none" style={{
                           ...inputStyle,
                           borderColor: taglineLen > 60 ? "rgba(232,98,26,0.6)" : "rgba(var(--roam-cream-rgb),0.14)",
                         }}
                         placeholder="e.g. Always chasing the next summit or night market"
                         value={form.tagline}
                         maxLength={60}
                         onChange={e => set("tagline", e.target.value)}
                         data-testid="input-tagline" />
                  {taglineLen > 0 && (
                    <p className="text-[10px] font-mono mt-1.5 text-right"
                       style={{ color: taglineLen > 55 ? "var(--roam-ember)" : "rgba(var(--roam-cream-rgb),0.3)" }}>
                      {60 - taglineLen} left
                    </p>
                  )}
                </InputField>
              </div>

              {error && (
                <div className="mt-4 text-xs font-mono py-2 px-3 rounded-xl"
                     style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}>
                  {error}
                </div>
              )}

              <button className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium mt-5 transition-all disabled:opacity-40"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                      disabled={!step1Valid} onClick={() => { setStep(2); setError(""); }}
                      data-testid="button-step1-continue">
                Continue &rarr; Choose your plan
              </button>
              <div className="text-center mt-4 text-[13px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Already have an account?{" "}
                <button onClick={() => navigate("/login")} className="underline" style={{ color: "var(--roam-electric)" }} data-testid="link-signin">
                  Sign in
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-up">
              <h2 className="font-serif text-[24px] font-black leading-tight mb-1">
                <span className="italic" style={{ color: "var(--roam-electric)" }}>Choose</span> your<br />adventure plan
              </h2>
              <p className="text-[13px] mb-5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                You can change or cancel anytime. Contributor access is genuinely free.
              </p>

              <div className="space-y-2.5 mb-5">
                {TIERS.map(t => (
                  <div key={t.id}
                       className="rounded-[22px] cursor-pointer transition-all relative overflow-hidden"
                       style={{
                         background: tier === t.id ? "var(--roam-surface)" : "var(--roam-moss)",
                         border: tier === t.id ? "1.5px solid var(--roam-electric)" : "1.5px solid rgba(var(--roam-cream-rgb),0.07)",
                       }}
                       onClick={() => setTier(t.id)}
                       data-testid={`tier-card-${t.id}`}>
                    {tier === t.id && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: "var(--roam-electric)" }} />}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-[15px] font-semibold">
                            {t.name}
                            <span className="font-mono text-[8px] tracking-wider uppercase py-0.5 px-2 rounded-lg"
                                  style={{
                                    background: t.badgeColor === "electric" ? "rgba(var(--roam-electric-rgb),0.15)" : t.badgeColor === "ember" ? "rgba(232,98,26,0.15)" : "rgba(var(--roam-sky-rgb),0.15)",
                                    color: t.badgeColor === "electric" ? "var(--roam-electric)" : t.badgeColor === "ember" ? "var(--roam-ember)" : "var(--roam-sky)",
                                  }}>
                              {t.badge}
                            </span>
                          </div>
                          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>{t.desc}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-serif text-[22px] font-bold">{t.price}</div>
                          <div className="font-mono text-[10px]" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>{t.priceSub}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                        {t.features.map((f, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-xs"
                               style={{ color: f.included ? "rgba(var(--roam-cream-rgb),0.7)" : "rgba(var(--roam-cream-rgb),0.3)" }}>
                            <span className="flex-shrink-0 text-[11px]"
                                  style={{ color: f.included ? ((f as any).sky ? "var(--roam-sky)" : "var(--roam-electric)") : "rgba(var(--roam-cream-rgb),0.25)" }}>
                              {f.included ? <Check size={11} /> : <X size={11} />}
                            </span>
                            {f.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {tier === "contributor" && (
                <div className="rounded-2xl p-4 mb-5 flex gap-3 animate-fade-up"
                     style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.2)" }}>
                  <Camera size={20} className="flex-shrink-0 mt-0.5" style={{ color: "var(--roam-electric)" }} />
                  <div className="text-xs leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.7)" }}>
                    <strong className="block mb-1 text-[13px]" style={{ color: "var(--roam-electric)" }}>How photo licensing works</strong>
                    Your photos stay yours. We may pitch them non-exclusively to travel brands and tourism operators.
                    You earn a royalty if a photo sells above $200 NZD.
                  </div>
                </div>
              )}

              <button className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium transition-all"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                      onClick={() => setStep(3)}
                      data-testid="button-step2-continue">
                Continue &rarr; Review &amp; sign
              </button>
              <button className="w-full mt-2 py-2 text-xs font-mono underline"
                      style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}
                      onClick={() => setStep(1)}
                      data-testid="button-step2-back">
                &larr; back
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-up">
              <h2 className="font-serif text-[24px] font-black leading-tight mb-1">
                Almost <span className="italic" style={{ color: "var(--roam-electric)" }}>there</span>
              </h2>
              <p className="text-[13px] mb-5 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>
                Read and tick each item. Required ones must be checked.
              </p>

              <div className="space-y-2.5 mb-5">
                {CONSENTS.map(c => {
                  if (c.id === "photo_license" && tier !== "contributor") return null;
                  const isChecked = !!checked[c.id];
                  const warnThis = warnConsent && c.required && !isChecked;
                  return (
                    <div key={c.id}
                         className="flex gap-3 p-3.5 rounded-2xl cursor-pointer transition-all"
                         style={{
                           background: "var(--roam-moss)",
                           border: warnThis ? "1px solid rgba(232,98,26,0.4)" : isChecked ? "1px solid rgba(var(--roam-electric-rgb),0.3)" : "1px solid rgba(var(--roam-cream-rgb),0.07)",
                         }}
                         onClick={() => toggle(c.id)}
                         data-testid={`consent-${c.id}`}>
                      <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 transition-all"
                           style={{
                             background: isChecked ? "var(--roam-electric)" : "transparent",
                             border: isChecked ? "none" : "1.5px solid rgba(var(--roam-cream-rgb),0.14)",
                           }}>
                        {isChecked && <Check size={12} style={{ color: "var(--roam-forest)" }} />}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium flex items-center gap-2 flex-wrap">
                          {c.label}
                          {c.required ? (
                            <span className="font-mono text-[8px] tracking-wider uppercase py-0.5 px-1.5 rounded-md"
                                  style={{ color: "var(--roam-ember)", background: "rgba(232,98,26,0.12)" }}>Required</span>
                          ) : (
                            <span className="font-mono text-[8px] tracking-wider uppercase py-0.5 px-1.5 rounded-md"
                                  style={{ color: "var(--roam-sky)", background: "rgba(var(--roam-sky-rgb),0.1)" }}>Optional</span>
                          )}
                        </div>
                        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}>{c.desc}</p>
                        {c.linkText && (
                          <span className="text-[11px] underline mt-1 inline-block" style={{ color: "var(--roam-electric)" }}>{c.linkText}</span>
                        )}
                        {c.isLicense && isChecked && (
                          <div className="mt-2.5 p-3 rounded-xl" style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)" }}>
                            <div className="font-mono text-[9px] tracking-[1px] uppercase mb-2" style={{ color: "var(--roam-electric)" }}>What you're agreeing to</div>
                            <div className="space-y-1.5">
                              {["Non-exclusive — you keep full ownership", "We may sublicense to travel & tourism brands", "Royalties paid for sales above $200 NZD", "Opt out any photo, any time, no questions", "AI-rejected photos are never licensed"].map((t, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px]" style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                                  <Check size={10} className="flex-shrink-0 mt-0.5" style={{ color: "var(--roam-electric)" }} />
                                  {t}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {warnConsent && (
                <div className="text-xs font-mono py-2 px-3 rounded-xl mb-4"
                     style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}>
                  Please tick all required items above.
                </div>
              )}

              {error && (
                <div className="text-xs font-mono py-2 px-3 rounded-xl mb-4"
                     style={{ background: "rgba(232,98,26,0.1)", border: "1px solid rgba(232,98,26,0.3)", color: "var(--roam-ember)" }}>
                  {error}
                </div>
              )}

              <button className="w-full py-4 rounded-2xl text-[13px] font-mono tracking-wider uppercase font-medium transition-all disabled:opacity-50"
                      style={{ background: "var(--roam-electric)", color: "var(--roam-forest)" }}
                      disabled={submitting}
                      onClick={handleSubmit}
                      data-testid="button-submit">
                {submitting ? "Creating your account..." : "Create my account →"}
              </button>
              <button className="w-full mt-2 py-2 text-xs font-mono underline"
                      style={{ color: "rgba(var(--roam-cream-rgb),0.38)" }}
                      onClick={() => setStep(2)}
                      data-testid="button-step3-back">
                &larr; back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
