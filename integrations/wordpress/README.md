# WordPress Plugin — Danesh SEO Studio Connector

افزونه رسمی اتصال وردپرس به Danesh SEO Studio.

## نصب

1. پوشه `integrations/wordpress/` را zip کنید (فایل `danesh-seo-studio.php`).
2. در وردپرس: افزونه‌ها → افزودن → بارگذاری افزونه → نصب و فعال‌سازی.
3. یک **Application Password** بسازید (کاربران → پروفایل → Application Passwords).

## اتصال در Danesh SEO Studio

در پنل Danesh، برای وب‌سایت وردپرسی:
- نوع اتصال: **REST Contract**
- Base URL: `https://your-wp-site.com`
- احراز هویت: همان کاربر وردپرس + Application Password (Basic Auth استاندارد وردپرس)

## قابلیت‌ها

| قابلیت | مسیر قرارداد | توضیح |
|---|---|---|
| تست اتصال | `GET /danesh-seo/v1/ping` | بدون احراز هویت |
| فهرست صفحات | `GET /danesh-seo/v1/pages?limit=50` | نقش `edit_posts` |
| دریافت صفحه | `GET /danesh-seo/v1/pages/:id` | نقش `edit_posts` |
| ایجاد/به‌روزرسانی صفحه | `POST /danesh-seo/v1/pages` | نقش `edit_posts` (پیش‌فرض پیش‌نویس) |
| تأیید مالکیت دامنه | متا تگ در `head` | توکن را از تنظیمات افزونه وارد کنید |

## امنیت

- همه endpointهای داده‌ای با نقش وردپرسی `edit_posts` محافظت می‌شوند.
- توکن تأیید مالکیت و Webhook Secret از صفحه تنظیمات (تنظیمات → Danesh SEO Studio) مدیریت می‌شوند.
- هیچ کلید محرمانه‌ای در کد افزونه قرار ندارد.
