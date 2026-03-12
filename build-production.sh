#!/bin/sh
set -e

# Build frontend + main server (outputs to dist/public and dist/index.cjs)
pnpm run build

# Copy the full server and frontend assets into the artifact directory.
# The deployment runs node artifacts/api-server/dist/index.cjs, so we put
# the complete app there. The server resolves static files relative to its
# own __dirname, so public/ must sit alongside index.cjs.
mkdir -p artifacts/api-server/dist
cp dist/index.cjs artifacts/api-server/dist/index.cjs
cp -r dist/public artifacts/api-server/dist/public
