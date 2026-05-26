const CACHE_NAME = "roam-v1";
const STATIC_CACHE = "roam-static-v1";
const API_CACHE = "roam-api-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

const NEVER_CACHE = [
  "/api/",
  "/socket.io/",
  "chrome-extension://",
  "capacitor://",
];

function shouldNeverCache(url) {
  return NEVER_CACHE.some((pattern) => url.includes(pattern));
}

function isApiRequest(url) {
  return url.includes("/api/");
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== "GET") return;
  if (shouldNeverCache(url)) return;

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
