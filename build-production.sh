#!/bin/sh
set -e

# Install dependencies so tsx and other build tools are available
pnpm install --frozen-lockfile

# Build frontend (dist/public/) and server bundle (dist/index.cjs)
pnpm run build
