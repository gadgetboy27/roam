# roam. — Adventure Journey Audit

_First pass: 2026-06-11. Goal: make it intuitive for users to do everything the app
claims — connect adventurers and get them talking and adventuring._

**Method:** full journey walked through the live app (letsroam.life) + source review of
every screen. A literal multi-user live test was avoided on purpose: it would inject
fake profiles into the real 7-user feed (against the "no fake profiles" decision) and
require a real live Stripe charge for the community sub. Where empirical proof is
wanted, run an API-driven throwaway-user sim and delete after.

Severity: 🔴 blocks the core loop · 🟠 real friction · 🟡 polish.

---

## 1. First impression — "what is this app?"
- ✅ Strong brand, clear "match on adventures not bios" hook on landing/`/join`.
- 🟡 The value prop ("get talking & adventuring") isn't reinforced after signup — the
  new Home dashboard helps; consider a 1-line "how roam works" on first Discover.

## 2. Menu / nav tour
- ✅ Side rail now: Home · Discover · What's On · Adventurers · Profile · Safety (+ Plans,
  Feedback, Create). Cleaner after dropping the Groups tab.
- 🟠 6 primary icons + 3 utility is still a lot on a vertical rail. Safety could become a
  header shield (already is on Home) to drop to 5.
- 🟡 "Adventurers" label = messages/connections; not obvious it's the inbox. Consider a
  message icon + "Messages" or keep "Adventurers" but show an unread badge.

## 3. Signup
- ✅ Supabase auth; founding-member hook present.
- ✅ FIXED 2026-06-10: signups now always become profiles (auto-provision) — was the
  biggest leak (invisible users).
- 🟠 Multi-step signup + separate onboarding is long; drop-off is real (5 of 12 early
  signups never finished). Shorten the path to first value.

## 4. Onboarding + adding photos
- 🟠 Onboarding asks a lot up front (tags, bucket-list w/ image uploads, photos) before
  the user has seen any value. 🔴 **Photos are the #1 driver of matches but are optional
  and buried** — many users finish with 0 photos (e.g. the founder account), which makes
  their Discover card blank.
- **Fix:** make "add 1 photo" the single hero step; defer bucket-list/extra tags to
  "complete your profile" nudges post-signup. Target: signup → 1 photo → swiping in <90s.

## 5. Discover / making matches
- ✅ Feed is fully open (shows everyone except self/connected/blocked); no over-gating.
- 🔴 **Cold-start: only 7 users.** Not a code issue — growth (events + referrals now
  shipped) is the lever.
- 🟠 `discover.tsx` falls back to `DEMO_PROFILES` when the deck is empty — a new user can
  see/try to act on fake people. Contradicts "no fake profiles"; replace with an honest
  empty state ("You're early! Invite your crew / share an event").
- 🟡 No-photo candidates render weak cards — tie to the photo fix in §4.

## 6. First message + receiving messages
- 🔴 **1:1 messaging is paywalled to Adventurer** (`matches.tsx openChat → upgrade
  toast`). At 7 users this throttles the core promise ("get them talking"): a free user —
  including a friend you just referred — connects but **cannot message** without paying.
- **Fix (highest impact):** make 1:1 messaging free (or a free allowance, or free with
  your first N connections / referred friends). Monetize elsewhere (Boost, Squad Leader,
  larger groups). Talking must be free for the network to ignite.
- ✅ Crew-up vs message confusion FIXED 2026-06-11 (message now the primary row action).

## 7. Setting up a crew with new people
- ✅ Crew-up turns a connection into a private squad + campsite (free).
- 🟠 Adding people you've *not* matched is limited (invite-connection requires a prior
  match). For "crew with new members never met," the path is: meet via Discover/event →
  connect → crew up. That's intentional but not obvious; signpost it.

## 8. Group adventure campaign (e.g. Tongariro mountain walk) + RSVP
- ✅ NEW public event link `/e/:id` → stranger can RSVP and auto-join (shipped 2026-06-10);
  Share button on event cards.
- 🟠 **Creating a group is gated on having ≥1 approved photo** — a founding/organiser with
  0 photos is blocked in-UI. Confusing for exactly the power users who want to lead.
- 🟠 **Tier confusion (Squad/Crew/Community/Organiser):** a single Tongariro walk only
  needs a **free Crew (≤20)**, but the naming nudges users toward a **paid Community**.
  Users may pay when they don't need to. Clarify sizing or rename.

## 9. Community subscription
- 🟠 Community/Organiser groups require payment **before** there's any community to lead —
  backwards at cold-start (paying for capacity you can't fill yet).
- **Fix:** let anyone create/grow a group free up to a real cap (e.g. 20), and only charge
  when they actually hit it ("you've outgrown free — upgrade to add more"). Charge on
  value delivered, not upfront.

## 10. Creating an ad / promoting an event
- ✅ `/advertise` paid public listing exists; promoted events surface in What's On.
- 🟡 Discoverability: "promote this event" should live **on the event** (one tap from the
  Share area), not only as a separate Advertise flow.

## 11. Cross-cutting — is it intuitive & easy?
- 🟠 Several core actions are paywalled at the exact moment of first value (message, create
  group) — this is the #1 thing making it feel hard. Free the core loop; monetize depth.
- 🟡 Identity verification can silently land in `requires_input`; UX fix shipped (clear
  retry) 2026-06-11.

---

## Top 5 fixes to make it intuitive (in order)
1. 🔴 **Free 1:1 messaging** (or generous free allowance). Talking is the product; don't
   gate it at 7 users. (§6)
2. 🔴/🟠 **Photo-first onboarding** — one hero "add a photo" step; defer the rest. Kills
   blank cards + speeds time-to-swipe. (§4)
3. 🟠 **Replace DEMO_PROFILES fallback** with an honest "you're early — invite/seed"
   empty state. (§5)
4. 🟠 **Ungate group creation from the photo requirement** for founding/organiser users;
   clarify Crew (free) vs Community (paid) so people don't over-buy. (§8)
5. 🟠 **Charge groups on value, not upfront** — free up to a cap, upgrade when they hit it.
   (§9)

## Already shipped this cycle (de-risking the loop)
Signup→profile leak fixed · public event RSVP flow · invite-your-crew referral · Matches
messaging clarity · identity retry UX · nav declutter · Home dashboard.

## Suggested next actions
- Implement Top-5 #1 (free messaging) and #2 (photo-first onboarding) — biggest intuitive
  wins, both shippable.
- Optionally: API-driven throwaway-user simulation to empirically confirm the message →
  crew → event → RSVP loop end-to-end, then delete the test users.
