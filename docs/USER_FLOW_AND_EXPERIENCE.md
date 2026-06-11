# roam. — What the app does, how, and where the user ends up

_2026-06-11. The end-to-end experience, traced through the live code (graphify flow:
Landing → Signup → AuthCallback → Onboarding → Discover → Matches/Groups/Events →
Plans/Safety). Goal: connect adventurers, get them talking and adventuring — and have
them leave each step feeling comfortable and confident to come back._

---

## The journey, stage by stage

| Stage | What it does | How | Where they land | Why they're comfortable / come back |
|---|---|---|---|---|
| **1. Arrive** | Lands a stranger warmly | Friend invite `/join?ref=`, public event `/e/:id`, or Landing | Signup | Framed by a friend or a real event — not a cold dating pitch |
| **2. Sign up** | Create account | Email + age, or Google/Facebook login (Supabase) | Onboarding | Minimal, familiar, standard |
| **3. Onboarding** | Get to value fast | **Photo-first** → "Start discovering" in ~60s; tags/destinations optional | Discover | No long form; nudged (not forced) to finish profile later |
| **4. Discover** | Match on real adventures | Adventure-fingerprint overlap; **free**, **no fake profiles**, honest empty state | A connection | Authentic, free to swipe; "You're early" invites action, not a dead end |
| **5. Connect & message** | Talk to a match | Tap row → **free** 1:1 realtime chat (Supabase) | A conversation | Talking is free; messaging is the obvious action; mutual-only (no spam) |
| **6. Crew up** | Turn a connection into a squad | `useCrewUp` → private group + campsite chat | Group campsite | Optional/secondary; clearly "Start squad", not forced |
| **7. Groups & events** | Find/plan real adventures | What's On → Communities (browse/join) + RSVP events; host a **free Crew** | A real-world meetup | Free Crew for most; clear free vs paid; one-tap RSVP |
| **8. Share & invite** | Grow the network | Tier-1 ShareSheet (native + FB/X/WhatsApp/Telegram/email) + referral auto-connect | Friends join & connect | Seamless, **no permissions/overreach**; invited friends arrive already connected |
| **9. Pay (optional)** | Unlock depth/business | Stripe: Boost (reach), Squad Leader & Community/Organiser (scale/business) | Same app, more power | Core stays free; pay only when they *want* reach, scale, or to run a business |
| **10. Trust & leave** | Stay in control | ID verification (trust badge), easy delete with a "take a break" off-ramp | Confident, in control | Easy to leave builds the trust that makes people stay |

---

## How it maps to the apps users already trust
- **Photo-first, fast-to-swipe** → Tinder / Hinge
- **Free matching AND messaging** → Hinge ("the core loop is free")
- **Events as the front door; organisers pay** → Meetup
- **Share via native sheet + intent links (no token overreach)** → everyone
- **Free core, monetise depth/convenience/business** → all of them
- **Easy delete + pause off-ramp** → Bumble Snooze / Hinge "designed to be deleted"
- **No fake profiles, honest empty states** → trust-first (Hinge)

**Verdict:** the flow now matches industry standard at every stage — nothing about the
core "meet, talk, adventure" loop is gated, slow, fake, or surprising.

## Where the user ends up — and why they come back with confidence
A roam user ends up **connected to real adventurers, talking freely, and planning or
attending real-world adventures** — fully in control of their data and spend. They return
because:
1. **The core thing is free** — match, message, connect, crew, join, RSVP. No wall at hello.
2. **It's real, not fake** — every face is a real person; honest empty states.
3. **It's fast** — value in ~60s; no friction tax.
4. **It's safe & reversible** — verified trust, easy pause/delete, no social overreach.
5. **There's always a pull back** — a new match, an unread message, a crew campsite, an
   upcoming event, a friend who just joined via their invite.

That combination — free, real, fast, safe, with a reason to return — is exactly the loop
the leading social apps engineer. roam now runs it.

## Honest gaps still open (small)
- Tier-2 business Page posting (Ayrshare) — planned, needs Meta/Google review.
- A real Pause/Hide flag (proper Snooze) — needs a visible-by-default migration.
- The biggest lever is no longer product: it's **real users** (events + referrals now drive that).
