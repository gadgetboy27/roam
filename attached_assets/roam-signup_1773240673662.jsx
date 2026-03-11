import { useState } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap');`;

const CSS = `
:root {
  --c-bg:       #0e1a0d;
  --c-surface:  #172116;
  --c-surface2: #1e2d1c;
  --c-border:   rgba(242,237,227,0.07);
  --c-border2:  rgba(242,237,227,0.14);
  --c-cream:    #f2ede3;
  --c-sand:     #c9bfa8;
  --c-muted:    rgba(242,237,227,0.38);
  --c-electric: #c8e64a;
  --c-ember:    #e8621a;
  --c-sky:      #7db8d4;
  --f-display:  'Playfair Display', Georgia, serif;
  --f-mono:     'DM Mono', monospace;
  --f-body:     'Outfit', sans-serif;
  --r-sm: 10px; --r-md: 16px; --r-lg: 22px;
  --shadow: 0 8px 40px rgba(0,0,0,0.5);
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--c-bg);color:var(--c-cream);font-family:var(--f-body);min-height:100vh;}

.topo{position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:
    repeating-linear-gradient(0deg,transparent,transparent 47px,rgba(255,255,255,0.011) 48px),
    repeating-linear-gradient(90deg,transparent,transparent 47px,rgba(255,255,255,0.011) 48px);}

.page{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;}

/* ── HERO SPLIT ── */
.hero{
  position:relative;height:260px;overflow:hidden;flex-shrink:0;
}
.hero-imgs{
  display:grid;grid-template-columns:1fr 1fr 1fr;height:100%;gap:2px;
}
.hero-img{overflow:hidden;}
.hero-img img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.55);}
.hero-overlay{
  position:absolute;inset:0;
  background:linear-gradient(to bottom, transparent 30%, rgba(14,26,13,0.97) 100%);
}
.hero-text{
  position:absolute;bottom:24px;left:0;right:0;text-align:center;
}
.hero-logo{font-family:var(--f-display);font-size:48px;font-weight:900;letter-spacing:-2px;line-height:1;}
.hero-logo span{color:var(--c-electric);}
.hero-tagline{font-family:var(--f-mono);font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--c-sand);margin-top:6px;}

/* ── FORM CONTAINER ── */
.form-wrap{
  flex:1;padding:28px 20px 40px;max-width:480px;margin:0 auto;width:100%;
}

/* Step indicator */
.steps{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:28px;}
.step-dot{
  width:28px;height:28px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--f-mono);font-size:11px;font-weight:500;
  border:1.5px solid var(--c-border2);color:var(--c-muted);
  transition:all .3s;flex-shrink:0;
}
.step-dot.done{background:var(--c-electric);border-color:var(--c-electric);color:var(--c-bg);}
.step-dot.active{border-color:var(--c-electric);color:var(--c-electric);}
.step-line{flex:1;max-width:36px;height:1px;background:var(--c-border2);margin:0 4px;}
.step-line.done{background:var(--c-electric);}

/* Section headings */
.form-title{font-family:var(--f-display);font-size:26px;font-weight:900;margin-bottom:4px;line-height:1.1;}
.form-title em{color:var(--c-electric);font-style:italic;}
.form-sub{font-size:13px;color:var(--c-muted);margin-bottom:22px;line-height:1.6;}

/* Inputs */
.field{margin-bottom:14px;}
.field label{display:block;font-family:var(--f-mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--c-muted);margin-bottom:7px;}
.field input, .field select{
  width:100%;padding:13px 15px;border-radius:var(--r-md);
  background:var(--c-surface);border:1px solid var(--c-border2);
  color:var(--c-cream);font-family:var(--f-body);font-size:14px;
  outline:none;transition:border-color .2s;
  -webkit-appearance:none;
}
.field input:focus, .field select:focus{border-color:var(--c-electric);}
.field input::placeholder{color:var(--c-muted);}
.field select option{background:var(--c-surface);}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}

/* ── TIER CARDS ── */
.tier-group{display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}
.tier-card{
  border-radius:var(--r-lg);border:1.5px solid var(--c-border2);
  background:var(--c-surface);cursor:pointer;
  transition:all .2s;overflow:hidden;
  position:relative;
}
.tier-card:hover{border-color:rgba(200,230,74,.35);}
.tier-card.selected{border-color:var(--c-electric);background:var(--c-surface2);}
.tier-card.selected::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--c-electric);border-radius:3px 0 0 3px;
}
.tier-inner{padding:15px 16px;}
.tier-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.tier-left{flex:1;}
.tier-name{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;}
.tier-badge{
  font-family:var(--f-mono);font-size:8px;letter-spacing:.8px;text-transform:uppercase;
  padding:2px 7px;border-radius:8px;
}
.tier-badge.free{background:rgba(125,184,212,.15);color:var(--c-sky);}
.tier-badge.popular{background:rgba(200,230,74,.15);color:var(--c-electric);}
.tier-badge.pro{background:rgba(232,98,26,.15);color:var(--c-ember);}
.tier-price{font-family:var(--f-display);font-size:22px;font-weight:700;line-height:1;text-align:right;white-space:nowrap;}
.tier-price sub{font-family:var(--f-mono);font-size:10px;color:var(--c-muted);font-weight:400;display:block;margin-top:2px;}
.tier-desc{font-size:12px;color:var(--c-muted);margin-top:6px;line-height:1.5;}
.tier-features{
  margin-top:12px;padding-top:12px;border-top:1px solid var(--c-border);
  display:flex;flex-direction:column;gap:5px;
}
.tier-feat{font-size:12px;color:rgba(242,237,227,.7);display:flex;align-items:baseline;gap:7px;}
.feat-tick{color:var(--c-electric);font-size:11px;flex-shrink:0;}
.feat-tick.sky{color:var(--c-sky);}
.feat-tick.muted{color:var(--c-muted);}

/* Contributor callout */
.contrib-callout{
  background:rgba(200,230,74,.06);border:1px solid rgba(200,230,74,.2);
  border-radius:var(--r-md);padding:14px 15px;margin-bottom:20px;
  display:flex;gap:11px;align-items:flex-start;
}
.contrib-icon{font-size:20px;flex-shrink:0;margin-top:1px;}
.contrib-text{font-size:12px;color:rgba(242,237,227,.7);line-height:1.6;}
.contrib-text strong{color:var(--c-electric);display:block;margin-bottom:3px;font-size:13px;}

/* ── CONSENT CHECKBOXES ── */
.consent-group{display:flex;flex-direction:column;gap:10px;margin-bottom:22px;}
.consent-item{
  display:flex;gap:12px;align-items:flex-start;padding:13px 14px;
  border-radius:var(--r-md);background:var(--c-surface);border:1px solid var(--c-border);
  cursor:pointer;transition:border-color .2s;
}
.consent-item:hover{border-color:var(--c-border2);}
.consent-item.checked{border-color:rgba(200,230,74,.3);}
.consent-item.required.unchecked-warn{border-color:rgba(232,98,26,.4);}

.checkbox{
  width:20px;height:20px;border-radius:5px;flex-shrink:0;
  border:1.5px solid var(--c-border2);background:transparent;
  display:flex;align-items:center;justify-content:center;
  transition:all .2s;margin-top:1px;
}
.checkbox.on{background:var(--c-electric);border-color:var(--c-electric);}
.checkbox.on::after{content:'✓';font-size:12px;color:var(--c-bg);font-weight:700;}

.consent-body{}
.consent-label{font-size:13px;font-weight:500;margin-bottom:3px;display:flex;align-items:center;gap:7px;}
.req-tag{font-family:var(--f-mono);font-size:8px;letter-spacing:.5px;text-transform:uppercase;color:var(--c-ember);background:rgba(232,98,26,.12);padding:2px 6px;border-radius:6px;}
.opt-tag{font-family:var(--f-mono);font-size:8px;letter-spacing:.5px;text-transform:uppercase;color:var(--c-sky);background:rgba(125,184,212,.1);padding:2px 6px;border-radius:6px;}
.consent-desc{font-size:11px;color:var(--c-muted);line-height:1.55;}
.consent-link{color:var(--c-electric);text-decoration:underline;cursor:pointer;font-size:11px;}

/* Photo licensing special */
.license-box{
  margin-top:10px;border-radius:var(--r-sm);padding:11px 13px;
  background:rgba(200,230,74,.06);border:1px solid rgba(200,230,74,.15);
}
.license-title{font-family:var(--f-mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--c-electric);margin-bottom:7px;}
.license-terms{display:flex;flex-direction:column;gap:5px;}
.license-term{font-size:11px;color:rgba(242,237,227,.65);display:flex;gap:7px;align-items:baseline;line-height:1.4;}
.license-term span{color:var(--c-electric);flex-shrink:0;}

/* Warn text */
.warn-text{font-size:11px;color:var(--c-ember);font-family:var(--f-mono);margin-top:8px;letter-spacing:.3px;}

/* Submit */
.submit-btn{
  width:100%;padding:16px;border-radius:var(--r-lg);
  background:var(--c-electric);border:none;
  color:var(--c-bg);font-family:var(--f-mono);font-size:13px;
  text-transform:uppercase;letter-spacing:1.2px;font-weight:500;
  cursor:pointer;transition:all .25s;margin-bottom:14px;
}
.submit-btn:hover:not(:disabled){background:#d4f050;transform:translateY(-2px);box-shadow:0 8px 24px rgba(200,230,74,.3);}
.submit-btn:disabled{opacity:.4;cursor:default;transform:none;}
.signin-link{text-align:center;font-size:13px;color:var(--c-muted);}
.signin-link a{color:var(--c-electric);cursor:pointer;text-decoration:underline;}

/* ── SUCCESS ── */
.success-wrap{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:40px 24px;text-align:center;
}
.success-icon{font-size:56px;margin-bottom:20px;animation:pop .5s cubic-bezier(.175,.885,.32,1.275) both;}
@keyframes pop{from{transform:scale(.5);opacity:0;}to{transform:scale(1);opacity:1;}}
.success-title{font-family:var(--f-display);font-size:34px;font-weight:900;margin-bottom:10px;line-height:1.1;}
.success-title em{color:var(--c-electric);font-style:italic;}
.success-sub{font-size:14px;color:var(--c-muted);line-height:1.7;max-width:320px;}
.success-tier{
  margin-top:24px;padding:14px 22px;border-radius:var(--r-lg);
  background:var(--c-surface);border:1px solid rgba(200,230,74,.25);
  font-family:var(--f-mono);font-size:12px;color:var(--c-electric);letter-spacing:.5px;
}
.success-next{
  margin-top:28px;display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;
}
.next-btn{
  padding:14px;border-radius:var(--r-md);border:none;
  background:var(--c-electric);color:var(--c-bg);
  font-family:var(--f-mono);font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:500;
  cursor:pointer;transition:all .2s;
}
.next-btn:hover{background:#d4f050;}
.next-btn.ghost{background:transparent;border:1px solid var(--c-border2);color:var(--c-sand);}
.next-btn.ghost:hover{border-color:var(--c-border2);background:var(--c-surface);}

@keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
.a1{animation:fadeUp .4s ease both;}
.a2{animation:fadeUp .4s .08s ease both;}
.a3{animation:fadeUp .4s .16s ease both;}
.a4{animation:fadeUp .4s .24s ease both;}
.a5{animation:fadeUp .4s .32s ease both;}
`;

