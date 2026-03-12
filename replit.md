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
│   │   ├── landing.tsx       # Hero + features + match stories
│   │   ├── signup.tsx        # 3-step signup (account → tier → consents)
│   │   ├── discover.tsx      # Match cards with adventure DNA overlap
│   │   ├── upload.tsx        # AI photo screener demo
│   │   ├── matches.tsx       # Match list + chat thread
│   │   └── profile.tsx       # User profile with photo grid
│   ├── components/
│   │   └── app-nav.tsx       # Shared navigation component
│   ├── lib/queryClient.ts    # TanStack Query setup
│   ├── lib/auth.tsx          # AuthProvider, useAuth, RequireAuth guard
│   ├── lib/socket.ts         # Socket.io client singleton
│   ├── lib/useConnectionStatus.ts  # online/offline/connecting hook
│   ├── lib/messageCache.ts   # localStorage cache + pending queue
│   └── App.tsx               # Router setup (auth-guarded routes)
├── server/                   # Express backend (port 5000)
│   ├── index.ts              # Entry point + Vite setup
│   ├── routes.ts             # All API routes (/api/*)
│   ├── storage.ts            # DatabaseStorage class (IStorage interface)
│   ├── db.ts                 # Drizzle ORM + pg pool
│   ├── auth.ts               # Password hashing (scrypt)
│   ├── seed.ts               # Demo data seeder
│   ├── vite.ts               # Vite dev middleware
│   └── static.ts             # Production static serving
├── shared/schema.ts          # Drizzle schema + Zod schemas + types
├── artifacts/api-server/     # Secondary API server (port 8080, not main)
├── lib/db/                   # Workspace DB package
├── lib/api-spec/             # OpenAPI spec
├── lib/api-zod/              # Generated Zod schemas
└── lib/api-client-react/     # Generated React Query hooks
```

## Design System

**Theme**: Forest-dark (DO NOT CHANGE)
- `roam-forest`: #0e1a0d (primary bg)
- `roam-electric`: #c8e64a (lime-green accent)
- `roam-ember`: #e8621a (orange CTA)
- `roam-sky`: #7db8d4 (blue info)
- `roam-cream`: #f2ede3 (text)
- `roam-sand`: #bfb8a8 (muted text)
- `roam-violet`: #a78bfa (secondary accent)

**Fonts**: Playfair Display (serif, headings), DM Mono (mono, labels/tags), Outfit (sans, body)

## Database Tables

- `users` — id (uuid), email, password, name, dob, gender, ethnicity, location, tagline (max 60 chars), tier (free/adventurer/contributor), adventureTags[], avatarUrl
- `photos` — id (uuid), userId, storageUrl, caption, personScore, authenticityScore, adventureScore, verdict (approved/needs_person/rejected_*), tags[], isLicensable
- `matches` — id (uuid), userAId, userBId, overlapScore, sharedTags[], status (pending/liked_a/liked_b/matched/passed), almostMetLocation/Date
- `messages` — id (uuid), matchId, senderId, content
- `bucket_list` — id (uuid), userId, destinationName, imageUrl

## API Endpoints

- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user
- `POST /api/auth/logout` — Logout
- `GET /api/users` — List all users
- `GET /api/users/:id/photos` — User's photos
- `POST /api/photos` — Upload photo record
- `GET /api/matches` — Current user's matches
- `POST /api/matches` — Create match
- `PATCH /api/matches/:id` — Update match status
- `GET /api/matches/:matchId/messages` — Chat messages
- `POST /api/messages` — Send message
- `GET /api/bucket-list/:userId` — User's bucket list
- `POST /api/bucket-list` — Add bucket list item

## Monetization Tiers

- **Explorer** (free): Basic matching, 5 photos
- **Adventurer** ($12 NZD/mo): Unlimited photos, Almost Met radar, priority matching
- **Contributor** (free): Adventurer features free in exchange for photo licensing (30% royalty on sales >$200 NZD)

## Demo Accounts

- demo@roam.app / demo1234 (Demo User, Adventurer)
- mia@demo.roam / adventure123 (Mia Chen)
- kai@demo.roam / adventure123 (Kai Roberts, Contributor)
- sam@demo.roam / adventure123 (Sam Taylor)

## Running

- Main workflow: `npm run dev` (starts Express + Vite on port 5000)
- DB push: `npx drizzle-kit push --force`
