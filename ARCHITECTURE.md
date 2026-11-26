# معماری Danesh SEO Studio

## ۱. اصول طراحی

1. **موتور خالص، اپ تشریفاتی**: تمام منطق تحلیل و امتیازدهی در `packages/*` به‌صورت توابع deterministic خالص (بدون I/O) پیاده شده است؛ اپ‌ها (API/Dashboard) فقط orchestration و UI هستند. نتیجه: امتیاز یکسان در کلاینت و سرور، تست‌پذیری کامل، و قابلیت استفاده موتور به‌صورت SDK مستقل.
2. **استقلال کامل از هر CMS**: هیچ وابستگی به سایت خاصی وجود ندارد؛ اتصال از طریق لایه Connector انجام می‌شود و افزودن Connector جدید هیچ تغییری در هسته نمی‌دهد.
3. **شفافیت داده**: هر قابلیت وابسته به سرویس خارجی بدون کلید، با وضعیت ساختاریافته (`not_configured` + `howToEnable`) پاسخ می‌دهد. Mock و داده نمایشی در هیچ لایه‌ای وجود ندارد.
4. **جدا بودن داده هر وب‌سایت**: تمام جداول workspace-scoped هستند و هر درخواست از membership + role عبور می‌کند.

## ۲. لایه‌ها

```
┌───────────────────────────────────────────────────────────┐
│ apps/dashboard (Vite+React, RTL/fa)                       │
│  · ویرایشگر + امتیاز زنده سمت کلاینت (مستقیم از موتور)      │
│  · ماژول‌ها: keywords / competitors / technical / briefs   │
└───────────────▲───────────────────────────────────────────┘
                │ REST /api/v1 (JWT)
┌───────────────┴───────────────────────────────────────────┐
│ apps/api (Express + node:sqlite)                          │
│  routes → services → packages                             │
│  auth · workspaces · articles · versions · reports        │
│  ai proxy (کلید رمزنگاری‌شده) · serp · public share        │
└───────────────▲───────────────────────────────────────────┘
                │ fetch (real HTTP)
┌───────────────┴───────────────────────────────────────────┐
│ packages (هسته خالص)                                       │
│  seo-engine ─ content-analyzer ─ keyword-research          │
│  ai-engine (OpenAI-compatible) ─ website-connectors        │
└───────────────────────────────────────────────────────────┘
```

## ۳. پکیج‌ها

### @danesh/seo-engine (هسته امتیازدهی)
- `parse.ts`: پارسر سبک HTML (بدون وابستگی) → headings/paragraphs/images/links/wordCount
- `persian.ts`: نرمال‌سازی (ي→ی، ك→ک، ارقام، اعراب)، توکنایز با نیم‌فاصله، stopwords فارسی، تطبیق کلمه کلیدی با واریانت‌های ZWNJ
- `readability.ts`: قواعد فارسی — طول جمله/پاراگراف، نسبت واژه بلند، ساخت مجهول (`…ه شد/شده`)، کلمات ربط؛ انگلیسی با Flesch
- `keywords.ts`: تراکم، توزیع پاراگرافی، prominence، تشخیص Keyword Stuffing (تراکم>۳٫۵٪ / پوشش>۷۵٪ / هدینگ‌ها)، TF-IDF پیشنهاد معنایی از رقبا
- `scoring.ts`: ۱۳ معیار وزن‌دار؛ امتیاز کل = Σ(score×weight)/Σweight؛ وضعیت سبز/نارنجی/قرمز (≥۷۵/≥۵۰)
- `analyzer.ts`: orchestration + تولید Issue با priority (critical/high/medium/low)، محل، دلیل اهمیت، روش اصلاح، autoFix (برای ویرایشگر)

### @danesh/content-analyzer
- E-E-A-T به‌صورت «مجموعه شاخص قابل مشاهده» (نویسنده، تجربه، منابع معتبر، آمار، تازگی، عمق، شفافیت) با یادداشت صریح که «امتیاز رسمی گوگل نیست»
- SimHash 64-bit روی shingle های ۴-کلمه‌ای + Jaccard → تشخیص محتوای تکراری/مشابه
- کانیبالیزیشن: شباهت کلمات کلیدی اصلی بین مقالات + توصیه‌های ادغام/تفکیک
- Keyword Mapping با جلوگیری از نگاشت تکراری

