// Service worker: funcționare offline (cache) + notificări push
const CACHE = "facturi-v1";
const CDN = ["cdn.tailwindcss.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Pagina și bibliotecile se servesc din cache și se reîmprospătează în fundal (Firestore nu e interceptat)
self.addEventListener("fetch", e => {
    const r = e.request, u = new URL(r.url);
    if (r.method !== "GET" || !(u.origin === location.origin || CDN.includes(u.hostname))) return;
    e.respondWith(caches.open(CACHE).then(async c => {
        const cached = await c.match(r);
        const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; })
            .catch(() => cached || Response.error());
        return cached || net;
    }));
});

self.addEventListener("push", e => {
    let p = {};
    try { p = e.data ? e.data.json() : {}; } catch (_) {}
    const d = p.data || p.notification || p;
    e.waitUntil(self.registration.showNotification(d.title || "Facturi 2027", {
        body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: "scadente", renotify: true
    }));
});

self.addEventListener("notificationclick", e => {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true })
        .then(cs => cs.length ? cs[0].focus() : self.clients.openWindow("./")));
});
