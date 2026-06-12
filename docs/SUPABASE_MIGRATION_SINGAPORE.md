# Migrate Supabase → Singapore (co-locate with the Railway app)

**Goal:** move the Supabase project from **Seoul (ap-northeast-2)** to **Singapore
(ap-southeast-1)** so it sits in the same region as the Railway app (already in
Singapore). This removes the ~70ms-per-query cross-region hop → every endpoint
faster for **every user worldwide** (it's a hop that exists regardless of where the
user is).

**Why now is the right time:** the dataset is tiny, so risk + downtime are minimal.
- DB: **27 MB** · public rows: 3 users, 47 photos, 11 bucket-list, 7 members, 4 groups
- Auth: **5 users** (3 real + 2 not-yet-onboarded), incl. Google OAuth identities
- Storage: **48 photo objects, 89 MB** in the `photos` bucket

> Supabase can't change a project's region in place — you create a **new project**
> in Singapore and migrate into it. New project = new ref/keys, so URLs + keys all
> change (handled in the env-swap + Google steps below).

---

## The four subsystems that must move
1. **Database** (public schema data) — `pg_dump`/`psql` restore. Easy.
2. **Auth** (`auth.users`: accounts, password hashes, OAuth identities) — comes with
   a full dump, but the **JWT secret changes**, so all existing logins invalidate →
   users must sign in again (trivial at 5 users).
3. **Storage** (the 48 photo files) — bucket objects must be copied separately.
4. **Config** — Google OAuth provider, email templates (just branded), custom SMTP,
   Site/redirect URLs, RLS policies. Re-applied on the new project.

---

## Step-by-step

### 0. Pre-flight
- [ ] Pick a low-traffic window (5 real users — any time works).
- [ ] Have the **Resend API key** (`re_…`) and **Google OAuth client id/secret** handy.
- [ ] Install Supabase CLI (`brew install supabase/tap/supabase`) and have `pg_dump`/`psql` (Postgres 15+ client).

### 1. Create the new project
- [ ] Supabase dashboard → **New project** → region **Southeast Asia (Singapore /
      ap-southeast-1)** → same org. Name e.g. `roam-sg`.
- [ ] Note its new: Project ref, `DATABASE_URL` (Singapore pooler host), `SUPABASE_URL`,
      anon key, service_role key.

### 2. Migrate the database (incl. auth)
```bash
# Dump everything (public + auth + storage schemas) from Seoul
SRC="<OLD DATABASE_URL>"   # Seoul
DST="<NEW DATABASE_URL>"   # Singapore
pg_dump "$SRC" --clean --if-exists --quote-all-identifiers \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges -f roam_dump.sql
# Restore into Singapore
psql "$DST" -f roam_dump.sql
```
> Tiny DB → this takes seconds. If the `auth`/`storage` schema restore complains
> about existing rows, Supabase provides a documented "migrate between projects"
> guide; for 5 users the simpler fallback is to recreate auth users via the Admin
> API and let onboarding self-provision profiles.

### 3. Migrate Storage (the 48 photos)
The DB dump moves the storage *metadata* rows, but **not the files**. Copy objects:
```bash
# Easiest: Supabase CLI storage copy, or rclone with both S3 endpoints.
supabase storage cp --recursive \
  "ss://photos" "ss://photos" \
  --experimental --project-ref <OLD_REF> --destination-project-ref <NEW_REF>
```
> Or script it: list objects from old project, download via service key, upload to
> the new `photos` bucket. 89 MB → quick. Verify a few photo URLs resolve after.

### 4. Re-apply config on the new project
- [ ] **Auth → Providers → Google:** enable, paste the **same** Google client id/secret.
- [ ] **Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs:**
      add `https://<NEW_REF>.supabase.co/auth/v1/callback` (keep the old one until cutover).
- [ ] **Auth → URL Configuration:** Site URL `https://letsroam.life`; redirect allow-list
      `https://letsroam.life`, `https://letsroam.life/**` (drop the stale Replit URL).
- [ ] **Auth → Emails → SMTP:** re-enter Resend SMTP (`smtp.resend.com:465`, user
      `resend`, pass = Resend key, sender `noreply@letsroam.life`).
- [ ] **Auth → Email Templates:** paste the branded templates from
      `docs/email-templates/` (confirm-signup, reset-password, magic-link).
- [ ] **RLS policies:** confirm they came across in the dump (they're in `public`); if
      any storage policies are missing, re-create the `photos` bucket policies.

### 5. Swap the env vars in Railway (then redeploy)
Set all six to the new project's values:
```
railway variables --environment production --service roam \
  --set "DATABASE_URL=<NEW>" \
  --set "SUPABASE_URL=https://<NEW_REF>.supabase.co" \
  --set "SUPABASE_SERVICE_ROLE_KEY=<NEW>" \
  --set "SUPABASE_ANON_KEY=<NEW>" \
  --set "VITE_SUPABASE_URL=https://<NEW_REF>.supabase.co" \
  --set "VITE_SUPABASE_ANON_KEY=<NEW>"
```
> ⚠️ `VITE_*` are **build-time** — the change only takes effect after the redeploy
> rebuilds the client. The env change auto-triggers that redeploy.

### 6. Cutover & verify
- [ ] After redeploy: `curl /api/healthz` = 200.
- [ ] **Measure:** `/api/groups` and `/api/events/public` should now be ~250ms /
      ~30–50ms server-side (DB is now same-region as the app).
- [ ] Log in (existing users re-auth due to new JWT secret), confirm a photo loads,
      send a test message, do a Google sign-in.
- [ ] Watch logs for errors for ~10 min.

### 7. Rollback (if anything's wrong)
- Keep the old Seoul project **paused, not deleted, for ~1 week**. To roll back:
  set the six env vars back to the old values → redeploy. Old data is intact since
  we only *read* from it during migration.

### 8. Cleanup (after a week of stability)
- [ ] Delete the old Seoul project.
- [ ] Remove the old Google redirect URI.
- [ ] Revoke any temporary access tokens used.

---

## What I (the agent) can do vs. you
- ✅ **I can:** write/run the `pg_dump`/`psql` migration once you give me the new
  `DATABASE_URL`; swap the Railway env vars; script the storage copy; re-apply the
  email templates + auth config via the Management API (with a fresh PAT); measure
  before/after.
- 🔴 **You must:** create the new Singapore project (dashboard), provide the new keys,
  and do the Google Cloud redirect-URI change (Google dashboard). Provisioning a
  project + handling OAuth secrets is yours to drive.

## Downtime estimate
**~5–15 min** (the redeploy + DNS/env propagation). Reads stay up on the old project
until the env swap. Given 5 users, effectively zero user impact.
