// portamed — Service Worker (PWA faz 2: Web Push)
// Strateji (bilinçli muhafazakâr — sağlık verisi tazeliği önce gelir):
//   • /api/*           → ASLA önbellek yok, doğrudan ağ (klinik veri + kimlik)
//   • Sayfa gezinmesi  → network-first; ağ yoksa /offline.html
//   • /_next/static/*  → cache-first (içerik hash'li, değişmez) + ikonlar
//   • push             → tarayıcı kapalıyken bildirim göster; tıklayınca ilgili sayfa
const VERSION = "air-pwa-v3";
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

// ── Web Push: tarayıcı kapalıyken bildirim göster ──
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "portamed";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "tr",
      data: { href: data.href || "/" },
    })
  );
});

// Bildirime tıklama: açık sekme varsa odaklan + yönlendir, yoksa yeni pencere
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          tab.focus();
          if ("navigate" in tab) tab.navigate(href);
          return;
        }
      }
      return clients.openWindow(href);
    })
  );
});
