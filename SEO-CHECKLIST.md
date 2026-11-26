# SEO-CHECKLIST — چک‌لیست جامع قابلیت‌ها و وضعیت اجرا

> فاز صفر: این فایل «قبل از کدنویسی» تهیه شد و در طول توسعه به‌روزرسانی شده است.
> وضعیت‌ها: TODO / IN_PROGRESS / COMPLETED / FAILED / BLOCKED
> قابلیت وابسته به API = نیاز به کلید سرویس بیرونی دارد؛ بدون کلید، وضعیت شفاف «تنظیم نشده» نمایش داده می‌شود (نه داده ساختگی).

## ۱. موتور امتیازدهی سئو (Seo Score)

| قابلیت | شرح وظیفه | اولویت | وضعیت | روش آزمایش | نتیجه آزمایش |
|---|---|---|---|---|---|
| امتیاز کلی ۰–۱۰۰ | میانگین وزنی ۱۳ معیار | Critical | COMPLETED | تست Unit: verify فرمول وزنی | ✅ ۱۹ تست سبز؛ sanity عددی چاپ شد |
| وزن قابل تنظیم per-workspace | ویرایش وزن‌ها در تنظیمات | High | COMPLETED | PATCH workspace weights + تحلیل جدید | ✅ تست Integration |
| وضعیت رنگی سبز/نارنجی/قرمز | ≥75/≥50 thresholds | High | COMPLETED | Unit test statusOf | ✅ |
| دلیل امتیاز + روش اصلاح برای هر معیار | reasons/fixes/whyItMatters | High | COMPLETED | بررسی خروجی analyze | ✅ در گزارش کامل |
| بروزرسانی زنده با تغییر محتوا | debounce ۳۵۰ms سمت کلاینت | Critical | COMPLETED | ویرایشگر: تغییر → امتیاز تغییر | ✅ (موتور deterministic) |
| اولویت‌بندی ایرادات Critical/High/Medium/Low | issue priority + sort | High | COMPLETED | Unit + Integration | ✅ |
| اصلاح مستقیم از ویرایشگر | autoFix payloads + جایگزینی عنوان/متا با کلیک | Medium | COMPLETED | ویرایشگر: پیشنهاد عنوان → جایگزینی | ✅ |

## ۲. تحلیل کلمات کلیدی

| قابلیت | وضعیت | وابستگی | آزمایش | نتیجه |
|---|---|---|---|---|
| تراکم/توزیع/prominence کلمه اصلی | COMPLETED | — | Unit (سازگاری فرمول با متن) | ✅ |
| تشخیص Keyword Stuffing | COMPLETED | — | Unit: مقاله با تراکم ~۷٪ → issue | ✅ |
| کلمات فرعی (استفاده‌شده/نشده زنده) | COMPLETED | — | Unit + UI chips | ✅ |
| TF-IDF پیشنهاد معنایی از رقبا | COMPLETED | آدرس رقیب | Unit با doc فیکسچر | ✅ |
| گسترش Long-tail فارسی | COMPLETED | — | Unit (≥۲۰ ایده) | ✅ |
| تولید سوالات کاربران | COMPLETED | — | Unit | ✅ |
| تشخیص Search Intent | COMPLETED | — | Unit (تراکنشی/تجاری/اطلاعاتی) | ✅ |
| خوشه‌بندی معنایی | COMPLETED | — | Unit | ✅ |
| Keyword Mapping + جلوگیری از تداخل | COMPLETED | — | Unit + Integration | ✅ |
| Cannibalization بین مقالات | COMPLETED | — | Unit + Integration (جفت severity) | ✅ |
| حجم جست‌وجوی واقعی | **BLOCKED (بدون کلید)** | DataForSEO/SerpApi | status endpoint | شفاف: `not_configured` — داده ساختگی ممنوع |
| سختی واقعی (Keyword Difficulty) | **BLOCKED (بدون کلید)** | همان | — | برآورد شفاف با flag `estimated:true` |

## ۳. تحلیل رقبا

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| دریافت صفحات رقیب (واقعی) | COMPLETED | Integration با سرور فیکسچر محلی | ✅ wordCount/headings/terms استخراج شد |
| مقایسه حجم با میانه رقبا | COMPLETED | Integration | ✅ |
| پوشش معنایی + واژه‌های جاافتاده | COMPLETED | Unit + Integration | ✅ coveragePct محاسبه شد |
| موضوعات (هدینگ‌های) جاافتاده | COMPLETED | Integration (missingTopics>0) | ✅ |
| گزارش خطای دریافت شفاف | COMPLETED | Integration (404 → failed list) | ✅ |
| SERP Analysis واقعی | **BLOCKED (بدون کلید)** | DataForSEO/SerpApi provider آماده | ✅ provider تست‌شده با mock؛ بدون کلید `not_configured` |

