#!/bin/sh
set -e

echo "=== Build environment ==="
echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
echo "npm:  $(npm --version)"

# Install dependencies so tsx and other build tools are available
pnpm install --frozen-lockfile

# Build frontend (dist/public/) and server bundle (dist/index.cjs)
pnpm run build

echo "=== Build output ==="
ls -lh dist/index.cjs
ls -lh dist/public/index.html
