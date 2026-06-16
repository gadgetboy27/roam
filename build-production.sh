#!/bin/sh
set -e

echo "Node: $(node --version)"

# Install dependencies — try pnpm first, fall back to npm
if command -v pnpm > /dev/null 2>&1; then
  echo "Using pnpm"
  pnpm install --frozen-lockfile
  RUN=pnpm
else
  echo "pnpm not found, using npm"
  npm install
  RUN=npm
fi

# Build frontend (dist/public/) and server bundle (dist/index.cjs)
# Use the same package manager we installed with (railway.toml runs `pnpm run build`).
$RUN run build

echo "=== dist/ ==="
ls -lh dist/index.cjs
ls -lh dist/public/index.html