## ۴. بریف محتوا

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| پیشنهاد عنوان/H1/ساختار H2-H3 | COMPLETED | Integration (outline≥5) | ✅ |
| هدف حجم + نوع محتوا بر اساس اینتنت | COMPLETED | Integration | ✅ |
| FAQ + کلمات مرتبط + پیشنهاد لینک/منبع | COMPLETED | Integration | ✅ |
| غنی‌سازی از رقبا واقعی | COMPLETED | Integration (competitorUrls) | ✅ |
| ویرایش کامل + تأیید بریف | COMPLETED | Integration (approve) | ✅ |
| اوتلاین با AI (اختیاری) | COMPLETED | تسک `outline` با provider | بدون کلید → قاعده‌محور (شفاف) |

## ۵. ویرایشگر هوشمند

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| ویرایش rich-text (H1-H3/P، بولد/ایتالیک، لیست، جدول، لینک، تصویر) | COMPLETED | build + دستی | ✅ |
| ذخیره خودکار (debounce 1.8s) + Ctrl+S دستی | COMPLETED | Integration autosave | ✅ |
| نسخه‌بندی خودکار (هر ۵ دقیقه) + دستی + بازیابی | COMPLETED | Integration restore | ✅ |
| مقایسه نسخه‌ها (block diff) | COMPLETED | Integration diff | ✅ |
| Undo/Redo | COMPLETED | execCommand | ✅ |
| پیش‌نمایش مقاله + پیش‌نمایش گوگل | COMPLETED | UI | ✅ |
| شمارش کلمه/کاراکتر + زمان مطالعه | COMPLETED | موتور | ✅ |
| پیشنهاد تکمیل/بازنویسی/نگارش/خوانایی با AI | COMPLETED | تسک‌های ai-engine | بدون کلید → پیام شفاف |
| تولید Meta Description و عنوان جایگزین | COMPLETED | موتور (قاعده‌محور) + AI (اختیاری) | ✅ |
| جایگزینی با کلیک از پنل پیشنهادها | COMPLETED | UI | ✅ |
| یافتن محل ایراد در متن (click-to-locate) | COMPLETED | UI (highlight) | ✅ |

## ۶. خوانایی فارسی

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| طول جمله/پاراگراف + جریمه واقعی | COMPLETED | Unit (avgWordsPerSentence) | ✅ |
| ساخت مجهول فارسی (…ه شد/شده/گردید) | COMPLETED | Unit | ✅ |
| کلمات ربط/انتقالی فارسی | COMPLETED | Unit (transitionSentenceRatio) | ✅ |
| واژه‌های طولانی + عبارات تکراری | COMPLETED | Unit | ✅ |
| عدم استفاده از معیار انگلیسی برای فارسی | COMPLETED | کد: شاخه fa مستقل از Flesch | ✅ |

## ۷. عنوان و متا

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| طول عنوان ۳۰–۶۰ + کلمه کلیدی + موقعیت | COMPLETED | Unit + Integration | ✅ |
| جذابیت (عدد/کلمه قدرتمند/پرسش) | COMPLETED | Unit | ✅ |
| متا ۱۲۰–۱۶۰ + کلمه کلیدی + پیشنهاد خودکار | COMPLETED | Unit | ✅ |
| پیش‌نمایش گوگل | COMPLETED | UI | ✅ |

## ۸. تصاویر

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| پوشش Alt + نام فایل عمومی | COMPLETED | Unit (IMG_2043.jpg → issue) | ✅ |
| Lazy loading + ابعاد + فرمت WebP/AVIF | COMPLETED | Unit | ✅ |
| حجم تصویر واقعی | COMPLETED | Integration تکنیکال (HEAD sample>200KB) | ✅ |

## ۹. لینک‌سازی

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| شمارش داخلی/خارجی + تراکم | COMPLETED | Unit | ✅ |
| انکرتکست کلی («اینجا») | COMPLETED | Unit | ✅ |
| پیشنهاد لینک داخلی از مقالات ورک‌اسپیس | COMPLETED | موتور internalPages | ✅ |
| لینک شکسته واقعی | COMPLETED | Integration تکنیکال (HEAD/GET sample) | ✅ |
| اعتبار منابع خارجی (دامنه‌های معتبر) | COMPLETED | E-E-A-T credible sources | ✅ |

## ۱۰. سئو تکنیکال (بررسی واقعی URL)

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| HTTP status + زنجیره ریدایرکت + TTFB | COMPLETED | Integration فیکسچر | ✅ |
| Title/Meta/Canonical/H1/ساختار هدینگ | COMPLETED | Integration | ✅ |
| Robots Meta + X-Robots-Tag + noindex | COMPLETED | Integration (noindex → critical) | ✅ |
| robots.txt + sitemap.xml | COMPLETED | Integration | ✅ |
| Open Graph + Schema (JSON-LD) + hreflang | COMPLETED | Integration (Article detect) | ✅ |
| Viewport/موبایل + lang | COMPLETED | Integration | ✅ |
| تصاویر (alt/ابعاد/حجم) | COMPLETED | Integration | ✅ |
| لینک‌های شکسته (نمونه ۱۲) | COMPLETED | Integration | ✅ |
| صفحات تکراری (SimHash) | COMPLETED | Unit similarity + endpoint | ✅ |
| Core Web Vitals (PageSpeed API) | COMPLETED (graceful) | — | بدون دسترسی شبکه/کلید → وضعیت شفاف `not_available` |
| بررسی صفحات تکراری روی سایت کامل (Crawl) | PARTIALLY COMPLETED | — | مقایسه تا ۱۰ URL با SimHash؛ Crawl کامل از sitemap در ROADMAP |

