# ROADMAP

## نسخه 0.1.0 — فعلی (MVP کامل)

- موتور امتیازدهی ۱۳ معیار فارسی‌محور + ویرایشگر زنده + نسخه‌بندی
- تحقیق کلمات (قاعده‌محور + خوشه‌بندی)، رقبا، بریف، تکنیکال، Audit نهایی
- AI سازگار با هر provider OpenAI-compatible
- Multi-workspace + نقش‌ها + رمزنگاری کلیدها
- اتصال: WordPress plugin، Astro، Next.js، HTML widget، Webhook

## 0.2 — عمق تحلیل

- [ ] Crawler چندصفحه‌ای کامل از sitemap (نمودار لینک داخلی، صفحات یتیم، عنوان/متای تکراری در سطح سایت)
- [ ] PageSpeed API با کلید و صف‌بندی + تاریخچه Core Web Vitals
- [ ] مقایسه نسخه‌ها به‌صورت word-level با هایلایت در خود ویرایشگر
- [ ] گزارش E-E-A-T قابل چاپ/اشتراک

## 0.3 — داده و تیم

- [ ] درایور Postgres برای مقیاس (لایه Repos جدا شده است)
- [ ] Rate limit مشترک با Redis برای چند instance
- [ ] دعوت اعضا با ایمیل + نوتیفیکیشن
- [ ] تاریخچه امتیاز و نمودار روند per-article

## 0.4 — اکوسیستم

- [ ] انتشار پکیج‌ها در npm (`@danesh/seo-engine` به‌عنوان SDK عمومی)
- [ ] افزونه‌های CMS بیشتر (Drupal، Ghost)
- [ ] Webhook events کامل (article.published, score.changed)
- [ ] چندزبانه‌سازی UI (fa/en) — موتور از الان دو زبانه است

## 1.0 — محصول عمومی

- [ ] Billing و پلن‌ها (اتصال DataForSEO با تفکیک هزینه کاربر)
- [ ] داشبورد تجمیعی چندسایته + مقایسه عملکرد سایت‌ها
- [ ] E2E مرورگر Playwright در CI
- [ ] Audit خودکار زمان‌بندی‌شده (cron per workspace)
