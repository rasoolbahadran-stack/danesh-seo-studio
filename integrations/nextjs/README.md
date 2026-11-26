# Next.js Integration — Danesh SEO Studio

اتصال سایت‌های Next.js (App Router) به Danesh SEO Studio.

## ۱) Route Handler قرارداد REST

فایل `app/danesh-seo/[...route]/route.ts` را بسازید:

```ts
import { createDaneshRouteHandler } from '@danesh/nextjs-integration';

const handler = createDaneshRouteHandler({
  secret: process.env.DANESH_SECRET,
  // contentDir: path.join(process.cwd(), 'src/content'),
});

export const GET = handler.GET;
```

- `GET /danesh-seo/ping`
- `GET /danesh-seo/pages?limit=50` — صفحات واقعی از `src/content/**/*.{md,mdx}`
- احراز هویت: `Authorization: Bearer <DANESH_SECRET>`

## ۲) ویجت امتیاز سئو زنده

```tsx
import DaneshScoreBadge from '@danesh/nextjs-integration/badge';

<DaneshScoreBadge
  apiBaseUrl="https://your-danesh-server.com"
  workspaceId="..."
  articleId="..."
  shareToken="..." // از پنل Danesh: تنظیمات وب‌سایت → توکن اشتراک‌گذاری
/>
```

توکن اشتراک‌گذاری فقط به امتیاز خلاصه دسترسی دارد و قابل چرخش است؛ هیچ کلید محرمانه‌ای در فرانت‌اند قرار نمی‌گیرد.
