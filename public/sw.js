// Service worker aplikace Kancelář. ZÁMĚRNĚ MINIMÁLNÍ: do zařízení se neukládá žádný obsah aplikace, jen stránka „Jste offline“.
// Spisy, klienti, lhůty ani odpovědi API se nikdy neukládají, takže ztracený nebo sdílený telefon z nich nic neprozradí.
const CACHE = 'kancelar-offline-v2';
const OFFLINE = '/offline';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: 'reload' }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Jen přechod na stránku, a jen když selže síť; vše ostatní jde přímo na server
    if (req.method !== 'GET' || req.mode !== 'navigate') return;
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) ?? new Response('Jste offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});

// Push upozornění: text je obecný (počty lhůt), žádné názvy věcí ani klientů
self.addEventListener('push', (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch { /* nic */ }
    const title = typeof d.title === 'string' ? d.title.slice(0, 80) : 'Kancelář';
    event.waitUntil(self.registration.showNotification(title, {
        body: typeof d.body === 'string' ? d.body.slice(0, 200) : '', tag: typeof d.tag === 'string' ? d.tag.slice(0, 60) : 'kancelar',
        icon: '/pwa-icon/any-192', badge: '/pwa-icon/any-192', data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/kancelar' },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/kancelar';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => undefined); return c.focus(); } }
        return self.clients.openWindow(url);
    }));
});
