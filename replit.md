# ROAM — Adventure-Matching Dating App

## Overview

ROAM is an adventure-matching dating app designed to connect users through shared travel experiences and adventure aspirations. Users upload real travel and adventure photos, which an AI then uses to match them based on places visited, adventure styles, and bucket-list destinations. The project aims to provide a unique dating experience focused on common interests in exploration and adventure, moving beyond traditional profile-based matching.

## User Preferences

I prefer concise and clear communication. When making changes, please explain the reasoning and potential impact. For development, I favor an iterative approach, with frequent updates and opportunities for feedback. Do not make changes to files outside the `client/src`, `server/`, and `shared/` directories without explicit approval.

## System Architecture

**Frontend**:
- Built with React, Vite, TanStack Query, wouter, shadcn/ui, and Tailwind CSS v4.
- Features include: landing page, authentication flows (login, signup), discover feed with TikTok-style swipe cards, photo upload with AI screening, matches and chat interface, user profiles, and "Roamers" (groups) functionality.
- Theming is handled by 4 switchable palettes (`forest-dark`, `daylight`, `ocean`, `ember`) using `data-theme` and CSS variables for RGB components (e.g., `rgba(var(--roam-X-rgb), opacity)`).
- Fonts used are Playfair Display (serif for headings), DM Mono (mono for labels), and Outfit (sans for body).
- Real-time features utilize Supabase Realtime for messages and typing indicators, with a legacy Socket.io client for backward compatibility.
- Offline support includes `localStorage` message caching and a pending queue.

**Backend**:
- An Express server (`server/`) serves both the API and the Vite development server on port 5000.
- Handles API routes, authentication, photo uploads, and integrations with external services.
- Incorporates server-side Adventure Fingerprint engine for matching logic.

**Database**:
- PostgreSQL is used with Drizzle ORM for schema definition and interaction.
- Key tables include `users`, `photos`, `matches`, `messages`, `bucket_list`, `ads`, `groups`, `group_members`, `group_messages`, `group_events`, `groupEventAttendees`, and `notifications`.

**Authentication**:
- Primary authentication is managed by Supabase Auth, using JWTs.
- `express-session` serves as a fallback.
- Legacy bcrypt users are automatically migrated to Supabase upon login.
- Supabase Admin client is used for server-side JWT verification and user management.

