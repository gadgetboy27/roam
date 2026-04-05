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
- Key tables include `users`, `photos`, `matches`, `messages`, `bucket_list`, `ads`, `groups`, `group_members`, `group_messages`, `group_events`, and `notifications`.

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
- **Tiers**: "Explorer" (free with limitations), "Adventurer" (paid subscription with full features), and "Contributor" (free in exchange for photo licensing).
- **Rate Limiting**: Implemented in-memory per-IP buckets for API endpoints to prevent abuse.
- **Admin Dashboard**: Provides user management (tier changes, banning), ad metrics tracking, and an ad review portal. Access is restricted by `ADMIN_EMAILS` environment variable.

**Security**:
- Standard HTTP security headers are set.
- Session cookies are configured with `httpOnly`, `secure`, and `sameSite` attributes.
- Socket.io CORS is restricted in production.
- Stripe webhooks are secured with signature verification.

## External Dependencies

- **Supabase**:
    - **Supabase Auth**: User authentication and management.
    - **Supabase Realtime**: Real-time messaging and typing indicators.
    - **Supabase Storage**: Photo storage for user-uploaded adventure photos.
    - **Supabase PostgreSQL**: Managed database service.
- **Stripe**:
    - **Stripe Identity**: For user identity verification.
    - **Stripe Hosted Checkout**: For subscription payments ($12 NZD/month).
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