const TIERS = [
  {
    id: "free",
    name: "Explorer",
    badge: "free",
    badgeLabel: "Free",
    price: "$0",
    priceSub: "forever",
    desc: "Get started, find your people, see if the vibe is right.",
    features: [
      { tick: "✓", text: "Up to 9 photos" },
      { tick: "✓", text: "See your adventure DNA matches" },
      { tick: "✓", text: "3 match connections per month" },
      { tick: "✗", muted: true, text: "Messaging locked (read only)" },
      { tick: "✗", muted: true, text: "No Bucket List matching" },
    ],
  },
  {
    id: "explorer",
    name: "Adventurer",
    badge: "popular",
    badgeLabel: "Most popular",
    price: "$12",
    priceSub: "NZD / month",
    desc: "Unlimited matches, full messaging, and the Almost Met radar.",
    features: [
      { tick: "✓", text: "Unlimited photo uploads" },
      { tick: "✓", text: "Full messaging with all matches" },
      { tick: "✓", text: "Bucket List destination matching" },
      { tick: "✓", text: "⚡ Almost Met alerts" },
      { tick: "✓", text: "See who liked your profile" },
    ],
  },
  {
    id: "contributor",
    name: "Contributor",
    badge: "pro",
    badgeLabel: "Free access",
    price: "Free",
    priceSub: "licence trade",
    desc: "Get full Adventurer access free — in exchange for a non-exclusive licence to your photos.",
    features: [
      { tick: "✓", sky: true, text: "Everything in Adventurer — free" },
      { tick: "✓", sky: true, text: "Photos may be licensed to travel brands & tourism" },
      { tick: "✓", sky: true, text: "You keep full ownership — non-exclusive only" },
      { tick: "✓", sky: true, text: "Earn royalties if a photo sells above $200 NZD" },
      { tick: "✓", sky: true, text: "Opt out any photo at any time" },
    ],
  },
];