**Feature Specifications**:
- **Auth Flow**: Supabase-driven signup and login, including Google/Facebook OAuth.
- **Discover Page**: Displays demo profiles for anonymous users and provides a signup nudge.
- **Profile Page**: Allows users to edit personal details, adventure DNA, upload avatars (as data URLs), initiate Stripe Identity verification, and manage subscription tiers.
- **Match Lifecycle**: Users "like" each other; a reciprocal like results in a "matched" status, enabling chat.
- **Tiers**: "Explorer" (free with limitations), "Adventurer" ($4.99/mo NZD subscription with full features), and "Contributor" (free in exchange for photo licensing).
- **Freemium Monetization**: Replaced the $12/mo gate with a freemium model. Explorer (free) gets basic browsing; Adventurer ($4.99/mo) unlocks full features; Profile Boost ($1 NZD one-time, 24hr top-of-discovery); Squad Leader ($19.99 NZD one-time, permanent group organiser tools); 10% platform fee on ticketed events.
- **Profile Boost**: Sets `boostExpiresAt` on the user via Stripe checkout. Shown in profile page with success banner (`?boosted=1`). Schema: `boost_expires_at` on users table.
- **Squad Leader**: $19.99 one-time purchase sets `isOrganiser=true` on user. Unlocks creating groups and ticketed events without Adventurer subscription. Schema: `is_organiser` on users table. Group leader eligibility accepts this flag.
- **Event Ticketing**: Group organisers can set a ticket price (NZD) on events. Attendees pay price × 1.10 (roam. takes 10%). Schema: `ticket_price_nzd` (cents) on group_events; `ticket_paid`, `ticket_session_id` on group_event_attendees. RSVP returns 402 for ticketed events; client redirects to Stripe checkout via `/api/events/:id/ticket/start`.
- **Plans Page**: Dedicated `/plans` page shows all tiers, pricing, and upgrade CTAs. Accessible via ⚡ Zap icon in the sidebar. Checkout flows are redirected to Stripe hosted checkout.
- **Rate Limiting**: Implemented in-memory per-IP buckets for API endpoints to prevent abuse.
- **Admin Dashboard**: Provides user management (tier changes, banning), ad metrics tracking, and an ad review portal. Access is restricted by `ADMIN_EMAILS` environment variable.
- **What's On Feed**: Events discovery page at `/whats-on` showing upcoming group events with Today/This Week/Upcoming filters, smart relative datetime display, attendee faces, and RSVP capability. RSVP button states: not logged in → signup prompt; not group member → join group link; member → toggle RSVP. Group event cards also include RSVP + attendee count.
- **Groups Events RSVP**: Group detail page Events tab shows RSVP button per event (approved members only), attendee avatars, and count. Endpoints: `POST/DELETE /api/events/:eventId/rsvp`, `GET /api/events/upcoming`, `GET /api/events/:eventId/attendees`.
- **Side Nav Create Menu**: The "+" button opens a quick-action popup. "Upload photos" → /upload. "Plan an event" uses smart routing: 1 led group → goes directly to that group's Events tab (?tab=events); multiple led groups → shows inline group picker; no groups led → /groups with guidance. Subtitle updates dynamically to reflect the user's state.
- **Event Promotion**: Group leaders see a "Promote" button on each event card. Clicking it routes to /advertise in event mode (?mode=event) with the event title, description, group, and event ID pre-filled. The advertise page in event mode shows an "Event Promotion" heading, hides irrelevant fields (Company), shows a benefits box explaining the paid reach value, and auto-fills name/email from the logged-in user. The ad type is stored as "event" with submittedByUserId and linkedGroupId/linkedEventId.
- **Match Notifications on Event Ad Approval**: When admin approves an ad with adType="event" and a submittedByUserId, all matched users receive an in-app notification ("Your match is hosting an event").
- **Ads Schema**: Added adType, submittedByUserId, linkedGroupId, linkedEventId columns to the ads table.
- **New Storage Methods**: getMatchedUserIds(userId), getGroupsLedByUser(userId).
- **New Endpoint**: GET /api/groups/my-led — returns active groups led by the logged-in user (used for nav smart routing).
- **Squad Leader Broadcast**: `POST /api/groups/:id/broadcast` — leader-only endpoint that sends an announcement to selected approved members. Validated server-side (leader check, approved member check). Creates a highlighted `isAnnouncement=true` message in the campsite and an in-app notification per recipient. Schema: added `is_announcement boolean DEFAULT false` column to `group_messages`.
- **Broadcast UI**: In the campsite tab, a leader-only "Announce" button (megaphone icon) opens a full-screen modal with member picker (individual checkboxes + Select All toggle) and compose area. Announcements render as a distinct electric-bordered banner in the chat.
- **Member Admin Panel**: Leader-only "Manage Crew" button in the About tab members section opens a full-screen admin panel showing pending join requests (approve/reject with profile checks) and all approved members (remove), replacing the need to scroll through the About tab.
- **Deep-link routing**: Notification type `group_broadcast` routes directly to `/groups/:id?tab=campsite`. The campsite tab now accepts `?tab=campsite` URL param.

