# roam. — Flow & Freemium Benchmark vs Industry Standard

_2026-06-11. How leading social/dating/adventure apps structure onboarding, the free
core, and monetisation — and the target shape for roam. Principle: **keep everyone on
board as long as possible; keep everything free until they want depth or a business
capability.**_

---

## What the leaders do

| App | Onboarding | Free core | Paid (depth / business) | Off-ramp |
|-----|-----------|-----------|--------------------------|----------|
| **Hinge** | Photo + prompt first; "designed to be deleted" framing; fast to first like | **Likes, matches AND messaging are free** | Hinge+ / X: see who liked you, advanced filters | Pause + reason survey on delete |
| **Bumble** | Photo-first, quick; verify nudge | Match + message free (24h window) | Boost, Premium (filters, see likes), SuperSwipe | **Snooze** (pause) before delete |
| **Tinder** | Minimal signup → swiping in <60s | Swipe + match + message free | Gold/Plus: see likes, boosts, unlimited swipes, passport | Hide / pause |
| **Meetup** | Pick interests → see local events | Browse + RSVP + attend free | **Organiser pays** to host groups (business side) | Easy leave group |
| **Strava** | Pick activities; connect a device | Log activities, follow, kudos, clubs | Premium: analytics, routes, segments | Easy deactivate |

### The pattern (5 rules every leader follows)
1. **Fast time-to-value** — minimal signup, see the core value (swiping / events) in under a minute; profile depth comes *later*, contextually.
2. **The core loop is free** — discover → match → **message**. Nobody charges for the first hello.
3. **Monetise depth & convenience, not connection** — see-who-likes-you, boosts, filters, and **business/organiser tooling** (Meetup's model).
4. **Progressive profiling** — nudge photos/prompts/verification in context, never all up front.
5. **Retention off-ramps** — Snooze/Pause and a reason survey *before* delete; "easy to leave" builds the trust that makes people stay.

---

## roam today vs the standard (after 2026-06-11 changes)

| Dimension | Industry standard | roam now | Gap |
|---|---|---|---|
| Time-to-value | Swipe in <60–90s | Photo-first onboarding ✅, but still 4 steps before Discover | 🟠 trim steps |
| Free matching | Free | ✅ Free | — |
| Free messaging | Free | ✅ **Now free** (paywall removed) | — |
| Connection volume | Unlimited | ✅ **Cap lifted** | — |
| Progressive profiling | Contextual nudges | Mostly front-loaded in onboarding | 🟠 defer tags/bucket-list |
| Monetise depth/business | Yes | Boost, Squad Leader, Community/Organiser ✅ | 🟡 clarify what's paid & why |
| Pause / off-ramp | Snooze/Pause | ✅ "Log out / take a break" added in delete flow | 🟡 a real "hide me" later |
| Easy + safe delete | Confirm + survey | ✅ 2-step confirm, what-gets-deleted, soft off-ramp | 🟡 optional reason survey |

**roam's core loop is now free and unlimited** (match · message · connect · crew · join groups · RSVP). That's the biggest alignment win — the network can finally ignite.

---

## Target flow (what to build toward)

**Onboarding (goal: Discover in ~60s):**
1. Email + age (legal gate) → 2. **Add 1 photo** (hero) → 3. **Drop straight into Discover.**
4. Then *contextual* nudges, not blocking steps: "add adventure tags to match better",
   "pin a dream destination", "get verified for a trust badge". (Today's tags/bucket-list
   steps become optional post-signup cards.)

**Free forever (the social core):**
- Discover, match, message, crew-up, join groups, RSVP to events, create a free **Crew (≤20)**.

**Paid — only "depth" or "business":**
- **Boost** (visibility) — convenience.
- **Squad Leader / Organiser** — host **ticketed** events, run **large Communities**, event
  series. This is the Meetup model: individuals free, organisers/businesses pay.
- Future "depth" upsell candidates: see who connected with you, advanced discovery filters.

**Money rule:** never charge for the first hello or for connecting. Charge when a user wants
*reach* (Boost), *scale* (big groups), or *to run a business* (ticketed events / Organiser).

**Account & trust:**
- Delete is easy to find (Settings) with checks & balances: soft off-ramp ("take a break"),
  a clear what-gets-deleted list, explicit confirm, GDPR-compliant data removal.
- Add later: a real **Pause/Hide** (needs a `hidden` flag wired into Discover with a
  visible-by-default migration — do NOT reuse `openToRoaming`, which defaults false for all
  current users and would empty the feed) and an optional one-tap reason survey on delete.

---

## Prioritised next steps
1. 🟠 **Trim onboarding to photo → Discover**, convert tags/bucket-list to post-signup nudges.
2. 🟡 **Clarify free vs paid** on `/plans` and group creation (Crew free / Community paid) so
   nobody over-buys — and ungate group creation from the photo requirement.
3. 🟡 **Add a real Pause/Hide** (new `hidden` flag, default visible) as the true Snooze.
4. 🟡 Optional **reason survey** on delete (retention insight + a last off-ramp).

## Flow & connection graph (graphify)
The repo's knowledge graph (`graphify-out/`) auto-rebuilds on every commit via the
post-commit hook, so flow and connection nodes stay current. Use it to reason about changes
before editing: `graphify query "how does onboarding flow into discover"`,
`graphify affected "createMatch"`, `graphify path "signup" "first message"`.

## Shipped this cycle (toward the standard)
Free messaging · unlimited connections · photo-first onboarding · delete off-ramp · referral
loop · public event RSVP · signup→profile leak fixed.
