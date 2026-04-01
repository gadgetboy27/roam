import { Link } from "wouter";
import { FileText, ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "Acceptance of these terms",
    content: [
      "By creating an account on roam. or using any part of our service, you agree to be bound by these Terms of Service. If you do not agree, you may not use roam.",
      "We may update these terms from time to time. If we make significant changes, we will notify you by email or in-app notice. Continued use of roam. after changes take effect means you accept the updated terms.",
      "roam. is operated by Swiperight Apps Aotearoa. These terms are governed by New Zealand law.",
    ],
  },
  {
    title: "Eligibility",
    content: [
      "You must be at least 18 years old to use roam. By creating an account, you confirm you are 18 or older.",
      "You must be a human. Accounts created by bots or automated methods are not permitted.",
      "You may only have one account. Creating multiple accounts to evade a ban or for any other reason is prohibited.",
    ],
  },
  {
    title: "Your account",
    content: [
      "You are responsible for keeping your account credentials secure. Do not share your password with anyone.",
      "You are responsible for all activity that occurs under your account.",
      "The information you provide in your profile must be accurate and current. Misleading or false information — including fake photos, false locations, or impersonating another person — is not permitted.",
      "If you believe your account has been compromised, contact us immediately at support@letsroam.life.",
    ],
  },
  {
    title: "Acceptable use",
    content: [
      "roam. is for genuine adventure-focused connection. You agree to use the platform in good faith.",
      "You must not use roam. to harass, threaten, stalk, intimidate, or harm other users.",
      "You must not post content that is sexually explicit, violent, hateful, discriminatory, or illegal.",
      "You must not use roam. to solicit money from other users, advertise products or services, or conduct any commercial activity without our written permission.",
      "You must not attempt to access, tamper with, or disrupt roam.'s systems, servers, or networks.",
      "You must not scrape, copy, or reproduce any part of roam. without our written permission.",
      "Violations may result in immediate account suspension or permanent ban.",
    ],
  },
  {
    title: "Photos and content you post",
    content: [
      "You retain ownership of photos and content you post to roam.",
      "By uploading content, you grant roam. a non-exclusive, worldwide, royalty-free licence to display your content to other users on the platform for the purposes of providing the roam. service.",
      "You confirm that you have the right to post any content you upload — that means you own it or have permission from the owner, and that it does not infringe any third party's rights.",
      "We do not use your photos to train AI models or sell them to third parties.",
      "You may delete your content at any time. When you delete your account, your content is removed within 30 days.",
      "We reserve the right to remove any content that violates these terms or that we determine, at our sole discretion, to be harmful to our community.",
    ],
  },
  {
    title: "Matching and messaging",
    content: [
      "roam. facilitates connections between users but is not responsible for the conduct of users offline or in person.",
      "Meeting someone from roam. in person is entirely at your own risk. Always meet in public places and tell someone where you are going.",
      "roam. does not conduct criminal background checks on users. Identity verification (where completed) confirms only that a user presented a real ID — it does not certify their character or intentions.",
      "We are not responsible for any harm that results from meetings arranged through roam.",
    ],
  },
  {
    title: "Subscriptions and payments",
    content: [
      "The free tier of roam. is available at no cost. The Adventurer tier is a paid subscription at NZD $12.00 per month (or as otherwise displayed at checkout).",
      "All payments are processed by Stripe. By subscribing, you also agree to Stripe's terms of service.",
      "Subscriptions automatically renew each month until cancelled. You can cancel at any time from your profile — cancellation takes effect at the end of the current billing period.",
      "We do not offer refunds for partial subscription periods, except where required by New Zealand consumer law.",
      "We reserve the right to change subscription pricing. We will give you at least 30 days notice of any price increase.",
    ],
  },
  {
    title: "Identity verification",
    content: [
      "Identity verification is optional. If you choose to verify, your documents are processed by Stripe Identity on their secure servers. roam. receives only a verified/not verified result.",
      "Completing verification earns a ✓ badge on your profile. This badge confirms you are a real person who presented a valid government ID — it does not constitute an endorsement of your character.",
      "Verification badges cannot be transferred or shared.",
    ],
  },
  {
    title: "Termination",
    content: [
      "You may close your account at any time from your profile settings.",
      "We reserve the right to suspend or permanently ban any account that violates these terms, without notice and without refund.",
      "We may also terminate the roam. service at any time, with reasonable notice where possible.",
      "Upon termination, your licence to use roam. ends immediately. Sections of these terms that by their nature should survive termination will do so.",
    ],
  },
  {
    title: "Disclaimer and limitation of liability",
    content: [
      "roam. is provided 'as is' without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that any particular connection will be made.",
      "To the fullest extent permitted by New Zealand law, roam. is not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.",
      "Our total liability to you for any claim arising from use of roam. is limited to the amount you paid us in the 12 months before the claim.",
      "Nothing in these terms excludes liability that cannot be excluded under New Zealand law, including liability under the Consumer Guarantees Act 1993.",
    ],
  },
  {
    title: "Intellectual property",
    content: [
      "The roam. name, logo, design, and all original content on the platform (excluding user-uploaded content) are owned by Swiperight Apps Aotearoa and may not be used without our written permission.",
      "If you believe any content on roam. infringes your copyright, contact us at legal@letsroam.life with details of the alleged infringement.",
    ],
  },
  {
    title: "Governing law and disputes",
    content: [
      "These terms are governed by the laws of New Zealand.",
      "Any dispute arising from these terms or your use of roam. will be subject to the exclusive jurisdiction of the New Zealand courts.",
      "Before initiating legal action, we encourage you to contact us at support@letsroam.life — most issues can be resolved quickly and informally.",
    ],
  },
  {
    title: "Contact",
    content: [
      "General enquiries: support@letsroam.life",
      "Legal and intellectual property: legal@letsroam.life",
      "Privacy matters: privacy@letsroam.life",
      "Swiperight Apps Aotearoa · letsroam.life",
    ],
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen relative" data-testid="page-terms">
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
            <FileText size={16} style={{ color: "var(--roam-electric)" }} />
          </div>
          <div>
            <h1 className="font-serif text-[28px] font-black leading-tight">
              Terms of <span style={{ color: "var(--roam-electric)" }}>Service</span>
            </h1>
          </div>
        </div>

        <p className="font-mono text-[10px] tracking-wider mb-8"
           style={{ color: "rgba(var(--roam-cream-rgb),0.35)" }}>
          Last updated: 1 April 2026 · Effective immediately · Governed by New Zealand law
        </p>

        <div className="font-mono text-[12px] leading-relaxed mb-8 p-4 rounded-2xl"
             style={{ background: "rgba(var(--roam-electric-rgb),0.06)", border: "1px solid rgba(var(--roam-electric-rgb),0.15)", color: "rgba(var(--roam-cream-rgb),0.7)" }}>
          These terms govern your use of roam. — the adventure matching platform at letsroam.life. Please read them. By using roam. you agree to be bound by them.
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
