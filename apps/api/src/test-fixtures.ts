/** Fixture pages served by a local HTTP server for integration/E2E tests. */
import { createServer } from 'node:http';

const COMP1 = `<!doctype html><html lang="fa"><head><title>قهوه ترک چیست؟ راهنمای خرید</title>
<meta name="description" content="راهنمای کامل قهوه ترک و انتخاب جزوه مناسب"><meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>
<h1>قهوه ترک چیست؟</h1>
<p>قهوه ترک روشی قدیمی برای دم کردن قهوه است که با پودر بسیار نرم و آب سرد در جزوه انجام می‌شود. کف قهوه نشانه کیفیت است. برشته‌کاری متوسط بهترین نتیجه را می‌دهد. انتخاب آب و پودر مهم‌ترین مرحله است؛ آب باید تازه و بدون بو باشد. شعله باید ملایم باشد تا قهوه آرام بالا بیاید و سر ریز نشود. زمان دم کردن حدود سه دقیقه است و در این مدت نباید قهوه را هم بزنیم. پس از دم کردن دو دقیقه صبر کنید تا دانه‌ها ته‌نشین شوند. تجربه نشان می‌دهد نسبت یک قاشق چای‌خوری برای هر فنجان مناسب است و شکر باید ابتدا اضافه شود نه در پایان کار. کیفیت آب سخت بر طعم نهایی اثر می‌گذارد و بهتر است آب فیلترشده استفاده شود. جزوه مسی حرارت را یکنواخت‌تر پخش می‌کند و کف بهتری می‌سازد.</p>
<h2>انتخاب آب و پودر</h2>
<p>آب فیلترشده و پودر عربیکای نرم بهترین کف را می‌دهد. درجه برشته‌کاری روی طعم اثر دارد.</p>
<h2>کنترل شعله و کف</h2>
<p>شعله ملایم و صبر، کلید کف کامل است. اگر قهوه در حال سر ریز شدن بود، آن را برای لحظه‌ای از روی حرارت بردارید.</p>
<h2>سوالات متداول</h2>
<p>آیا می‌توان از قهوه معمولی استفاده کرد؟ خیر؛ پودر باید بسیار نرم باشد.</p>
</body></html>`;

const COMP2 = `<!doctype html><html lang="fa"><head><title>بهترین قهوه ترک ایرانی</title></head><body>
<h1>بهترین قهوه ترک</h1>
<p>برای قهوه ترک خوب، پودر نرم و آب سرد لازم است. کف را با قاشق برمی‌داریم و در فنجان می‌ریزیم. برشته‌کاری متوسط بهترین طعم را می‌دهد. انتخاب آب و پودر را جدی بگیرید؛ آب سخت طعم را خراب می‌کند. شعله ملایم باشد و قهوه را هم نزنید. پس از بالا آمدن کف، حرارت را خاموش کنید. برای خرید قهوه ترک به تازگی برشته‌کاری توجه کنید. قهوه تازه عطر بیشتری دارد. فنجان کوچک ۶۰ میلی‌لیتری مناسب است. قند را در صورت تمایل ابتدا اضافه کنید و سپس قهوه را دم کنید. اجازه دهید تفاله ته‌نشین شود تا نوشیدنی شفاف باشد.</p>
<h2>انتخاب آب و پودر</h2>
<p>آب فیلترشده و پودر تازه آسیاب‌شده بهترین نتیجه را می‌دهد.</p>
<h2>خرید و نگهداری</h2>
<p>قهوه را در ظرف دربسته و دور از نور نگه دارید.</p>
</body></html>`;

const TECH_PAGE = `<!doctype html><html lang="fa"><head>
<title>آموزش کامل سئو تکنیکال برای فارسی‌زبان‌ها</title>
<meta name="description" content="راهنمای جامع سئو تکنیکال: از robots.txt تا schema و Core Web Vitals">
<meta name="robots" content="index, follow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="آموزش سئو تکنیکال">
<meta property="og:image" content="https://cdn.example.ir/og.jpg">
<link rel="canonical" href="https://localhost.local/tech">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"آموزش سئو تکنیکال"}</script>
</head><body>
<h1>سئو تکنیکال</h1>
<h2>Robots و Sitemap</h2><p>robots.txt و sitemap.xml پایه خزش هستند.</p>
<h2>Schema</h2><p>داده ساختاریافته به فهم بهتر کمک می‌کند.</p>
<img src="https://cdn.example.ir/a.jpg" alt="نمودار سئو" width="800" height="400">
<img src="https://cdn.example.ir/b.jpg">
</body></html>`;

const NOINDEX_PAGE = `<!doctype html><html lang="fa"><head>
<title>صفحه پیش‌نویس</title><meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head><body><h1>پیش‌نویس</h1><p>این صفحه نباید ایندکس شود.</p></body></html>`;

export function createFixtureServer(): Promise<{ port: number; close: () => Promise<void>; url: (path: string) => string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url ?? '/';
      const map: Record<string, [string, string]> = {
        '/comp1': [COMP1, 'text/html; charset=utf-8'],
        '/comp2': [COMP2, 'text/html; charset=utf-8'],
        '/tech': [TECH_PAGE, 'text/html; charset=utf-8'],
        '/wp-json/wp/v2/users/me': ['{"id":1,"name":"wp-admin","capabilities":{"edit_posts":true}}', 'application/json'],
        '/noindex': [NOINDEX_PAGE, 'text/html; charset=utf-8'],
      };
      const entry = map[path];
      if (entry) {
        res.writeHead(200, { 'Content-Type': entry[1] });
        res.end(entry[0]);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>404</h1></body></html>');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise((r) => server.close(() => r())),
        url: (path: string) => `http://127.0.0.1:${addr.port}${path}`,
      });
    });
  });
}
