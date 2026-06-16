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
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!userTriggeredUpdate || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

// Activate the waiting worker (called from the update prompt). The SW listens
// for this message and calls self.skipWaiting(); controllerchange then reloads.
export function applyServiceWorkerUpdate(reg: ServiceWorkerRegistration) {
  userTriggeredUpdate = true;
  reg.waiting?.postMessage({ type: "SKIP_WAITING" });
}

export const SW_UPDATE_EVENT_NAME = SW_UPDATE_EVENT;
