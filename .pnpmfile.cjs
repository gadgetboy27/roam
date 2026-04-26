'use strict';

/**
 * pnpm hook file — overrides vulnerable transitive dependency versions.
 *
 * Run `pnpm install --no-frozen-lockfile` after changing this file to
 * regenerate pnpm-lock.yaml with the patched versions.
 *
 * Fixes:
 *   GHSA-c2c7-rcm5-vvqj / GHSA-3v7f-55p6-f55p  picomatch <2.3.2 → 2.3.2
 *                                                picomatch 4.0.3  → 4.0.4
 *   GHSA-w5hq-g745-h8pq                         uuid <14.0.0 → 14.0.0
 *   GHSA-r5fr-rjxr-66jc / GHSA-f23m-r3pf-42rh   lodash <4.18.1 → 4.18.1
 */
function readPackage(pkg) {
  const deps = pkg.dependencies || {};

  if (deps.picomatch) {
    const spec = deps.picomatch;
    // Lift any v2.x dep to the patched 2.3.2
    if (/^[\^~]?2\./.test(spec) || spec === '*' || spec === 'latest') {
      pkg.dependencies = { ...deps, picomatch: '2.3.2' };
    }
    // Lift v4.0.3 (or any ^4 that could resolve to 4.0.3) to 4.0.4
    if (/^[\^~]?4\.0\.3$/.test(spec) || spec === '^4.0.0' || spec === '~4.0.3') {
      pkg.dependencies = { ...pkg.dependencies, picomatch: '4.0.4' };
    }
  }

  // Lift uuid <14 to 14.0.0 (GHSA-w5hq-g745-h8pq patched at >=14.0.0)
  if (deps.uuid && /^[\^~]?(10|11|12|13)\./.test(deps.uuid)) {
    pkg.dependencies = { ...pkg.dependencies, uuid: '14.0.0' };
  }

  // Lift lodash 4.17.x dep to patched 4.18.1
  if (deps.lodash && /^[\^~]?4\.17\./.test(deps.lodash)) {
    pkg.dependencies = { ...pkg.dependencies, lodash: '4.18.1' };
  }

  return pkg;
}

module.exports = { hooks: { readPackage } };
