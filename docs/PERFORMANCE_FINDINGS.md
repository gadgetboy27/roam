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

## The real fix (infra decision — needs Henry) 🔴
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
