/* WHOLESTRA service worker.
 * - The app's own files (/_next/static, icons, fonts) are kept on the device, so the app opens fast.
 * - Pages always come fresh from the internet; with no internet a friendly "you are offline" page shows instead.
 * - Business data (the API on another address) is never touched or stored here. */
const VERSION = "wholestra-v2";
const STATIC = VERSION + "-static";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// old releases leave files behind; keep the newest few hundred
function trim(cache) {
  return cache.keys().then((all) => {
    const keys = all.filter((k) => !k.url.endsWith(OFFLINE));
    return Promise.all(keys.slice(0, Math.max(0, keys.length - 300)).map((k) => cache.delete(k)));
  });
}

function cacheFirst(request) {
  return caches.open(STATIC).then((cache) =>
    cache.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok || res.type === "opaque") cache.put(request, res.clone()).then(() => trim(cache));
      return res;
    })),
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // page loads: always the newest version; the offline page only when there is no connection
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // files whose names change with every release, our icons, and Google Fonts
  const sameOrigin = url.origin === self.location.origin;
  if ((sameOrigin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) ||
      url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(req));
  }
  // everything else (including the API) goes straight to the network, untouched
});
