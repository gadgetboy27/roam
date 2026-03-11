#!/bin/sh
set -e
pnpm run build
pnpm --filter @workspace/api-server run build
