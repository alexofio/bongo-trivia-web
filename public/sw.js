/* Bongo Trivia — service worker for web notifications only (no caching: the site always loads fresh).
   The portal sends { title, body, tag, url } when other players are playing (at most once an hour, 08:00–21:00 EAT). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Bongo Trivia', {
    body: d.body || '', tag: d.tag || 'bt-live', renotify: false,
    icon: '/img/icon-192.png', badge: '/favicon-32.png', lang: 'sw',
    data: { url: d.url || '/#play' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/#play', self.location.origin);
  if (url.origin !== self.location.origin) return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (new URL(c.url).origin === url.origin && 'focus' in c) { c.navigate(url.href).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url.href);
  }));
});
