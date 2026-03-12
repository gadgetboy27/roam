#!/bin/sh
set -e

echo "Node: $(node --version)"

# Install dependencies — try pnpm first, fall back to npm
if command -v pnpm > /dev/null 2>&1; then
  echo "Using pnpm"
  pnpm install --frozen-lockfile
else
  echo "pnpm not found, using npm"
  npm install
fi

# Build frontend (dist/public/) and server bundle (dist/index.cjs)
npm run build

echo "=== dist/ ==="
ls -lh dist/index.cjs
ls -lh dist/public/index.html
