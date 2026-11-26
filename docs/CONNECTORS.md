# قرارداد اتصال وب‌سایت‌ها (Connectors Contract)

هر وب‌سایتی می‌تواند با پیاده‌سازی این قرارداد به Danesh SEO Studio متصل شود — بدون تغییر در هسته.

## قرارداد REST (danesh-seo-v1)

Base URL سایت شما + مسیرهای زیر. احراز هویت: `Authorization: Bearer <SECRET>` (یا Basic برای وردپرس با Application Password).

| متد | مسیر | پاسخ |
|---|---|---|
| GET | `/danesh-seo/ping` | `{ok:true, contract:"danesh-seo-v1", site:"..."}` |
| GET | `/danesh-seo/pages?limit=50` | `[{id,title,url,contentHtml,status,updatedAt}]` |
| GET | `/danesh-seo/pages/:id` | همان ساختار برای یک صفحه |
| POST | `/danesh-seo/pages` | (اختیاری) `{title, html, slug?, status?, metaDescription?}` → `{ok,id,url}` — فقط CMSهای پویا |

پیاده‌سازی‌های آماده: WordPress plugin، Astro integration، Next.js route handler (پوشه `integrations/`).

## Webhook

Danesh می‌تواند رویدادها را به URL شما بفرستد:

- هدر: `X-Danesh-Signature: sha256=<HMAC_SHA256(body, SECRET)>`
- بدنه: `{event, workspaceId, payload, sentAt}`

اعتبارسنجی نمونه (Node):

```js
const sig = createHmac('sha256', SECRET).update(rawBody).digest('hex');
if (`sha256=${sig}` !== req.headers['x-danesh-signature']) return res.status(401).end();
```

## تأیید مالکیت دامنه

یکی از دو روش:

1. متا تگ در صفحه اصلی: `<meta name="danesh-seo-studio" content="TOKEN">`
2. فایل: `https://site/danesh-verification.json` → `{"token":"TOKEN"}`

## ویجت HTML

```html
<script src="https://danesh-server/widget/danesh-widget.js"
  data-api="https://danesh-server"
  data-workspace-id="..." data-article-id="..." data-token="SHARE_TOKEN"></script>
```

endpoint عمومی فقط با share token کار می‌کند و امتیاز خلاصه می‌دهد.

## افزودن Connector جدید

اینترفیس `Connector` در `packages/website-connectors`:

```ts
interface Connector {
  kind: string;
  verify(): Promise<{ok, message}>;
  listPages(opts?): Promise<RemotePage[]>;
  getPage(id): Promise<RemotePage | null>;
  pushPage?(input): Promise<{ok, id?, url?, message}>;
}
```

Connector جدید = یک فایل جدید؛ هیچ تغییری در هسته لازم نیست.
