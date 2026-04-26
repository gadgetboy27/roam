# ROAM — Audit Progress Report
**Original audit:** April 26, 2026  
**Updated code reviewed:** April 27, 2026  
**Result: 14 of 22 issues resolved. 8 still outstanding.**

---

## ✅ FIXED — Great work

### Criticals
| ID | Issue | Status |
|----|-------|--------|
| C1 | Socket.IO anonymous auth | ✅ Fixed — `io.use()` middleware added, `socket.data.userId` used throughout, `data.senderId` eliminated |
| C2 | Supabase RLS open policy | ✅ Fixed — participant-scoped SELECT, INSERT, UPDATE policies on `messages`; scoped typing policy |
| C3 | Hardcoded Supabase credentials | ✅ Fixed — hardcoded fallbacks removed, throws on missing env vars |
| C5 | In-memory rate limiter | ✅ Fixed — custom `PgRateLimitStore` class backed by Postgres, self-creates `rate_limits` table on startup |

### High
| ID | Issue | Status |
|----|-------|--------|
| H2 | Admin routes unprotected | ✅ Fixed — `RequireAdminAuth` wraps both `/admin` and `/admin/ads` |
| H4 | No Content-Security-Policy | ✅ Fixed — full CSP, HSTS, and security headers set in `server/index.ts` |
| H6 | N+1 query in `/api/discover` | ✅ Fixed — new `getAllPhotosForUsers()` bulk query eliminates per-user fetches |
| H8 | Public static uploads mount | ✅ Fixed — `express.static` mount removed |

### Medium
| ID | Issue | Status |
|----|-------|--------|
| M5/M6 | Unused passport + memorystore packages | ✅ Fixed — both removed from package.json |
| M7 | `trust proxy` set after listen() | ✅ Fixed — moved to `server/index.ts` before listen |
| M8 | No message length limit | ✅ Fixed — 2000 char limit on REST and Socket.IO paths |

### Bonus fixes (found during test writing)
| Issue | Status |
|-------|--------|
| `comparePassword()` throws on malformed hash | ✅ Fixed — try/catch added, returns false safely |
| No max password length (DoS via scrypt) | ✅ Fixed — `.max(128)` added to signupSchema |

---

## 🔴 STILL OUTSTANDING — Needs fixing before launch

---

### C4 — Migration SQL not updated (CRITICAL)
**File:** `migrations/0000_cold_mariko_yashida.sql`

The TypeScript schema (`shared/schema.ts`) now correctly defines all the new columns, but the migration SQL file was never regenerated. The production database is still missing these columns:

| Table | Missing Column |
|-------|---------------|
| `users` | `boost_expires_at`, `is_organiser`, `stripe_connect_account_id`, `stripe_connect_onboarded` |
| `group_events` | `ticket_price_nzd` |
| `group_event_attendees` | `ticket_paid` |

The boost, organiser, and ticket payment flows are broken in production right now.

**Fix — tell Replit agent:**
```
Run: npx drizzle-kit generate
Then: npx drizzle-kit migrate
Verify the new migration file contains boost_expires_at, is_organiser, 
stripe_connect_account_id, stripe_connect_onboarded, ticket_price_nzd, ticket_paid.
```

---

### H1 — `/discover` and `/plans` still have no auth guard (HIGH)
**File:** `client/src/App.tsx` lines 50, 60

```tsx
// CURRENT — unprotected:
<Route path="/discover" component={Discover} />
<Route path="/plans" component={Plans} />

// NEEDED:
<Route path="/discover">
  <RequireAuth><Discover /></RequireAuth>
</Route>
<Route path="/plans">
  <RequireAuth><Plans /></RequireAuth>
</Route>
```

All other protected routes are correctly wrapped. Just these two were missed.

---

### H3 — `users.password` still `NOT NULL` in migration (HIGH)
**File:** `migrations/0000_cold_mariko_yashida.sql` line ~170

`shared/schema.ts` correctly has `password: text("password")` (nullable) but the migration SQL still has `"password" text NOT NULL`. This means Supabase OAuth users — who have no scrypt password — cannot be inserted into the database.

**Fix:** In the new migration generated for C4, ensure the password column change is also captured. Or add a standalone migration:
```sql
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
```

---

### H5 — Zero database indexes (HIGH)
**File:** `migrations/` — no indexes exist anywhere

Every query that filters on a foreign key is doing a full table scan. Add these in the same migration run as C4:

```sql
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches(user_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches(user_b_id);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_boost_expires ON users(boost_expires_at);
```

---

### H7 — No foreign key constraints (HIGH)
**File:** `migrations/` — no `REFERENCES` constraints exist

Without FK constraints, orphaned records accumulate silently. Photos can reference deleted users, messages can reference deleted matches, and database cleanup is impossible.

Add `.references()` to the Drizzle schema and regenerate migrations. Key relationships:

```ts
// In photos table:
userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In messages table:
matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In matches table:
userAId: varchar("user_a_id").notNull().references(() => users.id, { onDelete: "cascade" }),
userBId: varchar("user_b_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In notifications table:
userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
```

---

### M3 — SESSION_SECRET has no startup guard (MEDIUM)
**File:** `server/routes.ts` line 265

```ts
// CURRENT — silently uses undefined if env var missing:
secret: process.env.SESSION_SECRET!,

// NEEDED — add before the session() call:
if (!process.env.SESSION_SECRET) {
  throw new Error("FATAL: SESSION_SECRET environment variable is not set");
}
```

---

### M4 — No startup guard for Stripe webhook secret (MEDIUM)
**File:** `server/routes.ts` webhook handler

The webhook currently accepts unverified events if `STRIPE_PAYMENT_WEBHOOK_SECRET` is not set. Add a startup check:

```ts
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
  if (!process.env.STRIPE_PAYMENT_WEBHOOK_SECRET) {
    throw new Error("FATAL: STRIPE_PAYMENT_WEBHOOK_SECRET must be set in production");
  }
  if (!process.env.STRIPE_IDENTITY_WEBHOOK_SECRET) {
    throw new Error("FATAL: STRIPE_IDENTITY_WEBHOOK_SECRET must be set in production");
  }
}
```

---

## Priority order for Replit agent

```
1. C4  — Run drizzle-kit generate + migrate (adds missing columns)
2. H3  — Ensure password column becomes nullable in that migration
3. H5  — Add all indexes to the same migration  
4. H7  — Add FK constraints to schema.ts, regenerate migration
5. H1  — Wrap /discover and /plans in <RequireAuth>
6. M3  — Add SESSION_SECRET startup guard
7. M4  — Add Stripe webhook secret startup guard
```

Items 1–4 can all be done in a single migration run if the schema changes are made first.
