// public/sw.js
// Sera service worker — gives the PWA offline support.
//
// Strategy:
//   - Precache the app shell + offline fallback on install.
//   - Network-first for navigations (so users always get fresh content when
//     online), falling back to the cached offline page when the network fails.
//   - Cache-first for static assets (icons, manifest) for speed.
//
// Bump CACHE_VERSION whenever this file or the precached assets change, so old
// caches are cleaned up on activate.
const CACHE_VERSION = "sera-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate the new worker as soon as it's finished installing.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let the browser deal with everything else (POST actions etc).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Don't touch cross-origin requests (Pusher, OpenAI, Resend, fonts CDN, etc).
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth routes — they must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, fall back to offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return res;
          })
      )
    );
  }
});
