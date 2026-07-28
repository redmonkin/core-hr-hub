// Custom service worker additions for push notifications

// Approximates the unread count with however many OS notifications are
// still showing, so the installed PWA's app icon badge stays roughly in
// sync even while the app itself isn't open. The client-side badge sync
// (src/lib/appBadge.ts) takes over with the accurate DB count once the
// app is foregrounded.
function syncAppBadge() {
  if (!("setAppBadge" in self.navigator)) return Promise.resolve();

  return self.registration.getNotifications().then((notifications) => {
    if (notifications.length > 0) {
      return self.navigator.setAppBadge(notifications.length);
    }
    return self.navigator.clearAppBadge();
  });
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Peoplo", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    tag: data.title,
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Peoplo", options).then(syncAppBadge)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
      .then(syncAppBadge)
  );
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(syncAppBadge());
});
