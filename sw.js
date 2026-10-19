/* Service Worker — حساب‌گر قیمت شیرینی و کیک
   -----------------------------------------------------------------------------------------------
   وظیفه‌ی این فایل فقط «کش کردن خودِ برنامه» است تا بدون اینترنت هم باز بشه. به اطلاعات کاربر
   (localStorage / IndexedDB) هیچ دسترسی و هیچ کاری ندارد.

   قواعد مهم (tests.js چند تاشون رو خودکار چک می‌کنه):
   1) CACHE_NAME با APP_VERSION داخل index.html و version.json هماهنگ است. موقع بالا بردن نسخه‌ی برنامه،
      هر سه مقدار را با هم عوض کن؛ همین تغییرِ CACHE_NAME باعث می‌شه مرورگر نسخه‌ی جدید را نصب کند.
   2) آدرس github.io بین چند برنامه‌ی مختلف مشترکه. این فایل فقط کش‌هایی که اسمشون با «ccalc-shell-»
      شروع می‌شه پاک می‌کنه و فقط فایل‌های همین برنامه را (فهرست ثابت پایین) کش/سرو می‌کنه؛
      کش یا درخواست‌های برنامه‌های دیگه دست‌نخورده می‌مونه.
   3) نسخه‌ی جدید نصب می‌شه ولی «در انتظار» می‌مونه (skipWaiting در install صدا زده نمی‌شه)؛ فقط وقتی کاربر
      داخل برنامه «بروزرسانی» را بزنه (پیام SKIP_WAITING) فعال می‌شه. پس صفحه‌ی باز وسط کار عوض نمی‌شه.
   4) صفحه‌ی اصلی موقع نصب با «no-cache» دانلود و بررسی می‌شه که واقعاً همین نسخه باشه؛ اگه سرور/شبکه هنوز
      نسخه‌ی قدیمی را می‌داد (مثلاً چند دقیقه بعد از انتشار)، نصب شکست می‌خوره و بعداً دوباره تلاش می‌شه؛
      نسخه‌ی قبلی و اطلاعات کاربر سالم می‌مونه.
   5) version.json هیچ‌وقت از کش سرو نمی‌شه (no-store)؛ وگرنه تشخیص «نسخه‌ی جدید» قابل‌اعتماد نیست. */
const CACHE_PREFIX = 'ccalc-shell-';
const CACHE_NAME = 'ccalc-shell-v0.4.0';
const VERSION = CACHE_NAME.slice(CACHE_PREFIX.length + 1);          // مثلاً «0.4.0»؛ همان چیزی که در index.html به‌صورت APP_VERSION نوشته شده
const PAGE = './';
const OPTIONAL_ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png', './fonts/Vazirmatn-subset.woff2'];

function pathOf(url) { return new URL(url, self.location.href).pathname; }
const PAGE_PATHS = [pathOf(PAGE), pathOf('./index.html')];
const ASSET_PATHS = OPTIONAL_ASSETS.map(pathOf);

async function precache() {
  // صفحه‌ی اصلی ضروری است: باید دریافت بشه و دقیقاً همین نسخه باشه، وگرنه کل نصب شکست می‌خوره
  // (و چون کش بعد از این بررسی باز می‌شه، نصبِ ناموفق هیچ کش نصفه‌ای از خودش جا نمی‌ذاره)
  const res = await fetch(PAGE, { cache: 'reload' });
  if (!res || !res.ok) throw new Error('shell-fetch-failed');
  const html = await res.clone().text();
  if (html.indexOf("const APP_VERSION = '" + VERSION + "'") === -1) throw new Error('shell-version-mismatch');
  const cache = await caches.open(CACHE_NAME);
  await cache.put(PAGE, res.clone());
  await cache.put('./index.html', res.clone());
  // بقیه‌ی فایل‌ها (آیکون، فونت، manifest) هر کدوم جدا؛ گم یا خراب بودن یکی‌شون نباید کل نصب را خراب کنه
  await Promise.allSettled(OPTIONAL_ASSETS.map(async (url) => {
    const r = await fetch(url, { cache: 'reload' });
    if (r && r.ok) await cache.put(url, r);
  }));
}

self.addEventListener('install', (e) => {
  // عمداً skipWaiting اینجا صدا زده نمی‌شه: نسخه‌ی جدید نصب می‌شه ولی در حالت «waiting» می‌مونه
  // تا کاربر صریحاً از داخل برنامه روی «بروزرسانی» بزنه (پیام SKIP_WAITING پایین همین فایل).
  e.waitUntil(precache());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // فقط کش‌های قدیمیِ همین برنامه؛ هیچ کش دیگری (برنامه‌های دیگه روی همین آدرس) دست نمی‌خوره
      .then((keys) => Promise.all(keys
        .filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// فقط وقتی خودِ برنامه (نه مرورگر) صریحاً درخواست کنه، نسخه‌ی در حال انتظار فعال می‌شه
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const OFFLINE_HTML = '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>حساب‌گر قنادی</title><body style="font-family:sans-serif;padding:32px;line-height:1.9;text-align:center">' +
  '<h2>اتصال اینترنت قطع است</h2><p>این برنامه هنوز روی این گوشی ذخیره نشده است. یک بار با اینترنت بازش کنید؛ بعد از آن بدون اینترنت هم کار می‌کند. اطلاعات شما در امان است.</p></body></html>';

async function fromCache(req, ignoreSearch) {
  const cache = await caches.open(CACHE_NAME);            // فقط کش همین برنامه، نه همه‌ی کش‌های آدرس
  return cache.match(req, { ignoreSearch: !!ignoreSearch });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // فقط فایل‌های خودِ برنامه

  // version.json هیچ‌وقت نباید از کش قدیمی سرو بشه، وگرنه خود همین فایل نمی‌تونه برای تشخیص
  // نسخه‌ی جدید قابل‌اعتماد باشه. همیشه مستقیم از شبکه؛ نه خوانده می‌شه نه نوشته می‌شه توی کش.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // صفحه‌ی اصلی: همیشه نسخه‌ی هم‌نسخه با همین Service Worker (کش اول)؛ بدون اینترنت هم باز می‌شه.
  if (req.mode === 'navigate' && PAGE_PATHS.indexOf(url.pathname) !== -1) {
    e.respondWith(
      fromCache(PAGE, true)
        .then((hit) => hit || fetch(req))
        .catch(() => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    );
    return;
  }

  // فایل‌های ثابت برنامه (آیکون، فونت، manifest): کش اول؛ اگه نبود از شبکه می‌گیره و برای دفعه‌ی بعد نگه می‌داره
  if (ASSET_PATHS.indexOf(url.pathname) !== -1) {
    e.respondWith(
      fromCache(req, false).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }
  // هر چیز دیگه (از جمله فایل‌های برنامه‌های دیگه روی همین آدرس): دست نمی‌زنیم؛ مرورگر خودش مدیریت می‌کنه.
});
