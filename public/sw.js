// AIR Telehealth — Service Worker (PWA faz 1)
// Strateji (bilinçli muhafazakâr — sağlık verisi tazeliği önce gelir):
//   • /api/*           → ASLA önbellek yok, doğrudan ağ (klinik veri + kimlik)
//   • Sayfa gezinmesi  → network-first; ağ yoksa /offline.html
//   • /_next/static/*  → cache-first (içerik hash'li, değişmez) + ikonlar
// Web Push faz 2'de eklenecek.
const VERSION = "air-pwa-v1";
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // klinik veri/kimlik — her zaman canlı

  // Sayfa gezinmesi: önce ağ, düşerse offline sayfası
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Hash'li statikler + ikonlar: önce önbellek, yoksa ağdan al ve sakla
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname);
  if (cacheable) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
