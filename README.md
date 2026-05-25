# roam.

Adventure-matching dating app. Find your people through shared travel photos, bucket list destinations, and adventure style.

**Live:** [letsroam.life](https://letsroam.life)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TanStack Query, wouter, shadcn/ui, Tailwind CSS |
| Backend | Express.js (Node 20), Socket.io |
| Database | PostgreSQL via Supabase (Drizzle ORM) |
| Auth | Supabase Auth (email + Google + Facebook OAuth) |
| File storage | Supabase Storage |
| Payments | Stripe (subscriptions + one-time) |
| Email | Resend |
| Hosting | Railway |

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in your Supabase, Stripe, and Resend keys

# 3. Push the database schema
npm run db:push

# 4. Start the dev server (frontend + backend together on :5000)
npm run dev
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in all values. See `.env.example` for descriptions of each variable.

**Required in production:**
- `DATABASE_URL`
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` + `STRIPE_PAYMENT_WEBHOOK_SECRET` + `STRIPE_IDENTITY_WEBHOOK_SECRET`
- `SESSION_SECRET`
- `RESEND_API_KEY`
- `APP_URL`

---

## Deployment (Railway)

The app is configured for Railway via `railway.json`. Build runs `npm run build`, start runs `npm run start`. Health check endpoint: `GET /api/healthz`.

**Stripe webhooks:**
- Payment webhook → `https://letsroam.life/api/webhooks/stripe`
- Identity webhook → `https://letsroam.life/api/webhooks/stripe-identity`

---

## Database migrations

```bash
# Generate a migration after schema changes
npx drizzle-kit generate

# Push schema directly (dev only)
npm run db:push
```

Migrations live in `/migrations`. The initial Supabase RLS setup is in `supabase_setup.sql`.

---

## Project structure

```
client/          React frontend
  src/
    pages/       Route-level components
    components/  Shared UI components
    lib/         Auth, query client, Supabase client, theming
server/          Express backend
  index.ts       App entry point + startup migrations
  routes.ts      All API routes
  storage.ts     Database access layer (Drizzle)
  supabaseAdmin.ts  Supabase service-role client
shared/
  schema.ts      Drizzle schema + Zod types (source of truth)
migrations/      Drizzle migration files
```

---

## Pricing tiers

| Tier | Price | Features |
|---|---|---|
| Explorer | Free | 9 photos, see matches, 3 connections/month |
| Adventurer | $12 NZD/month | Unlimited uploads, full messaging, Bucket List matching, Almost Met |

Group Organiser and Profile Boost are available as one-time add-ons.
