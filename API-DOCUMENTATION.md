# مستندات API — Danesh SEO Studio

Base URL: `http://localhost:4000/api/v1`
احراز هویت: `Authorization: Bearer <JWT>` (به‌جز auth و public)
فرمت خطا: `{ "error": { "code": "...", "message": "...", "details?": ... } }`

## Auth

| متد | مسیر | بدنه | پاسخ |
|---|---|---|---|
| POST | `/auth/register` | `{email, password(≥8), name}` | `{token, user}` — 201 |
| POST | `/auth/login` | `{email, password}` | `{token, user}` |
| GET | `/auth/me` | — | `{user}` |

## Workspaces (وب‌سایت‌ها)

| متد | مسیر | نقش | توضیح |
|---|---|---|---|
| POST | `/workspaces` | — | `{name, domain?, lang?, cms?}` → 201 |
| GET | `/workspaces` | — | لیست ورک‌اسپیس‌های کاربر |
| GET | `/workspaces/:id` | viewer | `{workspace, stats, ai, serp}` |
| PATCH | `/workspaces/:id` | admin | `{name?, domain?, weights?}` — weights: `{keyword: 20, ...}` |
| DELETE | `/workspaces/:id` | owner | آرشیو |
| GET/POST/DELETE | `/workspaces/:id/members` | viewer/admin | مدیریت اعضا `{email, role}` |
| GET | `/workspaces/:id/settings/ai` | viewer | وضعیت AI (کلید ماسک‌شده) |
| POST | `/workspaces/:id/settings/ai` | admin | `{baseUrl, model, apiKey}` — ذخیره رمزنگاری‌شده |
| POST | `/workspaces/:id/settings/ai/test` | admin | تست اتصال واقعی |
| POST | `/workspaces/:id/settings/serp` | admin | `{kind: dataforseo|serpapi, login?, password?, apiKey?}` |
| POST | `/workspaces/:id/settings/serp/test` | admin | تست SERP |
| POST | `/workspaces/:id/settings/share-token` | admin | تولید توکن عمومی ویجت |
| GET | `/workspaces/:id/activity` | viewer | لاگ فعالیت |

## Articles

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/workspaces/:id/articles` | `{title, primaryKeyword, secondaryKeywords?, intent?, targetWords?, contentHtml?, metaTitle?, metaDescription?, competitorUrls?, briefId?}` → 201 (نسخه ۱ خودکار) |
| GET | `/workspaces/:id/articles` | لیست (+`?status=&limit=&offset=`) |
| GET | `/workspaces/:id/articles/:articleId` | مقاله + نسخه‌ها |
| PATCH | `/workspaces/:id/articles/:articleId` | ذخیره خودکار/دستی؛ `forceSave:true` → نسخه جدید فوری |
| DELETE | `/workspaces/:id/articles/:articleId` | حذف |
| GET | `/workspaces/:id/articles/:articleId/versions` | نسخه‌ها |
| POST | `/workspaces/:id/articles/:articleId/versions` | `{note}` → نسخه دستی |
| POST | `/workspaces/:id/articles/:articleId/versions/:versionId/restore` | بازیابی |
| GET | `/workspaces/:id/articles/:articleId/versions/:versionId/diff` | `{diff: {added, removed, unchangedBlocks, wordDelta}}` |
| POST | `/workspaces/:id/articles/:articleId/analyze` | تحلیل کامل (موتور + رقبای تنظیم‌شده مقاله) → `{score, grade, report, eeat}` |
| POST | `/workspaces/:id/articles/:articleId/audit` | Audit نهایی → score + eeat + cannibalization + تکنیکال (در صورت published_url) + ذخیره گزارش |
| POST | `/workspaces/:id/articles/:articleId/ai/:task` | اجرای تسک AI — تسک‌ها: `suggest-titles, meta-description, intro, conclusion, faq, outline, section, expand, rewrite, fix-grammar, readability, internal-links, full-article` |

### خطاهای مهم
- `AI_NOT_CONFIGURED` (400): سرویس AI تنظیم نشده — راهنما در message.
- `AI_PROVIDER_ERROR` (502): خطای واقعی provider (کلید/اتصال/timeout).

## Keywords

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/workspaces/:id/keywords/research` | `{seed}` → longTails + questions + related(AI) + clusters + dataProvenance |
| GET | `/workspaces/:id/keywords/cannibalization` | جفت‌های متداخل |
| POST | `/workspaces/:id/keywords/mapping` | `{keywords[]}` → نقشه + تداخل‌ها |
| POST | `/workspaces/:id/keywords/serp` | `{keyword, country?, language?}` → نتایج واقعی یا `not_configured` |
| POST | `/workspaces/:id/keywords/serp/volume` | `{keywords[]}` → حجم واقعی یا `not_configured` |

## Competitors / Technical / Briefs / Reports

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/workspaces/:id/competitors` | `{urls[1..5], articleId?}` → خلاصه + مقایسه + gaps |
| POST | `/workspaces/:id/technical` | `{url}` → گزارش کامل تکنیکال |
| POST | `/workspaces/:id/technical/duplicates` | `{urls[2..10]}` → SimHash duplicates |
| POST | `/workspaces/:id/briefs` | `{keyword, competitorUrls?}` → بریف |
| GET/PATCH | `/workspaces/:id/briefs[/:briefId]` | لیست/ویرایش/تأیید `{status: approved}` |
| GET | `/workspaces/:id/reports[?type=audit|technical|competitor]` | آرشیو گزارش‌ها |

## Public (ویجت)

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/public/workspaces/:id/articles/:articleId/report?token=SHARE_TOKEN` | امتیاز خلاصه؛ بدون تحلیل → `NO_REPORT` |

## Health

`GET /api/v1/health` → `{status, db, version, features: {ai, serp}}` (flagهای env)

## Rate Limit

- auth: 10/15 دقیقه per IP | api: 300/دقیقه per IP | ai: 20/دقیقه | public: 120/دقیقه
- پاسخ 429 با هدرهای `X-RateLimit-*` و `Retry-After`
