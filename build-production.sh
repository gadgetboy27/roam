#!/bin/sh
set -e

# Build frontend (dist/public/) and server bundle (dist/index.cjs)
pnpm run build
