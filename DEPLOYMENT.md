# استقرار (Deployment)

## گزینه ۱ — تک‌سروری (توصیه‌شده برای استفاده واقعی)

API + داشبورد بیلد‌شده در یک پروسه Node:

```bash
npm ci
npm run build
NODE_ENV=production PORT=4000 node apps/api/dist/index.js
```

پشت Nginx با HTTPS:

```nginx
server {
  server_name danesh.example.ir;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

- `CORS_ORIGIN=https://danesh.example.ir`
- systemd unit یا `pm2` برای ری‌استارت خودکار:
  `pm2 start apps/api/dist/index.js --name danesh-seo`

## گزینه ۲ — Docker

```bash
docker compose up -d --build
# API روی :4000 — داده در volume `danesh-data`
```

`docker-compose.yml` و `Dockerfile` در ریشه مخزن موجودند. تنظیمات از `.env` خوانده می‌شود.

## گزینه ۳ — Frontend روی GitHub Pages + Backend مستقل

این همان معماری منتشرشده در این مخزن است:

1. **Pages (دمو)**: workflow `deploy-pages.yml` داشبورد را با base path `/danesh-seo-studio/` بیلد و منتشر می‌کند. نسخه Pages فقط Frontend است و صراحتاً **دمو** معرفی می‌شود.
2. **اتصال به Backend واقعی**: کاربر در صفحه ورود (فیلد «آدرس سرور API») یا در `localStorage` (`danesh_api_base`) آدرس سرور خودش را وارد می‌کند. Backend باید `CORS_ORIGIN=https://rasoolbahadran-stack.github.io` داشته باشد.
3. Backend هرگز روی Pages اجرا نمی‌شود (Node/SQLite نمی‌خواهد آنجا باشد) — این محدودیت GitHub Pages است نه محصول.

## چک‌لیست انتشار Pages

- [x] base path صحیح (`VITE_BASE_PATH=/danesh-seo-studio/`)
- [x] `404.html` برای روتینگ SPA (کپی index.html در workflow)
- [x] فونت از CDN بارگذاری می‌شود
- [x] بدون داده نمایشی — صراحتاً دمو
- [x] بررسی ۴۰۴ و بارگذاری مستقیم مسیرها (404.html)

## بروزرسانی نسخه

```bash
git pull
npm ci && npm run build
pm2 restart danesh-seo
```

## مقیاس‌پذیری

- SQLite برای یک تا چند تیم کاملاً کافی است (WAL فعال است). برای مقیاس بالاتر، لایه Repos جدا شده و در ROADMAP درایور Postgres پیش‌بینی شده است.
- Rate limit در حافظه است؛ برای چند instance پشت LB، در ROADMAP ذخیره مشترک پیش‌بینی شده.
