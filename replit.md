# ROAM — Adventure-Matching Dating App

## Run & Operate

*   **Run Dev Server:** `pnpm dev` (starts frontend on 3000, backend on 5000)
*   **Build Frontend:** `pnpm build:client`
*   **Build Backend:** `pnpm build:server`
*   **Typecheck:** `pnpm typecheck`
*   **Generate Drizzle Migrations:** `drizzle-kit generate:pg`
*   **Push DB Schema:** `drizzle-kit push:pg`
*   **Required Env Vars:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_SECRET`, `ADMIN_EMAILS`

## Stack

*   **Frontend:** React, Vite, TanStack Query, wouter, shadcn/ui, Tailwind CSS v4
*   **Backend:** Express.js, Socket.io (legacy)
*   **Database:** PostgreSQL (Supabase-hosted)
*   **ORM:** Drizzle ORM, drizzle-zod
*   **Validation:** Zod
*   **Build Tool:** Vite, pnpm workspaces

## Where things live

*   `/client`: Frontend React application.
*   `/server`: Backend Express.js application.
*   `/shared`: Shared types and utilities.
*   `drizzle.config.ts`: Drizzle ORM configuration.
*   `server/src/db/schema.ts`: Database schema definition (source of truth).
*   `client/src/App.tsx`: Frontend routing.
*   `client/src/styles/theme/`: Theming definitions.
*   `supabase_setup.sql`: Supabase RLS policies and DB setup.

## Architecture decisions

*   **Adventure Fingerprint Engine:** AI-driven matching based on user photos and tags, providing a personalized discovery feed.
*   **Freemium Monetization:** Replaced a hard paywall with tiered access (Explorer, Adventurer, Contributor) and one-time purchases (Profile Boost, Squad Leader) to maximize user acquisition.
*   **Supabase-centric Auth:** Leverages Supabase Auth for primary authentication, including OAuth, with `express-session` as a fallback for legacy users.
*   **Theming System:** Utilizes CSS variables and `data-theme` attribute for 4 switchable palettes, allowing for easy theme management.
*   **PostgreSQL-backed Rate Limiter:** Replaced in-memory rate limiting with a robust, persistent solution using a `rate_limits` table in PostgreSQL to prevent abuse.

## Product

*   **Adventure-Matching:** Connects users based on shared travel photos, adventure styles, and bucket list destinations.
*   **Tiered Access:** Offers free (Explorer), subscription (Adventurer), and contribution-based (Contributor) tiers with varying features.
*   **Group Functionality (Roamers):** Users can create, join, and manage groups, organize events, and communicate via group chat.
*   **Onboarding Wizard:** A guided 6-step process for new users to set up their profile, adventure preferences, and upload photos.
*   **Admin Dashboard:** Tools for user management, ad review, and metrics tracking.

## User preferences

I prefer concise and clear communication. When making changes, please explain the reasoning and potential impact. For development, I favor an iterative approach, with frequent updates and opportunities for feedback. Do not make changes to files outside the `client/src`, `server/`, and `shared/` directories without explicit approval.

## Gotchas

*   **Supabase RLS Policies:** Require manual re-application in the Supabase dashboard after changes to `supabase_setup.sql`.
*   **Stripe Connect:** Ensure the full Stripe Connect flow is understood for group organisers to receive payouts.
*   **Legacy Socket.io Client:** Still present for backward compatibility, but Supabase Realtime is preferred for new features.

## Pointers

*   **Drizzle ORM Docs:** `https://orm.drizzle.team/docs/overview`
*   **Supabase Docs:** `https://supabase.com/docs`
*   **Stripe Docs:** `https://stripe.com/docs`
*   **Tailwind CSS Docs:** `https://tailwindcss.com/docs`
*   **shadcn/ui Docs:** `https://ui.shadcn.com/docs`