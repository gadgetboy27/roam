# ROAM — Adventure-Matching Dating App

## Overview

ROAM is an adventure-matching dating app where users post real travel/adventure photos and AI matches them based on shared places visited, adventure styles, and bucket-list destinations.

## Stack

- **Frontend**: React + Vite + TanStack Query + wouter + shadcn/ui + Tailwind CSS v4
- **Backend**: Express (root `server/`) serving both API and Vite dev server on port 5000
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod + drizzle-zod
- **Auth**: Session-based (express-session + memorystore), scrypt password hashing
- **Real-time**: Socket.io (server) + socket.io-client (browser) — match rooms, DB-persisted messages
- **Offline**: localStorage message cache + pending queue (auto-flushes on reconnect)
- **Monorepo**: pnpm workspaces (artifacts/*, lib/*)

## Structure

```text
├── client/src/               # React frontend
│   ├── pages/                # Page components
│   │   ├── landing.tsx       # Hero + features + match stories (auth-redirect)
│   │   ├── login.tsx         # Login page (auth-redirect)
│   │   ├── signup.tsx        # 3-step signup (auth-redirect)
│   │   ├── discover.tsx      # Match cards + bucket-list pinning + "Roam Together"
│   │   ├── upload.tsx        # AI photo screener demo
│   │   ├── matches.tsx       # Connections list (2 sections) + chat thread
│   │   └── profile.tsx       # User profile with photo grid + DNA edit + avatar
│   ├── components/
│   │   └── app-nav.tsx       # Shared navigation component
│   ├── lib/queryClient.ts    # TanStack Query setup
│   ├── lib/auth.tsx          # AuthProvider, useAuth, RequireAuth guard
│   ├── lib/socket.ts         # Socket.io client singleton
│   ├── lib/useConnectionStatus.ts  # online/offline/connecting hook
│   └── lib/messageCache.ts   # localStorage cache + pending queue
├── server/                   # Express backend (port 5000)
│   ├── index.ts              # Entry point + Vite setup
│   ├── routes.ts             # All API routes (/api/*)
│   ├── storage.ts            # DatabaseStorage class (IStorage interface)
│   ├── db.ts                 # Drizzle ORM + pg pool
│   ├── auth.ts               # Password hashing (scrypt)
│   ├── seed.ts               # Demo data seeder
│   └── vite.ts               # Vite dev middleware
└── shared/schema.ts          # Drizzle schema + Zod schemas + types
```

## Design System

**Theme**: Forest-dark (DO NOT CHANGE)
- `roam-forest`: #0e1a0d (primary bg)
- `roam-electric`: #c8e64a (lime-green accent)
- `roam-ember`: #e8621a (orange CTA)
- `roam-sky`: #7db8d4 (blue info)
- `roam-cream`: #f2ede3 (text)
- `roam-sand`: #bfb8a8 (muted text)

**Fonts**: Playfair Display (serif, headings), DM Mono (mono, labels/tags), Outfit (sans, body)

## Database Tables

- `users` — id (uuid), email, password, name, dob, gender, ethnicity, location, tagline (≤60), tier, adventureTags[], avatarUrl
- `photos` — id (uuid), userId, storageUrl, caption, personScore, authenticityScore, adventureScore, verdict, tags[], isLicensable
- `matches` — id (uuid), userAId, userBId, overlapScore, sharedTags[], status (pending/liked_a/liked_b/matched/passed), matchedAt
- `messages` — id (uuid), matchId, senderId, content
- `bucket_list` — id (uuid), userId, destinationName, imageUrl

## Match Lifecycle

1. User A clicks "Roam Together" on User B → creates `matches` record with `status = liked_a`
2. User B clicks "Roam Together" on User A → server detects reciprocal like → auto-promotes to `status = matched`, sets `matchedAt`
3. Only `matched` connections show in the "Connections" section with messaging enabled
4. One-sided likes show in "Waiting to roam back" section (no messaging)

## API Endpoints

- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user
- `POST /api/auth/logout` — Logout
- `GET /api/users` — List all users
- `PATCH /api/users/:id` — Update profile (auth required, own user only)
- `GET /api/users/:id/photos` — User's photos
- `POST /api/photos` — Upload photo record
- `GET /api/matches` — Current user's matches (both directions, session auth)
- `POST /api/matches` — Like someone; auto-promotes to matched if reciprocal
- `PATCH /api/matches/:id` — Update match status
- `GET /api/matches/:matchId/messages` — Chat messages
- `POST /api/messages` — Send message
- `GET /api/bucket-list/:userId` — User's bucket list
- `POST /api/bucket-list` — Pin a destination
- `DELETE /api/bucket-list/:id` — Unpin a destination

## Key Features

### Auth Persistence
- Logged-in users visiting `/`, `/login`, `/signup` are redirected to `/discover`
- `RequireAuth` guard redirects unauthenticated users from protected routes to `/login`

### Profile Editing
- Name, tagline, location, adventure DNA all save to DB via `PATCH /api/users/:id` + `refresh()`
- Avatar photo picker in edit modal — reads file as data URL, saves to user record
- 31 Adventure DNA tags including: extreme sports, horse riding, walking, running, pub games, couch surfing, food & wine trails, boating/fishing, sports matches

### Bucket List
- Discover page: bookmark button on each destination card — toggles pin/unpin in DB
- Matches page: pinned destinations shown in horizontal scroll at top

### Connections Page (matches.tsx)
- **Connections section**: mutual `matched` pairs → messaging open
- **Waiting section**: one-sided `liked_a`/`liked_b` → "Waiting to roam back"
- No percentage scores — replaced with conversation momentum:
  - "Say hi →" (no messages, green compass icon)
  - "Your turn →" (they replied last, amber flame icon)  
  - "Their turn…" (you replied last, muted chat icon)
- "Keep momentum" nudge card encouraging fast first messages

## Demo Accounts

- demo@roam.app / demo1234
- mia@demo.roam / adventure123
- kai@demo.roam / adventure123
- sam@demo.roam / adventure123

## Running

- Main workflow: `npm run dev` (starts Express + Vite on port 5000)
- DB push: `npx drizzle-kit push --force`
