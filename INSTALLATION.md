# نصب و راه‌اندازی

## پیش‌نیازها

- **Node.js ≥ 22.13** (الزامی — استفاده از `node:sqlite` داخلی؛ بررسی: `node -v`)
- npm ≥ 10
- برای استقرار production: یک سرور (VPS/Docker) با دسترسی HTTPS

## اجرای محلی (توسعه)

```bash
git clone https://github.com/rasoolbahadran-stack/danesh-seo-studio.git
cd danesh-seo-studio
git checkout feature/complete-seo-studio   # برنچ توسعه
npm install

cp .env.example .env
# مقادیر لازم:
openssl rand -hex 48   # → JWT_SECRET
openssl rand -hex 32   # → APP_ENCRYPTION_KEY

npm run dev:api         # http://localhost:4000
npm run dev:dashboard   # http://localhost:5173 (پروکسی /api به 4000)
```

## اجرای production (تک‌سروری)

```bash
npm install
npm run build           # پکیج‌ها + API + Dashboard
cp .env.example .env    # مقادیر واقعی — NODE_ENV=production
npm run start           # API روی :4000 — داشبورد بیلد‌شده را هم سرو می‌کند
```

اگر پوشه `apps/dashboard/dist` موجود باشد، API آن را روی `/` سرو می‌کند (fallback به index.html برای SPA).

## متغیرهای محیطی

| متغیر | الزامی | توضیح |
|---|---|---|
| `PORT` | خیر (4000) | پورت API |
| `DATABASE_PATH` | خیر | مسیر فایل SQLite (دایرکتوری باید قابل نوشتن باشد) |
| `JWT_SECRET` | **بله در prod** | `openssl rand -hex 48` |
| `APP_ENCRYPTION_KEY` | **بله در prod** | `openssl rand -hex 32` — برای AES کلیدهای سرویس‌ها |
| `CORS_ORIGIN` | خیر | مبدأهای مجاز داشبورد، جدا با کاما |
| `AI_BASE_URL/AI_API_KEY/AI_MODEL` | خیر | AI پیش‌فرض سراسری (یا per-workspace از پنل) |
| `DATAFORSEO_LOGIN/PASSWORD`, `SERPAPI_KEY` | خیر | سرویس داده SERP (پولی) |
| `RATE_LIMIT_*` | خیر | سقف درخواست‌ها |

## پشتیبان‌گیری

دیتابیس یک فایل SQLite است (پیش‌فرض `./data/danesh-seo-studio.db`):

```bash
# بکاپ روزانه (توصیه: cron)
sqlite3 data/danesh-seo-studio.db ".backup 'backup-$(date +%F).db'"
# یا کپی ساده با WAL در نظر گرفته شود (توقف لحظه‌ای سرویس یا sqlite3 .backup)
```

## اولین ورود

1. `http://localhost:4000` → ثبت‌نام → ساخت وب‌سایت.
2. تنظیمات وب‌سایت → تب هوش مصنوعی → Base URL/Model/API Key → تست اتصال.
3. مقاله جدید → ویرایشگر → تحلیل زنده.

## رفع اشکال

| خطا | راه‌حل |
|---|---|
| `node:sqlite` not supported | Node را به ≥22.13 ارتقا دهید |
| 500 در production با پیام JWT_SECRET | مقدار واقعی تنظیم کنید |
| CORS در داشبورد مستقر | `CORS_ORIGIN` شامل آدرس Pages باشد |
| صفحه خالی بعد از deploy Pages | آدرس API را در صفحه ورود وارد کنید (نسخه Pages دمو است) |

## حساب آماده مالک (بدون ثبت‌نام)

در اولین اجرای سرور، این مقادیر به‌صورت خودکار seed می‌شوند (قابل تغییر در .env):

```
SEED_DEFAULT_ADMIN=true          # false = غیرفعال
SEED_ADMIN_NAME=رسول بهادران
SEED_ADMIN_EMAIL=admin@danesh.local
SEED_ADMIN_PASSWORD=1234
SEED_WORKSPACE_NAME=سایت من
```

ورود: در صفحه ورود، دکمه «ورود سریع — رسول بهادران (ادمین)». تغییر رمز بعد از ورود: PATCH /api/v1/auth/me/password.
اگر سروری ندارید: داشبورد Pages را باز کنید و «ورود بدون سرور» را بزنید — بدون هیچ نصبی کار می‌کند (داده‌ها در مرورگر می‌ماند).
