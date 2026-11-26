# امنیت — SECURITY

## مدل تهدید

- داده حساس: رمز عبور کاربران، کلیدهای سرویس (AI/SERP)، محتوای اختصاصی ورک‌اسپیس‌ها
- مرزها: فرانت‌اند دمو (Pages) ↔ API ↔ سرویس‌های بیرونی

## کنترل‌های پیاده‌شده

| کنترل | پیاده‌سازی |
|---|---|
| رمز عبور | scrypt (N=16384) با salt اختصاصی؛ مقایسه timing-safe |
| نشست | JWT HS256 با انقضای ۱۲ ساعت؛ `danesh:unauthorized` → خروج UI |
| جداسازی داده | همه کوئری‌ها workspace-scoped؛ membership check؛ cross-access → 404 |
| نقش‌ها | owner/admin/editor/viewer با رتبه‌بندی در middleware |
| کلیدهای سرویس | AES-256-GCM با `APP_ENCRYPTION_KEY`؛ پاسخ‌ها فقط ماسک (`****last4`)؛ کلید هرگز به فرانت نمی‌رود |
| اعتبارسنجی ورودی | zod روی همه بدنه‌ها؛ خطا → 400 با جزئیات |
| Rate limit | auth 10/15m، api 300/m، ai 20/m، public 120/m (per IP، در حافظه) |
| CORS | لیست سفید مبدأ؛ فقط `/public/*` باز است (توکن‌محور) |
| هدرها | X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy |
| Logging | خطاها با path (بدون بدنه/کلید)؛ activity log با IP |
| Webhook | امضای HMAC-SHA256 در `X-Danesh-Signature` |
| Repo | `.env` در gitignore؛ فقط `.env.example`؛ هیچ کلید واقعی در مخزن نیست |
| ترانزیکت‌ها | TLS در استقرار (Nginx/CDN)؛ توکن فقط Bearer over HTTPS |

## توکن اشتراک‌گذاری (Public widget)

- فقط امتیاز خلاصه را می‌دهد (score/grade/criticalCount)؛ نه محتوا، نه کلیدها.
- قابل چرخش با `POST /settings/share-token` (چرخش، توکن قبلی را بی‌اعتبار می‌کند).
- Rate limit مستقل دارد.

## کارهای که کاربر باید انجام دهد

1. `JWT_SECRET` و `APP_ENCRYPTION_KEY` واقعی و یکتا per-env؛ چرخش دوره‌ای `APP_ENCRYPTION_KEY` نیازمند re-encrypt کلیدها است (قبل از چرخش از DB بکاپ بگیرید).
2. HTTPS با گواهی معتبر (Let's Encrypt).
3. بکاپ روزانه دیتابیس (`INSTALLATION.md`).
4. نگهداری `npm audit` دوره‌ای (`npm audit fix`).

## گزارش آسیب‌پذیری

لطفاً از طریق Issues خصوصی/GitHub Security Advisories همین مخزن گزارش دهید؛ گزارش‌های امنیتی به‌صورت عمومی باز نشوید.

## محدودیت‌های شناخته‌شده (شفاف)

- Rate limit و session revocation در حافظه‌اند (restart پاک می‌شود) — multi-instance در ROADMAP.
- 2FA در v0.1.0 نیست.
- لایه `secrets` برای هر workspace است؛ کلیدهای سراسری env جایگزین امن برای عملیات dev هستند، نه prod-multi-tenant.

## حساب ادمین پیش‌فرض (Easy Access)

- سرور در اولین اجرا حساب مالک را می‌سازد: «رسول بهادران» / `admin@danesh.local` / رمز `1234` + یک ورک‌اسپیس «سایت من».
- این رفتار فقط برای راحتی مالک ابزار است. **قبل از عمومی کردن سرور**:
  1. رمز را عوض کنید: `PATCH /api/v1/auth/me/password` با `{currentPassword:"1234", newPassword:"..."}` (از UI یا curl).
  2. یا از ابتدا در `.env`: `SEED_ADMIN_PASSWORD=<رمز قوی>` و `SEED_DEFAULT_ADMIN=true`.
  3. برای استقرار عمومی/چندکاربره: `SEED_DEFAULT_ADMIN=false`.
- حالت محلی مرورگر: بدون سرور و بدون حساب کاربری است؛ داده‌ها فقط در localStorage دستگاه کاربر می‌ماند (هیچ ارسالی به بیرون ندارد). هرکس داده‌های مرورگر خودش را می‌بیند — این حالت برای استفاده شخصی/تکی طراحی شده است.
