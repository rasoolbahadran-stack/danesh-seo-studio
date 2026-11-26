# تست و کنترل کیفیت

## اجرا

```bash
npm test     # = build پکیج‌ها + vitest run
```

## ترکیب تست‌ها (۷۹ تست، همگی سبز)

### ۱) Unit — پکیج‌ها (۵۰ تست)

| فایل | پوشش |
|---|---|
| `packages/seo-engine/src/engine.test.ts` (19) | نرمال‌سازی فارسی، توکنایز ZWNJ، تطبیق کلمه کلیدی با واریانت‌ها، پارس HTML، تراکم و Stuffing، فرمول امتیاز وزنی، تشخیص H1/متا، خوانایی، semantic coverage با رقبا، determinism |
| `packages/content-analyzer/src/content-analyzer.test.ts` (7) | E-E-A-T indicators، SimHash نزدیک‌تکراری/متفاوت، کانیبالیزیشن، mapping تداخل |
| `packages/keyword-research/src/keyword-research.test.ts` (8) | اینتنت فارسی، گسترش long-tail، سوالات، سختی برآوردی، خوشه‌بندی، SERP `not_configured` + DataForSEO با mock + خطای صادقانه |
| `packages/ai-engine/src/ai-engine.test.ts` (8) | provider با fetch تزریقی، خطای ۴۰۱/۴۲۹ با status، timeout/شبکه، استخراج JSON، تسک‌ها |
| `packages/website-connectors/src/connectors.test.ts` (8) | WP verify/list/push + خطا، REST contract، webhook HMAC، وریفای دامنه (متا/فایل/نبود نشانه) |

### ۲) Integration — کل API (۲۹ تست) با دیتابیس in-memory و سرور فیکسچر HTTP محلی

- سلامت/Feature flags، جریان auth (ثبت‌نام/ورود/me + ۴۰۱ + validation 400 + rate limit 429)
- ساخت ورک‌اسپیس، **جداسازی داده بین کاربران (404 بدون نشت)**، وزن‌ها و stats
- مقالات: ایجاد (نسخه ۱)، autosave + forceSave نسخه، diff واقعی، بازیابی نسخه
- تحلیل زنده: ۱۳ معیار، ذخیره امتیاز، Audit نهایی با کانیبالیزیشن واقعی
- تحقیق کلمات: گسترش/سوالات/خوشه + dataProvenance شفاف، mapping با تداخل، SERP `not_configured`
- رقبا: دریافت فیکسچر واقعی، مقایسه، خطای ۴۰۴ شفاف
- تکنیکال: صفحه سالم (title/canonical/schema/OG/viewport/HTTP-passed) و صفحه noindex (critical)
- بریف: تولید قاعده‌محور + تأیید؛ گزارش‌ها با type filter
- AI: بدون کلید → `AI_NOT_CONFIGURED`؛ تسک نامعتبر → 400؛ provider مرده → 502؛ کلید هرگز در پاسخ نیست
- **E2E journey**: ثبت‌نام → ورک‌اسپیس → بریف (با رقبا) → مقاله → تحلیل → autosave → audit → گزارش
- Public share endpoint: توکن معتبر/نامعتبر/NO_REPORT

### ۳) Smoke — production build واقعی

`node dist/index.js` با `node:sqlite` → register → workspace → article → analyze (score واقعی) → public endpoint. این تست باگ واقعی rewrite شدن `node:sqlite` توسط باندلر را کشف و رفع کرد.

## چه چیزی پوشش داده نشده (شفاف)

- **E2E مرورگر (Playwright)**: نصب نشده (دانلود مرورگرها در این محیط انجام نشد). UI با typecheck + build + منطق سمت کلاینت که همان موتور تست‌شده است پوشش داده شده؛ اجرای Playwright در ROADMAP.
- تست زنده روی پروژه نمونه Astro/Next: integrationها unit-level تأیید شده‌اند.
- Core Web Vitals زنده: وابسته به دسترسی شبکه/کلید PageSpeed — در محیط تست `not_available` (رفتار درست).

## CI

`.github/workflows/ci.yml`: روی هر push/PR → `npm ci` → `npm run build` → `npm test` با Node 22.
