// نسخه‌ی کش با نسخه‌ی برنامه هماهنگه (APP_VERSION توی خود فایل اصلی و version.json). موقع بالا
// بردن نسخه‌ی برنامه، این مقدار (و version.json) رو هم دستی به‌روز کن — tests.js این هماهنگی رو
// به‌صورت خودکار چک می‌کنه تا این مورد فراموش نشه.
const CACHE_NAME = 'ccalc-shell-v0.3.0';
const ASSETS = ['./', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  // عمداً skipWaiting اینجا صدا زده نمی‌شه: نسخه‌ی جدید نصب می‌شه ولی در حالت «waiting» می‌مونه
  // تا کاربر صریحاً از داخل برنامه روی «بروزرسانی» بزنه (پیام SKIP_WAITING پایین همین فایل).
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // هر فایل جدا کش می‌شه؛ گم یا خراب بودن یکی (مثلاً یه آیکون) نباید کل نصب رو خراب کنه
      Promise.allSettled(ASSETS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// فقط وقتی خودِ برنامه (نه مرورگر) صریحاً درخواست کنه، نسخه‌ی در حال انتظار فعال می‌شه
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // version.json هیچ‌وقت نباید از کش قدیمی سرو بشه، وگرنه خود همین فایل نمی‌تونه برای تشخیص
  // نسخه‌ی جدید قابل‌اعتماد باشه. همیشه مستقیم از شبکه؛ نه خوانده می‌شه نه نوشته می‌شه توی کش.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
