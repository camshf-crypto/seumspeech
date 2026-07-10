// public/sw.js - 푸시 알림 수신용 서비스워커

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "세움스피치", body: event.data ? event.data.text() : "새 알림" };
  }

  const title = data.title || "세움스피치";
  const options = {
    body: data.body || "새로운 상담 문의가 있습니다.",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: data.tag || "seum-inquiry",
    data: { url: data.url || "/admin" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭하면 해당 페이지 열기
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});