const CONSENTS = [
  {
    id: "terms",
    required: true,
    label: "Terms of Service & Privacy Policy",
    desc: "I agree to the ROAM Terms of Service and Privacy Policy, including how my data is stored and used to power adventure matching.",
    linkText: "Read full terms →",
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

export default function RoamSignup() {
  const [step, setStep] = useState(1); // 1=account, 2=tier, 3=consent, 4=done
  const [form, setForm] = useState({ name: "", email: "", password: "", dob: "", gender: "", location: "" });
  const [tier, setTier] = useState("explorer");
  const [checked, setChecked] = useState({});
  const [warnConsent, setWarnConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));

  const step1Valid = form.name && form.email && form.password && form.dob;
  const requiredConsents = CONSENTS.filter(c => c.required).map(c => c.id);
  const consentValid = requiredConsents.every(id => checked[id]);

  const handleSubmit = () => {
    if (!consentValid) { setWarnConsent(true); return; }
    setSubmitted(true);
    setStep(4);
  };

  const selectedTierData = TIERS.find(t => t.id === tier);

  if (step === 4) return (
    <>
      <style>{FONTS}{CSS}</style>
      <div className="topo" />
      <div className="page">
        <div className="success-wrap">
          <div className="success-icon">🧭</div>
          <div className="success-title a1">Welcome to<br/><em>roam.</em></div>
          <div className="success-sub a2">Your adventure profile is being built. Upload your first photos and let the AI find your people.</div>
          <div className="success-tier a3">
            {selectedTierData.name} plan · {selectedTierData.price} {selectedTierData.priceSub}
            {tier === "contributor" && " · Photo contributor ✓"}
          </div>
          <div className="success-next a4">
            <button className="next-btn" onClick={() => window.location.reload()}>✦ Upload my first photos</button>
            <button className="next-btn ghost" onClick={() => window.location.reload()}>Browse matches first</button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div className="topo" />
      <div className="page">

        {/* Hero */}
        <div className="hero">
          <div className="hero-imgs">
            {[
              "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=75&fit=crop",
              "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=75&fit=crop",
              "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=75&fit=crop",
            ].map((u, i) => (
              <div className="hero-img" key={i}><img src={u} alt="" /></div>
            ))}
          </div>
          <div className="hero-overlay" />
          <div className="hero-text">
            <div className="hero-logo">roam<span>.</span></div>
            <div className="hero-tagline">match on where you've been</div>
          </div>
        </div>

        <div className="form-wrap">
          {/* Steps */}
          <div className="steps a1">
            {[1,2,3].map((n, i) => (
              <>
                <div key={n} className={`step-dot ${step > n ? "done" : step === n ? "active" : ""}`}>
                  {step > n ? "✓" : n}
                </div>
                {i < 2 && <div key={`l${n}`} className={`step-line ${step > n+1 ? "done" : ""}`} />}
              </>
            ))}
          </div>

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <div className="a1">
              <div className="form-title">Create your<br/><em>account</em></div>
              <div className="form-sub">Takes 60 seconds. No bio, no questionnaire — your photos do the talking.</div>

              <div className="field">
                <label>Full name</label>
                <input placeholder="Your name" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => set("password", e.target.value)} />
              </div>
              <div className="row2">
                <div className="field">
                  <label>Date of birth</label>
                  <input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} />
                </div>
                <div className="field">
                  <label>I identify as</label>
                  <select value={form.gender} onChange={e => set("gender", e.target.value)}>
                    <option value="">Select…</option>
                    <option>Woman</option>
                    <option>Man</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Base location (city)</label>
                <input placeholder="e.g. Auckland, NZ" value={form.location} onChange={e => set("location", e.target.value)} />
              </div>

              <button className="submit-btn" disabled={!step1Valid} onClick={() => setStep(2)}>
                Continue → Choose your plan
              </button>
              <div className="signin-link">Already have an account? <a>Sign in</a></div>
            </div>
          )}

          {/* ── STEP 2: Tier ── */}
          {step === 2 && (
            <div className="a1">
              <div className="form-title"><em>Choose</em> your<br/>adventure plan</div>
              <div className="form-sub">You can change or cancel anytime. Contributor access is genuinely free — we just need your photos.</div>

              <div className="tier-group">
                {TIERS.map(t => (
                  <div
                    key={t.id}
                    className={`tier-card ${tier === t.id ? "selected" : ""}`}
                    onClick={() => setTier(t.id)}
                  >
                    <div className="tier-inner">
                      <div className="tier-top">
                        <div className="tier-left">
                          <div className="tier-name">
                            {t.name}
                            <span className={`tier-badge ${t.badge}`}>{t.badgeLabel}</span>
                          </div>
                          <div className="tier-desc">{t.desc}</div>
                        </div>
                        <div className="tier-price">{t.price}<sub>{t.priceSub}</sub></div>
                      </div>
                      <div className="tier-features">
                        {t.features.map((f, i) => (
                          <div className="tier-feat" key={i}>
                            <span className={`feat-tick ${f.sky ? "sky" : f.muted ? "muted" : ""}`}>{f.tick}</span>
                            <span style={{color: f.muted ? "var(--c-muted)" : undefined}}>{f.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {tier === "contributor" && (
                <div className="contrib-callout a1">
                  <span className="contrib-icon">📸</span>
                  <div className="contrib-text">
                    <strong>How photo licensing works</strong>
                    Your photos stay yours. We may pitch them non-exclusively to travel brands, NZ tourism operators, and adventure gear companies. You earn a royalty cut if a photo sells above $200 NZD. You can opt out any individual photo at any time from your profile settings.
                  </div>
                </div>
              )}

              <button className="submit-btn" onClick={() => setStep(3)}>
                Continue → Review & sign
              </button>
              <button
                onClick={() => setStep(1)}
                style={{width:"100%",background:"none",border:"none",color:"var(--c-muted)",fontFamily:"var(--f-mono)",fontSize:11,cursor:"pointer",letterSpacing:".5px",textDecoration:"underline",padding:"4px"}}
              >← back</button>
            </div>
          )}

          {/* ── STEP 3: Consent ── */}
          {step === 3 && (
            <div className="a1">
              <div className="form-title">Almost <em>there</em></div>
              <div className="form-sub">Read and tick each item below. The required ones must be checked to create your account.</div>

              <div className="consent-group">
                {CONSENTS.map(c => {
                  // hide license box if not contributor
                  if (c.id === "photo_license" && tier !== "contributor") return null;
                  const isChecked = !!checked[c.id];
                  const warnThis = warnConsent && c.required && !isChecked;
                  return (
                    <div
                      key={c.id}
                      className={`consent-item ${isChecked ? "checked" : ""} ${warnThis ? "required unchecked-warn" : ""}`}
                      onClick={() => { toggle(c.id); setWarnConsent(false); }}
                    >
                      <div className={`checkbox ${isChecked ? "on" : ""}`} />
                      <div className="consent-body">
                        <div className="consent-label">
                          {c.label}
                          {c.required ? <span className="req-tag">Required</span> : <span className="opt-tag">Optional</span>}
                        </div>
                        <div className="consent-desc">{c.desc}</div>
                        {c.linkText && <div className="consent-link" style={{marginTop:4}}>{c.linkText}</div>}
                        {c.isLicense && isChecked && (
                          <div className="license-box">
                            <div className="license-title">What you're agreeing to</div>
                            <div className="license-terms">
                              {[
                                "Non-exclusive — you keep full ownership",
                                "We may sublicense to travel & tourism brands",
                                "Royalties paid for sales above $200 NZD",
                                "Opt out any photo, any time, no questions",
                                "AI-rejected photos are never licensed",
                              ].map((t, i) => <div className="license-term" key={i}><span>→</span>{t}</div>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {warnConsent && (
                <div className="warn-text a1">⚠ Please check the required items above to continue.</div>
              )}

              <button className="submit-btn" onClick={handleSubmit} style={{marginTop:16}}>
                ✦ Create my ROAM account
              </button>
              <button
                onClick={() => setStep(2)}
                style={{width:"100%",background:"none",border:"none",color:"var(--c-muted)",fontFamily:"var(--f-mono)",fontSize:11,cursor:"pointer",letterSpacing:".5px",textDecoration:"underline",padding:"4px"}}
              >← back</button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
