# roam. — Performance findings (2026-06-13)

## Symptom
Prod logs showed `GET /api/groups 200 in 186472ms` (186s) and many endpoints at
1–7s (discover, matches, groups, eligibility…). No errors — just slow.

## Diagnosis (measured)
| Request | Time | Meaning |
|---|---|---|
| `/api/healthz` (no DB) | **0.2s** | app + network are fast & healthy |
| `/api/events/public` (1 query) | **0.4–1.2s** | one DB round-trip is expensive |
| `/api/groups` (was ~15 queries) | **4–6s**, 186s cold | N+1 × cross-region latency |
| `/api/groups` (after fix, 3 queries) | **~2.7s** | 3 serial round-trips × ~0.9s |

**Root cause = cross-region database latency.** The Supabase DB is in **Seoul
(`aws-1-ap-northeast-2.pooler.supabase.com`)** and the Railway app server is not
co-located with it, so every DB round-trip costs ~0.4–1.2s instead of ~5–30ms.
This is a per-round-trip tax on **every** endpoint, not just groups.

## Fixes shipped (code) ✅
1. **N+1 → 3 queries** in `/api/groups` + `/api/groups/mine`: added
   `getGroupMembersForGroups()` and `getUsersByIds()` batch helpers; one query for
   all members, one for all needed users. Killed the 186s cold-path. (commit 59ce5d1)
2. **20s cache** on the public `/api/groups` list with mutation busting. (commit 086cc72)
   Caveat: in-memory per-process — if the service is scaled to multiple replicas
   the hit-rate drops; and it can't beat the per-request round-trip tax anyway.

These help, but **3 serial cross-region round-trips is inherently ~2.7s** — code
can't fix physics here.

## ✅ RESOLVED 2026-06-13 — the REAL root cause was a 4.6 MB base64 blob in `users`

After ruling out region and connections (below), direct instrumentation found it:
`/api/groups` spent ~1s inside `enrichGroups`, all in `getUsersByIds`. A DB-level
`EXPLAIN ANALYZE` ran in **0.591ms** but returning the rows took **4–6 seconds** —
and only for the `users` table (`group_members` was 230ms). The cause:
**`users.avatar_url` stored inline base64 data URLs averaging 4.6 MB/user (max
10.5 MB; Taylin's was 7.5 MB).** Every user-fetching query (discover, matches,
groups, auth/me) dragged megabytes across the cross-region pooler.

**Fix:**
- Migrated the 3 existing base64 avatars → Supabase Storage; `avatar_url` now holds
  a ~147-char URL (was 10.5M chars). One-off script.
- `PATCH /api/users/:id` now uploads any base64 avatar to Storage and stores only
  the URL (reuses `uploadImageDataUrl`), so it can't regress. (commit 160a2cb)

**Result (server-side):**
| | before | after |
|---|---|---|
| `SELECT users WHERE id IN` | 4,800ms | **300ms** |
| `SELECT * users` (discover) | ~6,000ms | **310ms** |
| `/api/groups` | 186,000ms / 1,200ms | **333ms cold · 1ms cached** |

The remaining ~300ms/query is the genuine Singapore→Seoul + pooler floor — now a
"nice to have," not urgent. **The Supabase→Singapore migration is NOT needed for
performance** (it would've been days of risky auth/storage work for ~250ms while
the real problem — the avatars — went untouched). Keep that plan on the shelf
unless global scale later justifies it.

### Lesson: two red herrings before the real cause
Region (moved app US→Singapore) and connection pooling were investigated and ruled
out by measurement. The warm-pool fix was kept (it does help single queries stay
~85ms). But the 100× win was the avatar blob — found only by instrumenting the
actual slow step instead of theorising. Always measure the slow step first.

## (superseded theory) connection handling
Moved the Railway app from **US West → Singapore** (near the Seoul DB) and it
**did not help** — proving geography wasn't the bottleneck. The real cause:
the `pg` Pool ran on defaults against a remote pooler — idle connections reaped
after 10s, and `connectionTimeoutMillis=0` (wait forever). Low-traffic requests
kept paying a full TCP+TLS **reconnect** per query (~0.4–0.5s), and a stuck
acquire could hang minutes (the 186s spike).

**Fix shipped (commit cbcfefe):** `idleTimeoutMillis` 10s→60s, `keepAlive` on,
`connectionTimeoutMillis` 15s, + a `SELECT 1` every 4 min to keep a connection warm.

**Result (server-side, the user-relevant numbers):**
- `/api/events/public` (1 query): ~500ms → **85ms**
- `/api/groups` (3 queries): 5,000ms+ / 186,000ms spike → **~1,200ms**
- The 186s hang is gone (fail-fast timeout).

NOTE: client-side curl from a US test box shows ~2.9s for /api/groups, but ~1.6s
of that is the test box → Singapore hop; real users near the app see ~1.2s.

Region kept in **Singapore** — best for NZ users on both legs (client→app and
app→Seoul DB).

### Remaining micro-opportunities (diminishing returns)
- `/api/groups` at ~1.2s vs ~250ms theoretical: its 2nd/3rd serial query can hit
  a *cold* pool connection (only one is kept warm). Keeping more connections warm,
  or collapsing the 3 serial queries into a join, would help.
- The 20s in-memory cache on `/api/groups` isn't reducing server time (logs show
  full DB work each call) — investigate (single replica confirmed, so not sharding).
- True same-region (DB + app both in Singapore via a Supabase migration) removes
  the last cross-region hop.

## The earlier hypothesis (superseded — kept for context) 🔴
**Co-locate the app and the database in the same region.** This cuts every DB
round-trip from ~0.9s to ~5–30ms, making `/api/groups` ~0.3s and speeding up the
*entire* app (discover, matches, messaging — everything).

Options, best first:
1. **Move the Railway service region** to the one nearest the Supabase DB.
   - Easiest (Railway Pro, per-service setting). Railway has no Seoul region; its
     **Singapore (`asia-southeast1`)** is far closer to Seoul than US (~70ms vs ~170ms).
   - Partial win — better, not same-region.
2. **Move the Supabase project to a region matching Railway** (or pick one region
   for both). Supabase region can't be changed in place — create a new project in
   the target region, migrate data (pause → `pg_dump` → restore → swap
   `DATABASE_URL`/`SUPABASE_URL`). Heavier, but enables true same-region (~5ms).
3. **Ideal for NZ users:** both in **Sydney (`ap-southeast-2`)** — lowest latency to
   Aotearoa. Supabase supports Sydney; Railway's nearest is Singapore. So the
   cleanest same-region pairing Railway can do is **both in Singapore**, or keep DB
   in Seoul/Sydney and accept the closer-but-not-local Singapore app region.

Recommendation: **move Railway to Singapore now** (quick, big improvement), and
plan a Supabase migration to the same region for the full same-region win.

## Secondary hardening (later, optional)
- The session store (`connect-pg-simple`) and DB-backed rate limiters add DB
  round-trips on the routes that use them — cheaper once co-located.
- Consider a small connection keep-warm / higher pool min so connections don't go
  cold between bursts.
