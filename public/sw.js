// Service worker aplikace Kancelář. ZÁMĚRNĚ MINIMÁLNÍ: do zařízení se neukládá žádný obsah aplikace, jen stránka „Jste offline“.
// Spisy, klienti, lhůty ani odpovědi API se nikdy neukládají, takže ztracený nebo sdílený telefon z nich nic neprozradí.
const CACHE = 'kancelar-offline-v1';
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
