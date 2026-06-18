// Service-worker registration — progressive enhancement, production-only.
//
// Why production-only: a service worker that caches the app shell in dev would
// fight Vite's HMR and could serve stale local builds. `import.meta.env.PROD`
// is replaced at build time by Vite, so this whole path is dead-stripped in dev.
//
// Safety model: registration failure is non-fatal (the app works without it),
// the SW is network-first and never caches /api or sockets, and an update to a
// new SW always supersedes a bad one via the skip-waiting flow below.

const SW_UPDATE_EVENT = "roam:sw-update";

// Set true only when the user taps "Refresh" on the update prompt. Guards the
// controllerchange reload so the first-install clients.claim() — which also
// fires controllerchange — does NOT reload the page out from under the user.
let userTriggeredUpdate = false;

// Module-level so the controllerchange handler and applyServiceWorkerUpdate's
// fallback timeout share one guard — the page reloads exactly once.
let reloaded = false;

function reloadOnce() {
  if (reloaded) return;
  reloaded = true;
  window.location.reload();
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A new worker has been found and is installing.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // Installed + an existing controller means this is an UPDATE (not the
            // first install) — a fresh version is waiting. Offer a refresh.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: reg }));
            }
          });
        });
      })
      .catch(() => {
        /* registration failed — non-fatal, app continues without offline/install */
      });
  });

  // After a user-triggered update, the new worker takes control — reload once
  // onto the fresh shell. Ignored on first-install claim (see flag above).
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!userTriggeredUpdate) return;
    reloadOnce();
  });
}

// Activate the waiting worker (called from the update prompt). The SW listens
// for this message and calls self.skipWaiting(); controllerchange then reloads.
//
// Hardened so the button always does something: if there's no waiting worker
// (already activated, or the reference was lost), we just reload onto whatever
// is current. And because controllerchange isn't guaranteed to fire on every
// browser/state, a short fallback timeout reloads anyway — reloadOnce() makes
// the double-path safe.
export function applyServiceWorkerUpdate(reg: ServiceWorkerRegistration) {
  userTriggeredUpdate = true;
  if (reg.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(reloadOnce, 2000);
  } else {
    reloadOnce();
  }
}

export const SW_UPDATE_EVENT_NAME = SW_UPDATE_EVENT;
