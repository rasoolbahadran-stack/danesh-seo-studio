# Astro Integration — Danesh SEO Studio

اتصال سایت‌های Astro به Danesh SEO Studio.

## نصب

```bash
npm i @danesh/astro-integration
```

## استفاده

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import daneshSeo from '@danesh/astro-integration';

export default defineConfig({
  integrations: [daneshSeo({ secret: process.env.DANESH_SECRET })],
});
```

اتصال در پنل Danesh:
- نوع اتصال: **REST Contract**
- Base URL: `https://your-astro-site.com`
- احراز هویت: `Authorization: Bearer <DANESH_SECRET>`

## رفتار

- `GET /danesh-seo/ping` — تست اتصال
- `GET /danesh-seo/pages?limit=50` — صفحات واقعی از `src/content/**/*.{md,mdx}` استخراج می‌شوند (عنوان از frontmatter یا H1)
- `GET /danesh-seo/pages/:id` — محتوای یک صفحه (تبدیل سبک md→html برای تحلیل)
- چون سایت Astro معمولاً استاتیک است، `push` پشتیبانی نمی‌شود (پاسخ ۵۰۱ شفاف)؛ انتشار محتوا با pipeline استقرار خودتان انجام می‌شود.
