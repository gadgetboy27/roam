import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "What information we collect",
    content: [
      "Account details you provide when signing up: name, email address, date of birth, gender, and location.",
      "Profile content you choose to share: photos, adventure tags, tagline, and bio information.",
      "Adventure Fingerprint data: the activity preferences and style indicators you select.",
      "Usage data: which profiles you view, swipe on, or match with, and messages you send within the app.",
      "Verification data: if you choose to verify your identity, Stripe Identity processes your government-issued ID and selfie on their secure servers. roam. receives only a verified/not verified result — we never see or store your ID documents.",
      "Payment information: if you subscribe to Adventurer tier, Stripe handles all payment processing. roam. stores only your Stripe customer ID and subscription status — never your full card details.",
      "Device and technical data: IP address, browser type, and basic analytics to keep the app running smoothly.",
    ],
  },
  {
    title: "How we use your information",
    content: [
      "To match you with other users based on adventure compatibility and location.",
      "To display your profile to other roam. users in the discover feed.",
      "To power messaging between matched users.",
      "To process subscription payments and manage your account tier.",
      "To verify your identity if you choose that option.",
      "To send you important service communications (account confirmations, security alerts). We do not send marketing emails without your explicit consent.",
      "To improve and maintain the roam. platform.",
    ],
  },
  {
    title: "Who we share your information with",
    content: [
      "Other roam. users: your public profile (photos, name, location, adventure tags, tagline) is shown to other users in the app. Your email address, date of birth, and payment details are never shown to other users.",
      "Stripe: for payment processing (Adventurer subscriptions) and identity verification. Stripe is PCI DSS Level 1 certified. See stripe.com/privacy.",
      "Supabase: our database and authentication infrastructure provider. Your data is stored on Supabase servers. See supabase.com/privacy.",
      "We do not sell your personal information to third parties. Ever.",
      "We may disclose information if required by law or to protect the safety of our users.",
    ],
  },
  {
    title: "Photos and content",
    content: [
      "Photos you upload are stored in Supabase Storage and displayed publicly to other roam. users.",
      "By uploading photos, you confirm you own the rights to them or have permission to use them.",
      "You can delete your photos at any time from your profile.",
      "We do not use your photos to train AI models or sell them to third parties.",
    ],
  },
  {
    title: "Facebook Login",
    content: [
      "If you sign in using Facebook, we receive your name and email address from Facebook. We do not receive access to your Facebook friends list, posts, or other Facebook data.",
      "We use your Facebook email address to create and identify your roam. account.",
      "You can disconnect Facebook at any time by deleting your roam. account.",
    ],
  },
  {
    title: "Data storage and security",
    content: [
      "Your data is stored on servers provided by Supabase, which operate in compliance with GDPR and other applicable regulations.",
      "All data is transmitted over HTTPS/TLS encryption.",
      "Passwords are never stored in plain text.",
      "We retain your data for as long as your account is active. When you delete your account, your personal data is deleted within 30 days.",
    ],
  },
  {
    title: "Your rights",
    content: [
      "Access: you can view all the data on your profile at any time within the app.",
      "Correction: you can update your profile information at any time.",
      "Deletion: you can delete your account and all associated data at any time from your profile settings.",
      "Portability: contact us to request a copy of your personal data.",
      "If you are in the EU or UK, you have additional rights under GDPR/UK GDPR including the right to object to processing and lodge a complaint with a supervisory authority.",
    ],
  },
  {
    title: "Children",
    content: [
      "roam. is intended for users aged 18 and over. We do not knowingly collect information from anyone under 18.",
      "If you believe a minor has created an account, please contact us immediately and we will delete it.",
    ],
  },
  {
    title: "Changes to this policy",
    content: [
      "We may update this privacy policy from time to time. We will notify you of significant changes via email or an in-app notice.",
      "The date at the top of this page shows when it was last updated.",
    ],
  },
  {
    title: "Contact us",
    content: [
      "For any privacy-related questions, data requests, or concerns, contact us at: privacy@letsroam.life",
      "roam. is operated by Swiperight Apps Aotearoa.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen relative" data-testid="page-privacy">
      <div className="topo-bg" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        <Link href="/">
          <button className="flex items-center gap-2 mb-8 font-mono text-[11px] tracking-wider uppercase transition-all"
                  style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
            <ArrowLeft size={13} />
            Back to roam.
          </button>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: "rgba(var(--roam-electric-rgb),0.12)", border: "1px solid rgba(var(--roam-electric-rgb),0.25)" }}>
            <Shield size={16} style={{ color: "var(--roam-electric)" }} />
          </div>
          <div>
            <h1 className="font-serif text-[28px] font-black leading-tight">
              Privacy <span style={{ color: "var(--roam-electric)" }}>Policy</span>
            </h1>
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-wider mb-8"
           style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
          Last updated: 1 April 2026 · Effective immediately
        </p>

        <div className="font-mono text-[12px] leading-relaxed mb-8 p-4 rounded-2xl"
             style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.7)" }}>
          roam. is built on the belief that trust matters as much as adventure. This policy explains what personal information we collect, how we use it, and the choices you have. We've written it in plain language — no legalese.
        </div>

        <div className="space-y-6">
          {SECTIONS.map((section, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
                 style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
              <div className="px-5 py-3.5"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.04)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                <h2 className="font-mono text-[11px] tracking-wider uppercase font-semibold"
                    style={{ color: "var(--roam-electric)" }}>
                  {i + 1}. {section.title}
                </h2>
              </div>
              <div className="px-5 py-4 space-y-2.5"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
                {section.content.map((item, j) => (
                  <div key={j} className="flex gap-2.5">
                    <span className="font-mono text-[10px] mt-0.5 flex-shrink-0"
                          style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }}>—</span>
                    <p className="font-mono text-[11px] leading-relaxed"
                       style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 mb-4 text-center">
          <div className="font-serif text-[20px] font-black">
            roam<span style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
          <div className="font-mono text-[8px] tracking-[2px] uppercase mt-0.5"
               style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
            adventure matching · letsroam.life
          </div>
        </div>

      </div>
    </div>
  );
}
