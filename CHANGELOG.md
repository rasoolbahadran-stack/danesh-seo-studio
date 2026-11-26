# CHANGELOG

تمام تغییرات قابل توجه این پروژه در این فایل ثبت می‌شود.

## [0.1.0] — 2026-11-26

### Added (packages)
- `@danesh/seo-engine`: موتور تحلیل و امتیازدهی ۱۳ معیار وزن‌دار، نرمال‌سازی و توکنایز فارسی (ZWNJ، ارقام)، خوانایی فارسی، تشخیص Keyword Stuffing، TF-IDF معنایی از رقبا، تولید Issue اولویت‌دار با autoFix
- `@danesh/content-analyzer`: شاخص‌های E-E-A-T (با یادداشت صریح «امتیاز گوگل نیست»)، SimHash/Jaccard تشابه، کانیبالیزیشن و Keyword Mapping
- `@danesh/keyword-research`: گسترش long-tail فارسی، سوالات، اینتنت، خوشه‌بندی، Providers واقعی DataForSEO/SerpApi با وضعیت شفاف
- `@danesh/ai-engine`: provider سازگار OpenAI، تسک‌های محتوایی فارسی، خطاهای تایپ‌دار
- `@danesh/website-connectors`: WordPress REST، قرارداد REST عمومی، Webhook HMAC، وریفای دامنه

### Added (apps)
- `@danesh/api`: Express + node:sqlite؛ auth (scrypt/JWT)، multi-workspace با نقش‌ها، مقالات + autosave + نسخه‌بندی + diff، تحلیل/Audit، AI proxy با کلید رمزنگاری‌شده، SERP، تکنیکال، رقبا، بریف، گزارش‌ها، public share endpoint، rate limit، security headers، activity log
- `@danesh/dashboard`: SPA فارسی RTL (Vazirmatn)؛ ویرایشگر زنده با امتیاز سمت کلاینت، نسخه‌ها/مقایسه، پیش‌نمایش گوگل، پنل‌های ایرادات/کلمات/خوانایی/لینک‌ها/متا، ماژول‌های کامل، تنظیمات وزن و AI/SERP

### Added (integrations)
- WordPress plugin (قرارداد REST + push + متا وریفای + صفحه تنظیمات)، Astro integration، Next.js route handler + badge، HTML widget

### Added (infra/docs)
- CI، deploy-pages، Dockerfile/compose، ۱۰+ فایل مستندات، .env.example

### Fixed
- تطبیق کلمه کلیدی با واریانت‌های ZWNJ در متن (canonicalize)
- استخراج Schema قبل از حذف script تگ‌ها در audit تکنیکال
- `mergeParams` روترهای Express (باگ 401 مقاله‌ها)
- ZodError → 400 (به‌جای 500) با پیام فارسی
- بارگذاری `node:sqlite` در باندل production (esbuild بازنویسی می‌کرد)

### Tests
- ۷۹ تست سبز (۵۰ unit + ۲۹ integration/E2E) + smoke production

## [0.1.1] — 2026-11-26 (Easy Access)

### Added
- **حالت محلی مرورگر (بدون سرور)**: ورود یک‌کلیکی بدون API — ورک‌اسپیس/مقالات/نسخه‌ها/بریف/گزارش در localStorage، تحلیل زنده و تحقیق کلمات و بریف با همان موتورهای پکیج در مرورگر؛ قابلیت‌های فقط-سرور با پیام شفاف LOCAL_UNSUPPORTED
- **حساب ادمین پیش‌فرض مالک**: seed خودکار «رسول بهادران» (admin@danesh.local / 1234) + ورک‌اسپیس «سایت من» در اولین اجرا؛ قابل تنظیم/غیرفعال با SEED_*
- دکمه «ورود سریع ادمین» و «ورود بدون سرور» در صفحه ورود؛ فرم پیشرفته جمع‌شده
- تغییر رمز عبور: PATCH /auth/me/password
- مولد بریف قاعده‌محور به @danesh/keyword-research منتقل شد (استفاده مشترک سرور و کلاینت)
- مقاله نمونه با برچسب «قابل حذف» در حالت محلی برای شروع فوری

### Fixed
- persist شدن امتیاز تحلیل در localDb؛ پارس query string در dispatcher محلی