**Security**:
- Standard HTTP security headers are set.
- Session cookies are configured with `httpOnly`, `secure`, and `sameSite` attributes.
- Socket.io CORS is restricted in production.
- Stripe webhooks are secured with signature verification.
- **Messaging auth** (socket + REST): `send_message` socket validates match exists, status==="matched", and sender is a participant before creating the message. `POST /api/messages` and `GET /api/matches/:matchId/messages` enforce the same participant check.
- **Group messaging auth**: `send_group_message` socket checks approved membership BEFORE creating the message (previously creation happened in parallel with the auth check, allowing ghost messages).
- **Match auth hardened**: `POST /api/matches` now requires authentication (was unauthenticated). Session user is verified to equal `userAId` — prevents forging likes on behalf of other users.
- **Connection limit fix**: `getMonthlyConnectionsSent` now only counts outgoing connections (`userAId = userId`). Previously counted both sides, meaning popular users who received many likes could hit their own outgoing limit without ever liking anyone.
- **Free tier limits**: `POST /api/matches` enforces a limit of 3 connections per calendar month for free-tier users. Returns `{ limitReached: true, upgradeRequired: true }` with 403. Frontend shows upgrade toast and redirects to `/plans`.
- **Founding member integrity**: Profile creation now uses `countFoundingMembers()` (targeted DB count WHERE is_founding_member=true) instead of `getAllUsers().length`. Prevents gaming via account deletion and re-registration.
- **Bucket list privacy**: `GET /api/bucket-list/:userId` now requires authentication (was publicly accessible).
- **Group member privacy**: `GET /api/groups/:id/members` now requires authentication (was publicly accessible).
- **Stripe Connect**: Full Stripe Connect flow for group organisers to receive payouts; account status shown on profile page. Connect button shows toast errors instead of silently failing.
- **Stripe mode**: `STRIPE_TEST_MODE` env var removed — permanently using live Stripe keys via the Replit integration. No mode switching possible in production.
- **Notification routing**: All notification types route to the correct page on tap: match/message → `/matches`; group events → `/groups/:id?tab=events`; event promotion with no group → `/whats-on`; join/approve/invite → `/groups/:id`. Type icons shown per notification category.
- **Storage efficiency**: Added `countFoundingMembers()`, `getUserByStripeCustomerId()` to storage interface. Subscription cancellation webhook uses targeted lookup instead of fetching all users.
- **getMatchById**, **getMonthlyConnectionsSent** added to IStorage and DatabaseStorage to support all messaging security checks and free tier limits.

## Security Fixes Applied (Post-Launch Audit)

The following issues were identified in a full code audit and fixed:

- **Hardcoded Supabase URL**: `server/supabaseAdmin.ts` now uses `process.env.SUPABASE_URL` instead of a hardcoded string.
- **Hardcoded Supabase anon key**: `client/src/lib/supabase.ts` now reads from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars with hardcoded fallbacks (safe — anon key is public by design, fallbacks allow rotation via secrets).
- **Unprotected endpoints**: Added `authenticateRequest` guard to `/api/users/:id/photos`, `/api/users/:id/honesty`, and `/api/events/:eventId/attendees`.
- **Webhook bypass in production**: Both payment and identity webhook handlers now hard-reject (400) if no signature secret is present and `REPLIT_DEPLOYMENT=1`.
- **Subscription lifecycle**: Added `customer.subscription.updated` webhook handler to downgrade users when Stripe marks a subscription as `canceled` or `unpaid` (belt-and-suspenders alongside the existing `customer.subscription.deleted` handler).

Known remaining items (non-critical):
- In-memory rate limiters reset on server restart (acceptable for current scale; Redis or DB-backed limiting is the long-term fix).
- `passport` and `passport-local` are listed as build externals but never imported — dead deps, removable from package.json when convenient.
- Admin panel shows a UI shell before API auth fails (cosmetic; all data endpoints are protected).

## External Dependencies

- **Supabase**:
    - **Supabase Auth**: User authentication and management.
    - **Supabase Realtime**: Real-time messaging and typing indicators.
    - **Supabase Storage**: Photo storage for user-uploaded adventure photos.
    - **Supabase PostgreSQL**: Managed database service.
- **Stripe**:
    - **Stripe Identity**: For user identity verification.
    - **Stripe Hosted Checkout**: Subscription ($4.99/mo Adventurer), Profile Boost ($1 NZD), Squad Leader ($19.99 NZD), Event Ticket checkout.
    - **Stripe Billing Portal**: For users to manage their subscriptions.
- **Vite**: Frontend build tool.
- **TanStack Query**: Data fetching and caching.
- **wouter**: React router.
- **shadcn/ui**: UI component library.
- **Tailwind CSS v4**: Utility-first CSS framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Zod**: Schema declaration and validation library.
- **drizzle-zod**: Zod integration for Drizzle ORM schemas.
- **express-session**: Middleware for managing user sessions (fallback auth).
- **Socket.io**: Legacy real-time communication (kept for backward compatibility).
- **pnpm workspaces**: For monorepo management.