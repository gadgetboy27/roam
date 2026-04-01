import { Link } from "wouter";
import { Trash2, ArrowLeft, User, Mail, Clock } from "lucide-react";

const STEPS = [
  {
    icon: User,
    title: "From inside the app",
    description: "The fastest way to delete your data is directly from your roam. account:",
    items: [
      'Sign in at letsroam.life',
      'Tap your profile icon to go to your Profile page',
      'Scroll to the bottom and tap "Delete account"',
      'Confirm the deletion — your account and all data will be permanently removed within 30 days',
    ],
  },
  {
    icon: Mail,
    title: "By email request",
    description: "If you cannot access your account or signed in via Facebook and have since lost access:",
    items: [
      'Email us at privacy@letsroam.life',
      'Use the subject line: "Data Deletion Request"',
      'Include the email address associated with your roam. account',
      'We will confirm receipt within 2 business days and complete deletion within 30 days',
    ],
  },
];

const WHAT_GETS_DELETED = [
  "Your profile: name, email, date of birth, gender, location, tagline",
  "All photos you uploaded to roam.",
  "Your Adventure Fingerprint and adventure tag preferences",
  "Your matches and all message history",
  "Your bucket list items",
  "Your subscription record (your Stripe billing will also be cancelled)",
  "Your identity verification status",
  "All other personal data associated with your account",
];

const WHAT_IS_RETAINED = [
  "Anonymised, aggregate analytics that cannot identify you (e.g. total number of users in a region)",
  "Transaction records required by law for financial/tax compliance — these contain only transaction amounts and dates, not personal profile data",
  "Any data required to be retained by New Zealand law",
];

export default function DataDeletion() {
  return (
    <div className="min-h-screen relative" data-testid="page-data-deletion">
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
               style={{ background: "rgba(var(--roam-ember-rgb),0.12)", border: "1px solid rgba(var(--roam-ember-rgb),0.25)" }}>
            <Trash2 size={16} style={{ color: "var(--roam-ember)" }} />
          </div>
          <div>
            <h1 className="font-serif text-[28px] font-black leading-tight">
              Data <span style={{ color: "var(--roam-electric)" }}>Deletion</span>
            </h1>
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-wider mb-8"
           style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
          How to request removal of your personal data from roam.
        </p>

        <div className="font-mono text-[12px] leading-relaxed mb-8 p-4 rounded-2xl"
             style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.7)" }}>
          You have the right to have your personal data deleted from roam. at any time. This page explains how to request deletion and what happens to your data.
        </div>

        <div className="space-y-5 mb-8">
          {STEPS.map((step, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
                 style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
              <div className="px-5 py-3.5 flex items-center gap-3"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.04)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
                <step.icon size={14} style={{ color: "var(--roam-electric)" }} />
                <h2 className="font-mono text-[11px] tracking-wider uppercase font-semibold"
                    style={{ color: "var(--roam-electric)" }}>
                  Option {i + 1}: {step.title}
                </h2>
              </div>
              <div className="px-5 py-4"
                   style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
                <p className="font-mono text-[11px] leading-relaxed mb-3"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
                  {step.description}
                </p>
                <ol className="space-y-2">
                  {step.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span className="font-mono text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={{ color: "rgba(var(--roam-electric-rgb),0.6)" }}>
                        {j + 1}.
                      </span>
                      <span className="font-mono text-[11px] leading-relaxed"
                            style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden mb-5"
             style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
          <div className="px-5 py-3.5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.04)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
            <h2 className="font-mono text-[11px] tracking-wider uppercase font-semibold"
                style={{ color: "var(--roam-electric)" }}>
              What gets deleted
            </h2>
          </div>
          <div className="px-5 py-4 space-y-2.5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            {WHAT_GETS_DELETED.map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="font-mono text-[10px] mt-0.5 flex-shrink-0"
                      style={{ color: "rgba(var(--roam-electric-rgb),0.5)" }}>✓</span>
                <p className="font-mono text-[11px] leading-relaxed"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.6)" }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden mb-8"
             style={{ border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
          <div className="px-5 py-3.5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.04)", borderBottom: "1px solid rgba(var(--roam-cream-rgb),0.06)" }}>
            <h2 className="font-mono text-[11px] tracking-wider uppercase font-semibold"
                style={{ color: "rgba(var(--roam-cream-rgb),0.5)" }}>
              What we are required to retain
            </h2>
          </div>
          <div className="px-5 py-4 space-y-2.5"
               style={{ background: "rgba(var(--roam-cream-rgb),0.02)" }}>
            {WHAT_IS_RETAINED.map((item, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="font-mono text-[10px] mt-0.5 flex-shrink-0"
                      style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>—</span>
                <p className="font-mono text-[11px] leading-relaxed"
                   style={{ color: "rgba(var(--roam-cream-rgb),0.45)" }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl mb-10"
             style={{ background: "rgba(var(--roam-cream-rgb),0.04)", border: "1px solid rgba(var(--roam-cream-rgb),0.08)" }}>
          <Clock size={14} style={{ color: "var(--roam-electric)", flexShrink: 0 }} />
          <p className="font-mono text-[11px] leading-relaxed"
             style={{ color: "rgba(var(--roam-cream-rgb),0.55)" }}>
            All deletion requests are completed within <strong style={{ color: "var(--roam-electric)" }}>30 days</strong> of confirmation. You will receive an email confirming when deletion is complete.
          </p>
        </div>

        <div className="text-center mb-4">
          <div className="font-serif text-[20px] font-black">
            roam<span style={{ color: "var(--roam-electric)" }}>.</span>
          </div>
          <div className="font-mono text-[8px] tracking-[2px] uppercase mt-0.5"
               style={{ color: "rgba(var(--roam-cream-rgb),0.25)" }}>
            adventure matching · letsroam.life
          </div>
          <div className="font-mono text-[10px] mt-2"
               style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
            Questions? privacy@letsroam.life
          </div>
        </div>

      </div>
    </div>
  );
}
