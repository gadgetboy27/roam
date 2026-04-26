'use strict';

/**
 * pnpm hook file — overrides vulnerable transitive dependency versions.
 *
 * Run `pnpm install --no-frozen-lockfile` after changing this file to
 * regenerate pnpm-lock.yaml with the patched versions.
 *
 * Fixes:
 *   GHSA-c2c7-rcm5-vvqj / GHSA-3v7f-55p6-f55p  picomatch <2.3.2 → 2.3.2
 *   GHSA-w5hq-g745-h8pq                         uuid 10.0.0 → ^11.0.5
 *   GHSA-r5fr-rjxr-66jc / GHSA-f23m-r3pf-42rh   lodash <4.18.1 → 4.18.1
 */
function readPackage(pkg) {
  const deps = pkg.dependencies || {};

  // ── picomatch: lift any v2.x dep to the patched 2.3.2 ──────────────────
  if (deps.picomatch) {
    const spec = deps.picomatch;
    if (/^[\^~]?2\./.test(spec) || spec === '*' || spec === 'latest') {
      pkg.dependencies = { ...deps, picomatch: '2.3.2' };
    }
  }

  // ── uuid: lift 10.x dep to 11.x (no 10.x patch exists) ─────────────────
  if (deps.uuid) {
    const spec = deps.uuid;
    if (/^[\^~]?10\./.test(spec)) {
      pkg.dependencies = { ...pkg.dependencies, uuid: '11.0.5' };
    }
  }

  // ── lodash: lift 4.17.x dep to patched 4.18.1 ───────────────────────────
  if (deps.lodash) {
    const spec = deps.lodash;
    if (/^[\^~]?4\.17\./.test(spec)) {
      pkg.dependencies = { ...pkg.dependencies, lodash: '4.18.1' };
    }
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