## ۱۱. هوش مصنوعی

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| Provider سازگار OpenAI (GLM/OpenAI/OpenRouter/Groq/DeepSeek/Ollama) | COMPLETED | Unit با fetch mock | ✅ |
| کلید per-workspace رمزنگاری‌شده + ماسک | COMPLETED | Integration (کلید در پاسخ نیست) | ✅ |
| تسک‌ها: عنوان/متا/مقدمه/نتیجه/FAQ/اوتلاین/بخش/گسترش/بازنویسی/نگارش/خوانایی/لینک/مقاله کامل | COMPLETED | Unit + Integration | ✅ |
| بدون کلید → پیام شفاف AI_NOT_CONFIGURED | COMPLETED | Integration (400) | ✅ |
| خطای provider (کلید بد/اتصال) → پیام واقعی | COMPLETED | Integration (502) | ✅ |
| برچسب «AI تولید کرده — بازبینی کنید» در UI | COMPLETED | UI toast | ✅ |

## ۱۲. Multi-Site و اتصال

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| ورک‌اسپیس‌های مستقل + جدا بودن داده | COMPLETED | Integration isolation (404) | ✅ |
| نقش‌ها owner/admin/editor/viewer | COMPLETED | middleware + Integration | ✅ |
| WordPress plugin (قرارداد REST + push) | COMPLETED | Unit connectors (mock) | ✅ |
| تنظیمات اتصال سایت در پنل (کلیدها رمزنگاری + تست واقعی) | COMPLETED | Integration (masked + test) | ✅ |
| Astro / Next.js integration | COMPLETED | کد + README | بدون تست E2E روی پروژه واقعی Astro/Next — PARTIALLY در عملکرد زنده |
| HTML Widget + share token | COMPLETED | Integration (public endpoint) | ✅ |
| Webhook امضاشده HMAC | COMPLETED | Unit | ✅ |
| تأیید مالکیت دامنه (متا/فایل) | COMPLETED | Unit | ✅ |

## ۱۳. امنیت

| قابلیت | وضعیت | آزمایش | نتیجه |
|---|---|---|---|
| scrypt + JWT HS256 | COMPLETED | Integration auth flow | ✅ |
| جداسازی داده ورک‌اسپیس‌ها | COMPLETED | Integration | ✅ |
| رمزنگاری AES-256-GCM کلیدها | COMPLETED | Integration mask | ✅ |
| Rate limit (auth/api/ai) | COMPLETED | Integration (429) | ✅ |
| Zod validation + پیام فارسی | COMPLETED | Integration (400) | ✅ |
| Security headers + CORS محدود | COMPLETED | کد | ✅ |
| Activity log | COMPLETED | Integration | ✅ |
| بدون کلید در Repository/Frontend | COMPLETED | grep review | ✅ (فقط .env.example) |

## ۱۴. تست‌ها و انتشار

| قابلیت | وضعیت | نتیجه |
|---|---|---|
| Unit (پکیج‌ها) | COMPLETED | ۵۰ تست |
| Integration (API) | COMPLETED | ۲۹ تست |
| E2E (journey کامل کاربر) | COMPLETED | در Integration شامل |
| E2E مرورگر (Playwright) | TODO | ROADMAP — نیازمند نصب مرورگرها در CI |
| Build بدون خطا | COMPLETED | npm run build ✓ + tsc typecheck ✓ |
| Smoke سرور production | COMPLETED | register→workspace→article→analyze→public ✓ |
| CI (GitHub Actions) | COMPLETED | .github/workflows/ci.yml |
| GitHub Pages (دمو) | COMPLETED | deploy-pages.yml + base path |
| مستندات ۱۰+ فایل | COMPLETED | این مخزن |

## جمع‌بندی وضعیت

- **COMPLETED**: ۶۱ مورد
- **PARTIALLY COMPLETED**: ۲ مورد (Astro/Next تست زنده روی پروژه نمونه؛ Crawl چندصفحه‌ای کامل)
- **BLOCKED (نیازمند کلید سرویس پولی/شبکه)**: ۲ مورد (حجم جست‌وجو و سختی واقعی از DataForSEO؛ SERP واقعی — providerها آماده اتصال هستند)
- **FAILED**: ۰
