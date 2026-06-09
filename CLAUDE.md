# RoamApp — working agreement

## Always use the knowledge graph
This repo is indexed by **Graphify** into `graphify-out/graph.json` (rebuilt automatically on every commit via the installed post-commit hook). **Before navigating, changing, or reasoning about code, consult the graph** instead of grepping blind:

- `graphify query "<question>"` — answer a question by traversing the graph (e.g. "how does identity verification work").
- `graphify path "A" "B"` — shortest dependency path between two nodes (e.g. `path "messages" "notifications"`).
- `graphify explain "X"` — what a node is and what it connects to.
- `graphify affected "X"` — reverse traversal: everything impacted if you change `X` (run this before editing a shared/god node).

If the graph looks stale, run `graphify update .` (no LLM/API cost — pure AST).

### Before changing a shared/"god" node, run `graphify affected`
Known hotspots (high fan-in/out): `DatabaseStorage` (server/storage.ts), `cn()` (lib/utils.ts),
`useAuth()` (lib/auth.tsx), `apiRequest()` (lib/queryClient.ts), `routes.ts`. Check blast radius first.

## Architecture notes
- Server routes are being modularised out of `server/routes.ts` into `server/routes/*.routes.ts`
  (groups, safety, misc done). Shared helpers live in `server/http-helpers.ts`; socket handlers in
  `server/sockets.ts`. When adding routes, put them in the matching module, not back in `routes.ts`.
- Next architectural target: split the `DatabaseStorage` god-class (`server/storage.ts`) into
  per-domain repositories.

## Safety
- Never commit `backups/` (contains user PII — gitignored). Snapshot DB with `node scripts/backup-db.mjs`.
- Production deploys via push to `gadgetboy27/roam` → Railway rebuild. Verify `/api/healthz` after deploy.
