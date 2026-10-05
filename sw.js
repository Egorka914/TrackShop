'use strict';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'TrackShop', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'TrackShop', {
    body: data.body || '',
    icon: '/favicon-192.png',
    badge: '/favicon-96.png',
    tag: 'ts-order-' + (data.orderId || Date.now()),
    data: { url: data.url || '/admin.html' },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/admin.html';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});