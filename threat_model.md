# Threat Model

## Project Overview

ROAM is a production React/Vite frontend with an Express/TypeScript backend, PostgreSQL via Drizzle, Supabase Auth and Storage, Stripe payments, and Socket.IO messaging. It is a dating and group-adventure application handling user profiles, photos, private messages, matches, notifications, group membership, event attendance, and paid subscriptions or tickets.

Production-relevant code lives primarily in `server/`, `shared/`, and `client/src`. The mockup sandbox under `artifacts/mockup-sandbox/` is development-only and should be ignored unless future scans show it is reachable in production. Per platform assumptions, deployed traffic is protected with TLS and `NODE_ENV` is `production`.

## Assets

- **User accounts and sessions** — session cookies, Supabase bearer tokens, user identities, and admin sessions. Compromise would allow account takeover or misuse of privileged routes.
- **Sensitive user data** — email addresses, DOB/location/profile data, dating preferences, photos, private messages, notifications, bucket-list items, and group membership. This app processes relationship and lifestyle data with elevated privacy sensitivity.
- **Payment and verification state** — Stripe customer IDs, subscription state, ticket purchases, Stripe Connect onboarding state, and identity verification status. Incorrect access or tampering can affect billing, access tiers, and trust signals.
- **Admin capabilities and audit data** — admin accounts and moderation/audit functions can access or modify broad user and group data.
- **Application secrets and service credentials** — database connection strings, session secret, Stripe secrets, Supabase service credentials, and email provider keys.

## Trust Boundaries

- **Browser/mobile client to Express API** — all client input is untrusted and every route must authenticate, authorize, validate, and scope results server-side.
- **Express API to PostgreSQL** — server code can read and modify all persisted user, payment, and group data.
- **Express API to Supabase** — the app trusts Supabase Auth for bearer-token identity and Supabase Storage for publicly accessible photo objects.
- **Express API to Stripe** — payment and identity webhooks cross an external-service boundary and must be verified; checkout/session metadata must not become an authorization primitive.
- **Authenticated user to other authenticated users** — the largest production risk area is cross-user data access and mutation (IDOR/broken object-level authorization).
- **Regular user to admin** — admin routes and account creation/deletion must remain isolated to authenticated admins.
- **Production to dev-only code** — mockup/demo sandboxes, local-only tooling, and test artifacts are out of scope unless production reachability is demonstrated.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, Socket.IO handlers in `server/routes.ts`
- **Highest-risk server areas:** route handlers in `server/routes.ts`, persistence methods in `server/storage.ts`, auth helpers in `server/auth.ts` and `server/admin-auth.ts`, payment/webhook logic in `server/stripeClient.ts` and `server/routes.ts`
- **Shared data model:** `shared/schema.ts`
- **Public surfaces:** `/api/healthz`, public group/event listing, invite lookup by token, ad click/live endpoints
- **Authenticated surfaces:** most `/api/users`, `/api/matches`, `/api/messages`, `/api/bucket-list`, `/api/groups`, `/api/events`, `/api/notifications`, Stripe checkout/connect flows
- **Admin surfaces:** `/api/admin/*`, `/api/ads/admin/*`
- **Usually ignore:** `artifacts/mockup-sandbox/`, `dist/`, local tests unless a production path references them

## Threat Categories

### Spoofing

The application supports both session-based auth and Supabase bearer-token auth. Production routes that depend on user identity must accept only a valid authenticated principal and must not let one auth mode bypass checks expected by the other. Admin identity must be enforced separately from normal-user auth, and Stripe webhooks must be signature-verified in production.

Required guarantees:
- Protected user routes MUST derive the acting user from a verified session or Supabase bearer token.
- Admin routes MUST require a valid admin session and MUST NOT trust frontend role state.
- Stripe webhook routes MUST reject unsigned or invalidly signed requests in production.

### Tampering

Users can mutate profiles, matches, messages, bucket-list items, notifications, groups, invites, and event state. The main project-specific tampering risk is object-level authorization failures where a valid user can change another user's records by supplying an ID.

Required guarantees:
- Every write endpoint MUST verify ownership or authorized role before mutating a record.
- Opaque IDs alone MUST NOT be treated as authorization.
- Payment completion, organiser status, boosts, and ticket state MUST only change from verified server-side events.

### Information Disclosure

This app stores and returns highly sensitive relationship, location, photo, messaging, notification, and invite data. Broad queries, over-detailed API responses, and logging of response bodies can disclose private user data, internal moderation metadata, or capability-bearing tokens.

Required guarantees:
- API responses MUST be scoped to the authenticated user or an explicitly authorized audience.
- Sensitive fields not needed by the client MUST be excluded from responses.
- Logs MUST avoid raw API response bodies, private message content, invite tokens, emails, and similar sensitive data.
- Public or semi-public endpoints MUST not reveal private group, invite, or event data beyond intended visibility.

### Denial of Service

The API accepts login, signup, uploads, checkout creation, and other potentially expensive actions. Large request bodies and external-service calls increase abuse risk.

Required guarantees:
- Authentication, upload, verification, and checkout initiation routes MUST remain rate-limited.
- File uploads and other large bodies MUST enforce size limits.
- External service interactions SHOULD fail safely without exhausting server resources.

### Elevation of Privilege

The most credible privilege-escalation paths are broken access control on authenticated routes, invite or token misuse, and admin boundary mistakes. The app’s UUID-heavy schema reduces blind enumeration but does not remove the need for ownership checks, especially where IDs are disclosed elsewhere.

Required guarantees:
- User-controlled identifiers MUST never grant access without a server-side ownership or role check.
- Invite, notification, match, bucket-list, and group/event actions MUST confirm the acting user is the intended subject or authorized maintainer.
- Admin-management routes MUST preserve least privilege and protect account lifecycle operations from normal users.