### @danesh/keyword-research
- گسترش قاعده‌محور فارسی (پیشوند/پسوند)، تولید سوال، اینتنت با قواعد
- خوشه‌بندی agglomerative با Jaccard توکن‌ها
- Providers واقعی: DataForSEO (Basic auth) و SerpApi — بدون کلید → `not_configured`

### @danesh/ai-engine
- `OpenAICompatibleProvider` با baseUrl/headers قابل تنظیم (GLM/OpenAI/OpenRouter/Groq/DeepSeek/Ollama) + `fetchImpl` تزریق‌پذیر برای تست
- خطاهای تایپ‌دار: `AiNotConfiguredError` / `AiProviderError(status)`
- تسک‌ها با prompt فارسی و خروجی JSON ساختاریافته

### @danesh/website-connectors
- `WordPressConnector`: WP REST v2 + Application Password — verify/list/get/push
- `RestContractConnector`: قرارداد عمومی `/danesh-seo/*` برای هر سایت سفارشی
- Webhook با امضای HMAC-SHA256 (`X-Danesh-Signature`)
- `verifyDomainOwnership`: متا تگ یا فایل `danesh-verification.json`

## ۴. مدل داده (SQLite — node:sqlite)

`users` / `workspaces` + `workspace_members(role)` / `articles` (+`last_score_json`) / `article_versions` / `briefs` / `reports(type)` / `secrets(AES-256-GCM)` / `activity`

- همه کوئری‌های scoped با `workspace_id` فیلتر می‌شوند؛ دسترسی cross-workspace → 404 (بدون نشت).
- نسخه‌بندی: autosave هر ۵ دقیقه یک نسخه خودکار می‌سازد؛ Ctrl+S نسخه دستی؛ بازیابی قبل از بازنویسی نسخه امنیتی می‌سازد.

## ۵. جریان تحلیل

1. ویرایشگر کلاینت: هر تغییر → debounce ۳۵۰ms → `analyzeArticle()` از موتور → امتیاز/ایرادات زنده (بدون نیاز به سرور).
2. «تحلیل کامل سمت سرور»: POST `/articles/:id/analyze` → موتور + دریافت واقعی صفحات رقبا (cheerio) → پوشش معنایی و موضوعات جاافتاده → ذخیره امتیاز.
3. Audit نهایی: تحلیل + کانیبالیزیشن کل ورک‌اسپیس + (در صورت داشتن published_url) audit تکنیکال واقعی → گزارش ماندگار.

## ۶. تصمیم‌های کلیدی و دلیل

| تصمیم | دلیل |
|---|---|
| node:sqlite به‌جای better-sqlite3 | صفر وابستگی native؛ Node 22.13+ آن را داخلی دارد |
| موتور بدون I/O و بدون وابستگی | deterministic بودن امتیاز، اجرای زنده در مرورگر، تست آسان |
| JWT دست‌ساز HS256 و scrypt داخلی | حذف وابستگی‌های اضافه؛ پیاده‌سازی استاندارد و تست‌شده |
| کلیدها با AES-256-GCM در DB | محافظت از API Key در برابر لو دادن؛ ماسک در پاسخ‌ها |
| SPA روی Pages + API جدا | Pages نمی‌تواند Node/DB اجرا کند؛ دمو صراحتاً «دمو» علامت‌گذاری شده |
| cheerio فقط در سرور | پارسر موتور سبک است؛ برای HTML بیرونی از پارسر بالغ استفاده می‌کنیم |

## ۷. نقشه توسعه آینده

ROADMAP.md — شامل Crawl چندصفحه‌ای کامل، PSI با کلید، درایور Postgres، SDK منتشرشده در npm، افزونه‌های CMS بیشتر.
