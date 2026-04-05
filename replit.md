# ROAM — Adventure-Matching Dating App

## Overview

ROAM is an adventure-matching dating app where users post real travel/adventure photos and AI matches them based on shared places visited, adventure styles, and bucket-list destinations.

## Stack

- **Frontend**: React + Vite + TanStack Query + wouter + shadcn/ui + Tailwind CSS v4
- **Backend**: Express (root `server/`) serving both API and Vite dev server on port 5000
- **Database**: PostgreSQL + Drizzle ORM (Replit managed DB)
- **Validation**: Zod + drizzle-zod
- **Auth**: Supabase Auth (primary JWT) + express-session (fallback). Server verifies Supabase JWT via `supabaseAdmin.auth.getUser()`, links to DB user by email. Legacy bcrypt users auto-migrate to Supabase on login.
- **Real-time Messaging**: Supabase Realtime — `messages` + `typing_indicators` tables in Supabase Postgres with RLS + pub/sub
- **Legacy real-time**: Socket.io kept for backward compat
- **Offline**: localStorage message cache + pending queue (auto-flushes on reconnect)
- **Payments**: Stripe Hosted Checkout (subscriptions) + Stripe Identity (ID verification)
- **Monorepo**: pnpm workspaces (artifacts/*, lib/*)

## Structure

```text
├── client/src/               # React frontend
│   ├── pages/                # Page components
│   │   ├── landing.tsx       # Hero + features + match stories
│   │   ├── login.tsx         # Login page
│   │   ├── signup.tsx        # 3-step signup with tier selection
│   │   ├── discover.tsx      # TikTok-style swipe cards (demo profiles for anon users)
│   │   ├── upload.tsx        # AI photo screener demo + real upload
│   │   ├── matches.tsx       # Connections list + chat thread
│   │   └── profile.tsx       # Profile, DNA edit, avatar, verification, upgrade
│   ├── components/
│   │   └── app-nav.tsx       # Shared navigation component
│   ├── lib/queryClient.ts    # TanStack Query setup
│   ├── lib/auth.tsx          # AuthProvider, useAuth, RequireAuth guard
│   ├── lib/supabase.ts       # Supabase client + realtime messaging helpers
│   ├── lib/socket.ts         # Socket.io client singleton
│   ├── lib/fingerprint.ts    # Adventure Fingerprint engine (client-side)
│   ├── lib/theme.ts          # Theme provider (4 palettes)
│   ├── lib/useConnectionStatus.ts  # online/offline/connecting hook
│   └── lib/messageCache.ts   # localStorage cache + pending queue
├── server/                   # Express backend (port 5000)
│   ├── index.ts              # Entry point + Vite setup + rawBody middleware
│   ├── routes.ts             # All API routes (/api/*)
│   ├── storage.ts            # DatabaseStorage class (IStorage interface)
│   ├── db.ts                 # Drizzle ORM + pg pool
│   ├── auth.ts               # Password hashing (scrypt)
│   ├── fingerprint.ts        # Adventure Fingerprint engine (server-side)
│   ├── stripeClient.ts       # Stripe client via Replit connector
│   ├── supabaseAdmin.ts      # Supabase admin client
│   ├── seed.ts               # Demo data seeder
│   └── vite.ts               # Vite dev middleware
└── shared/schema.ts          # Drizzle schema + Zod schemas + types
```

## Design System

**Theming**: 4 switchable palettes via `data-theme` on `<html>`. Stored in localStorage as `roam-theme`.
- `forest-dark` (default): dark green bg, lime-green accent
- `daylight`: cream/beige bg, dark forest-green accent
- `ocean`: deep navy bg, sky-blue accent
- `ember`: dark volcanic bg, orange accent

**CSS Variables** — all rgba() in pages use these RGB component vars:
- `--roam-forest-rgb` / `--roam-moss-rgb` / `--roam-surface-rgb`
- `--roam-electric-rgb` / `--roam-ember-rgb` / `--roam-sky-rgb`
- `--roam-cream-rgb` / `--roam-violet-rgb`
- `--roam-electric-fg` (text colour on top of electric-coloured buttons)

**Fonts**: Playfair Display (serif, headings), DM Mono (mono, labels/tags), Outfit (sans, body)

**IMPORTANT**: All rgba() must use `rgba(var(--roam-X-rgb), opacity)` pattern. Do NOT change fonts.

## Database Tables

- `users` — id (uuid), email, password (bcrypt), name, dob, gender, ethnicity, location, tagline (≤60), tier (free/adventurer/contributor), adventureTags[], avatarUrl, identityVerified, identityVerificationId, identityVerifiedAt, stripeCustomerId, stripeSubscriptionId, createdAt
- `photos` — id (uuid), userId, storageUrl, caption, personScore, authenticityScore, adventureScore, verdict (approved/needs_person/rejected_quote/rejected_manipulated/rejected_stock), tags[], manipulationFlags[], isLicensable, displayOrder, createdAt
- `matches` — id (uuid), userAId, userBId, overlapScore, sharedTags[], status (pending/liked_a/liked_b/matched/passed), almostMetLocation, almostMetDate, createdAt, matchedAt
- `messages` — id (uuid), matchId, senderId, content, createdAt
- `bucket_list` — id (uuid), userId, destinationName, imageUrl, createdAt
- `ads` — id (uuid), advertiserName, advertiserEmail, advertiserCompany, tier, headline, tagline, ctaText, ctaUrl, imageUrl, videoUrl, contentType, status (pending_payment/pending_review/approved/rejected/expired), stripeSessionId, rejectionReason, reviewedAt, expiresAt, impressions, createdAt
- `user_sessions` — auto-created by connect-pg-simple (not in Drizzle schema)

## Tiers

- **Explorer** (free): limited matches, basic features
- **Adventurer** ($12 NZD/month via Stripe): unlimited matches, full messaging, Almost Met, Bucket List
- **Contributor** (free in exchange for photo licensing)

## Stripe Integration

### Identity Verification
- Endpoint: `POST /api/verify/start` — creates Stripe Identity session, returns hosted URL
- Webhook: `POST /api/stripe/identity-webhook` — handles `identity.verification_session.verified`
- Webhook URL: `https://letsroam.life/api/stripe/identity-webhook`
- Secret stored as: `STRIPE_IDENTITY_WEBHOOK_SECRET`
- Profile page polls every 3s post-verification until `identityVerified` becomes true

### Subscription Checkout
- Endpoint: `POST /api/checkout/start` — creates Stripe Checkout session ($12 NZD/month)
- Endpoint: `POST /api/checkout/portal` — creates Stripe Billing Portal session
- Webhook: `POST /api/stripe/payment-webhook` — handles `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
- Webhook URL: `https://letsroam.life/api/stripe/payment-webhook`
- Secret stored as: `STRIPE_PAYMENT_WEBHOOK_SECRET`
- On successful payment: sets `tier = adventurer`, stores `stripeCustomerId` + `stripeSubscriptionId`
- On subscription cancelled: reverts `tier = free`

## Match Lifecycle

1. User A clicks "Roam Together" on User B → creates `matches` record with `status = liked_a`
2. User B clicks "Roam Together" on User A → server detects reciprocal like → auto-promotes to `status = matched`, sets `matchedAt`
3. Only `matched` connections show in the "Connections" section with messaging enabled
4. One-sided likes show in "Waiting to roam back" section (no messaging)
5. Demo profiles (id starts with `demo-`) are blocked from creating real matches

## API Endpoints (all auth-guarded where appropriate)

- `POST /api/auth/signup` — Create account (rate: 10/hr)
- `POST /api/auth/login` — Login (rate: 5/15min)
- `GET /api/auth/me` — Current user (Bearer token or session)
- `POST /api/auth/profile` — Create profile from Supabase OAuth (rate: 10/hr)
- `POST /api/auth/migrate-to-supabase` — Migrate legacy user to Supabase (auth required)
- `POST /api/auth/logout` — Destroy session
- `GET /api/users` — All users (auth required)
- `PATCH /api/users/:id` — Update profile (auth required, own user only)
- `GET /api/users/:id/photos` — User's photos
- `POST /api/photos` — Create photo record (auth required, own userId only)
- `POST /api/upload` — Upload photo file (auth required, own userId only, rate: 30/hr)
- `GET /api/matches` — Current user's matches (auth required)
- `POST /api/matches` — Like someone; demo profiles blocked; auto-promotes if reciprocal
- `PATCH /api/matches/:id` — Update match status (auth required)
- `GET /api/matches/:matchId/messages` — Chat messages (auth required)
- `POST /api/messages` — Send message (auth required, own senderId only)
- `GET /api/bucket-list/:userId` — User's bucket list
- `POST /api/bucket-list` — Pin a destination (auth required)
- `DELETE /api/bucket-list/:id` — Unpin a destination (auth required)
- `GET /api/admin/users` — All users without passwords (admin only)
- `PATCH /api/admin/users/:id` — Change user tier (admin only)
- `DELETE /api/admin/users/:id` — Ban/remove user + Supabase auth (admin only)
- `POST /api/ads/:id/click` — Increment ad click counter (public)
- `POST /api/checkout/start` — Start Stripe Checkout (auth required, rate: 5/hr)
- `POST /api/checkout/portal` — Open Stripe Billing Portal (auth required)
- `POST /api/stripe/payment-webhook` — Stripe payment events (signature verified)
- `POST /api/verify/start` — Start Stripe Identity (auth required, rate: 3/hr)
- `POST /api/stripe/identity-webhook` — Stripe identity events (signature verified)

## Key Features

### Auth Flow
- Signup: Supabase `signUp()` → `/api/auth/profile` to create DB record → redirect to checkout if Adventurer tier
- Login: Supabase `signInWithPassword()` → Bearer JWT → `/api/auth/me` OR legacy bcrypt fallback → auto-migrate legacy users
- Google/Facebook OAuth via Supabase OAuth → `/auth/callback` → `/api/auth/profile`
- Password reset via Supabase email flow

### Discover Page
- Anonymous visitors: see demo profiles (Mia, Kai, Sam, Astrid) — all unverified, all unmatchable
- Swipe right on demo → signup nudge toast → redirect to /signup after 1.8s
- Logged-in users: same demo profiles (real profile discovery not yet wired)
- Adventure tags: icon-only pills that expand on hover/tap

### Profile Page
- Edit name, tagline, location, adventure DNA (31 tags)
- Avatar upload (stored as data URL in DB)
- Identity verification (Stripe Identity — auto-polled for result)
- Tier upgrade (Stripe Checkout) for free users
- Manage subscription (Stripe Billing Portal) for Adventurer users

### Rate Limiting
- In-memory per-IP buckets via `createRateLimiter(maxRequests, windowMs)` factory
- Independent stores per endpoint — no bleed between routes
- Swap for Redis when scaling to multiple servers

## Required Secrets

- `DATABASE_URL` — Replit managed PostgreSQL
- `SESSION_SECRET` — Express session secret
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key
- `SUPABASE_ANON_KEY` — Supabase public anon key
- `SUPABASE_DB_PASSWORD` — Supabase database password
- `STRIPE_IDENTITY_WEBHOOK_SECRET` — Stripe Identity webhook signing secret
- `STRIPE_PAYMENT_WEBHOOK_SECRET` — Stripe payment webhook signing secret
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key

## Photo Storage

Photos upload to Supabase Storage bucket `photos` (auto-created on server startup).
- Upload endpoint decodes base64 data URL, uploads to `{userId}/{timestamp}-{random}.{ext}`
- Stores permanent public HTTPS URL (`https://znqbnldsalsfpraiplxz.supabase.co/storage/v1/object/public/photos/...`) in photos.storageUrl
- Bucket is public — no auth needed to view photos
- Avatars are still stored as data URLs directly in users.avatarUrl (small thumbnails, acceptable)

## Security

- **HTTP headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy set on all responses via middleware in `server/index.ts`
- **Session cookies**: `httpOnly: true`, `secure: true` in prod, `sameSite: strict` in prod
- **Socket.io CORS**: Restricted to `letsroam.life` in production (wildcard only in dev)
- **Rate limiting**: In-memory per-IP buckets (login 5/15min, signup 10/hr, verify 3/hr, upload 30/hr)
- **Stripe webhooks**: Signature verified using `stripe.webhooks.constructEvent()` before processing

## Admin Dashboard (/admin)

Accessible via Profile → Settings → Admin dashboard. Protected by `ADMIN_EMAILS` env var (default: `admin@letsroam.life`). Non-admin users see an "Access Denied" screen.

- **Users tab**: View all users with tier badges, join date, location. Inline tier change dropdown (free / adventurer / contributor) and ban/delete button (with confirmation step). Cannot delete own account.
- **Ad Metrics tab**: All ads with impressions, clicks, CTR, and a visual bar chart. Aggregate totals at the top (total views, total clicks, overall CTR).
- **Ad Review Portal** (`/admin/ads`): Approve or reject ads awaiting review. Separate linked page from the main dashboard.
- **Ad click tracking**: `clicks` column on `ads` table, incremented via `POST /api/ads/:id/click` fired when user clicks the CTA button on an ad card.

## Known Gaps / Future Work

- **Stripe Billing Portal**: Must be enabled in Stripe Dashboard → Billing → Customer portal (one toggle)
- **Rate limiting**: In-memory only — swap for Redis in multi-server deployments
- **Demo users in DB**: The seeded demo accounts (mia@demo.roam, kai@demo.roam etc.) appear in logged-in users' discover decks — consider filtering by email domain server-side

## Running

- Main workflow: `npm run dev` (starts Express + Vite on port 5000)
- DB push: `npx drizzle-kit push --force`
- Deployed at: `https://letsroam.life`
