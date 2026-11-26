# Danesh SEO Studio

> پلتفرم مستقل، ماژولار و فارسی‌محور برای تحلیل، تولید، ارزیابی و بهینه‌سازی جامع سئو — با امتیازدهی زنده، تحلیل رقبا، تحقیق کلمات کلیدی، بریف محتوا، سئو تکنیکال و دستیار AI.

**وضعیت: v0.1.0 — نسخه اولیه عملیاتی (MVP کامل)** | برنچ توسعه: `feature/complete-seo-studio`

---

## چیست؟

Danesh SEO Studio قابلیت‌های کاربردی ابزارهایی مثل Surfer SEO، NeuronWriter، Frase و Semrush را در یک محصول مستقل و قابل توسعه ارائه می‌دهد:

- **موتور امتیازدهی زنده ۰–۱۰۰** با ۱۳ معیار وزن‌دار قابل تنظیم — هر امتیاز از قواعد قابل اندازه‌گیری می‌آید و «دلیل امتیاز + روش اصلاح» همراهش است. هیچ امتیازی نمایشی یا تصادفی نیست.
- **تحلیل فارسی واقعی**: نرمال‌سازی حروف/اعداد عربی-فارسی، نیم‌فاصله (ZWNJ)، قواعد خوانایی فارسی، تشخیص ساخت مجهول و کلمات ربط فارسی — نه معیار انگلیسی بدون تطبیق.
- **شفافیت کامل درباره داده خارجی**: قابلیت‌های وابسته به سرویس بیرونی (حجم جست‌وجو، SERP، Core Web Vitals، AI) بدون کلید، با وضعیت صریح «تنظیم نشده» پاسخ می‌دهند و **هیچ داده ساختگی نمایش داده نمی‌شود**.

## قابلیت‌ها

| ماژول | شرح |
|---|---|
| ویرایشگر هوشمند | contenteditable با toolbar کامل، ذخیره خودکار، نسخه‌بندی + بازیابی + مقایسه، پیش‌نمایش گوگل، امتیاز زنده سمت کلاینت |
| امتیازدهی سئو | ۱۳ معیار (کلمات کلیدی، کیفیت، ساختار، نیت جست‌وجو، خوانایی، پوشش معنایی، هدینگ‌ها، لینک داخلی/خارجی، تصاویر، عنوان، متا، جامعیت) با وزن قابل تنظیم per-workspace |
| تحقیق کلمات کلیدی | گسترش long-tail فارسی، سوالات، اینتنت، خوشه‌بندی معنایی، نقشه کلمات، تشخیص Keyword Cannibalization |
| تحلیل رقبا | دریافت واقعی صفحات رقیب، استخراج ساختار/حجم/واژه‌ها، پوشش معنایی و موضوعات جاافتاده |
| بریف محتوا | تولید نقشه محتوایی (قاعده‌محور + رقبا + AI)، قابل ویرایش و تأیید |
| سئو تکنیکال | بررسی واقعی HTTP/ریدایرکت، title/canonical/robots/sitemap/OG/Schema/noindex، تصاویر، لینک‌های شکسته، تشخیص صفحات تکراری (SimHash)، Core Web Vitals (در صورت دسترس بودن PageSpeed API) |
| دستیار AI | عنوان، متا، مقدمه، نتیجه‌گیری، FAQ، اوتلاین، بازنویسی، گسترش، اصلاح نگارش، خوانایی — سازگار با هر سرویس OpenAI-compatible |
| مدیریت چند وب‌سایت | ورک‌اسپیس‌های کاملاً جدا با تنظیمات، مقالات، گزارش‌ها و کلیدهای رمزنگاری‌شده مستقل |
| اتصال به هر سایت | WordPress plugin، Astro/Next.js integration، REST contract، Webhook امضاشده، HTML widget |

## پیش‌نمایش آنلاین (دمو)

- **Frontend demo (GitHub Pages) — زنده و تأییدشده**: https://rasoolbahadran-stack.github.io/danesh-seo-studio/
- نسخه Pages فقط فرانت‌اند است و **صراحتاً دمو** معرفی می‌شود؛ برای عملکرد کامل باید Backend را اجرا کنید و آدرس API را در صفحه ورود وارد کنید.

## معماری در یک نگاه

```
monorepo (npm workspaces)
├── packages/            ← موتورهای خالص (TypeScript، بدون وابستگی خارجی)
│   ├── seo-engine           تحلیل + امتیازدهی + خوانایی فارسی
│   ├── content-analyzer     E-E-A-T، SimHash تشابه، کانیبالیزیشن
│   ├── keyword-research     گسترش، خوشه‌بندی، اینتنت، SERP providers
│   ├── ai-engine            provider سازگار با OpenAI + تسک‌های محتوایی
│   └── website-connectors   WordPress، REST contract، Webhook، وریفای
├── apps/
│   ├── api                  Express + node:sqlite، JWT، نقش‌ها، rate limit
│   └── dashboard            Vite + React (RTL فارسی، Vazirmatn)
├── integrations/        ← wordpress | astro | nextjs | html
└── tests/               ← E2E journeys
```

## شروع سریع

پیش‌نیاز: **Node.js ≥ 22.13** (به دلیل `node:sqlite` داخلی)

```bash
npm install
cp .env.example .env            # حداقل JWT_SECRET و APP_ENCRYPTION_KEY را تنظیم کنید
npm run build
npm run start                   # API روی :4000 — داشبورد هم سرو می‌شود
# توسعه:
npm run dev:api & npm run dev:dashboard
```

مستندات کامل: [INSTALLATION.md](INSTALLATION.md) | [DEPLOYMENT.md](DEPLOYMENT.md) | [API-DOCUMENTATION.md](API-DOCUMENTATION.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

## تست‌ها

```bash
npm test        # ۹۱ تست: Unit پکیج‌ها + Integration/E2E کل API
```

## امنیت

- کلیدهای سرویس‌ها با **AES-256-GCM** در دیتابیس رمزنگاری می‌شوند و هرگز به فرانت‌اند برنمی‌گردند (فقط ماسک‌شده).
- رمزها با scrypt هش می‌شوند؛ JWT با HS256؛ rate limit روی auth/api/ai.
- جزئیات: [SECURITY.md](SECURITY.md)

## لایسنس

UNLICENSED — محصول خصوصی.
