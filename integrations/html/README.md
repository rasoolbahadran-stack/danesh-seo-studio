# HTML Widget — Danesh SEO Studio

ویجت جاوااسکریپتی مستقل برای نمایش زنده امتیاز سئو روی **هر** وب‌سایتی (HTML استاتیک، Astro، Next.js، …) بدون وابستگی به فریم‌ورک.

## استفاده

```html
<script
  src="https://YOUR-DANESH-SERVER/widget/danesh-widget.js"
  data-api="https://YOUR-DANESH-SERVER"
  data-workspace-id="WORKSPACE_ID"
  data-article-id="ARTICLE_ID"
  data-token="SHARE_TOKEN">
</script>
```

فایل `danesh-widget.js` پس از بیلد از `integrations/html/danesh-widget.js` سرو می‌شود (یا روی هر CDN/مسیر static قرار دهید).

## امنیت

- توکن اشتراک‌گذاری (share token) از پنل Danesh تولید می‌شود (تنظیمات وب‌سایت → share-token) و فقط به «امتیاز خلاصه» دسترسی دارد.
- توکن قابل چرخش است و هیچ کلید AI/SERP در فرانت‌اند قرار نمی‌گیرد.
- endpoint عمومی rate-limit و بدون نمایش داده حساس است.

## رفتار بدون داده

اگر مقاله هنوز تحلیل نشده باشد، ویجت پیام شفاف «گزارش در دسترس نیست» نشان می‌دهد — داده ساختگی تولید نمی‌شود.
