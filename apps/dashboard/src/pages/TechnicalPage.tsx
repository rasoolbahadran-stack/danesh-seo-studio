/** Technical SEO audit for a live URL + duplicate page detection. */
import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, PriorityBadge, useToast } from '../components/ui.js';

interface TechnicalReport {
  url: string; finalUrl: string; https: boolean; status: number | null; redirectChain: { status: number; location: string }[];
  ttfbMs: number | null; pageSizeKb: number | null; title: string | null; metaDescription: string | null;
  canonical: string | null; robotsMeta: string | null; viewport: string | null; langAttr: string | null;
  h1Count: number; headingsOutline: { level: number; text: string }[]; openGraph: Record<string, string>;
  schemaTypes: string[]; hreflang: string[]; indexable: boolean;
  images: { count: number; missingAlt: number; withoutDimensions: number; largeSample: string[] };
  links: { internal: number; external: number; broken: string[] };
  robotsTxt: { found: boolean; sitemapDeclared: string | null; disallowAll: boolean };
  sitemap: { found: boolean | null; urlCount: number | null; sample: string[] };
  coreWebVitals: { status: string; message: string; metrics?: Record<string, number | null> };
  issues: { code: string; priority: string; title: string; detail: string; howToFix: string }[];
}

export default function TechnicalPage() {
  const { workspaceId } = useApp();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<TechnicalReport | null>(null);
  const [dupUrls, setDupUrls] = useState('');
  const [dups, setDups] = useState<{ duplicates: { a: string; b: string; simhashHamming: number; jaccardShingles: number; verdict: string }[]; errors: { url: string; error: string }[] } | null>(null);

  const run = async () => {
    if (!workspaceId || !url.trim()) return;
    setBusy(true);
    setReport(null);
    try {
      const res = await api.post<{ report: TechnicalReport }>(`/workspaces/${workspaceId}/technical`, { url: url.trim() });
      setReport(res.report);
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  const runDups = async () => {
    if (!workspaceId) return;
    const list = dupUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (list.length < 2) return toast('info', 'حداقل دو آدرس وارد کنید');
    setBusy(true);
    try {
      setDups(await api.post(`/workspaces/${workspaceId}/technical/duplicates`, { urls: list }));
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  if (!workspaceId) return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" />;

  const passed = report?.issues.filter((i) => i.priority === 'passed') ?? [];
  const problems = report?.issues.filter((i) => i.priority !== 'passed') ?? [];

  return (
    <div>
      <h2 className="mb">سئو تکنیکال</h2>
      <div className="card mb">
        <div className="row">
          <input className="input" dir="ltr" style={{ flex: 1, minWidth: 220 }} placeholder="https://example.ir/page" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(); }} />
          <button className="btn" disabled={busy || !url.trim()} onClick={run}>{busy ? 'در حال بررسی…' : 'بررسی صفحه'}</button>
        </div>
        <p className="muted mt" style={{ fontSize: 12.5 }}>
          بررسی واقعی: HTTP/ریدایرکت، title، متا، canonical، هدینگ‌ها، robots.txt، sitemap، Open Graph، Schema، noindex، تصاویر، لینک‌های شکسته، Core Web Vitals (در صورت دسترس بودن API PageSpeed).
        </p>
      </div>

      {report && (
        <>
          <div className="grid cols-4 mb">
            <div className="card stat-card"><div className="num" style={{ color: report.status === 200 ? 'var(--green)' : 'var(--red)' }}>{report.status ?? '—'}</div><div className="label">HTTP Status</div></div>
            <div className="card stat-card"><div className="num" style={{ fontSize: 18 }}>{report.ttfbMs ?? '—'} ms</div><div className="label">زمان پاسخ</div></div>
            <div className="card stat-card"><div className="num" style={{ fontSize: 18 }}>{report.pageSizeKb ?? '—'} KB</div><div className="label">حجم صفحه</div></div>
            <div className="card stat-card"><div className="num" style={{ color: report.indexable ? 'var(--green)' : 'var(--red)' }}>{report.indexable ? '✓' : '✖'}</div><div className="label">قابل ایندکس</div></div>
          </div>

          <div className="grid cols-2 mb">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>خلاصه فنی</h3>
              <table className="data"><tbody>
                <tr><td>آدرس نهایی</td><td dir="ltr" style={{ whiteSpace: 'normal' }}>{report.finalUrl}</td></tr>
                <tr><td>HTTPS</td><td>{report.https ? '✓' : '✖'}</td></tr>
                <tr><td>Title</td><td style={{ whiteSpace: 'normal' }}>{report.title ?? '—'} {report.title && `(${report.title.length} کاراکتر)`}</td></tr>
                <tr><td>Meta Description</td><td style={{ whiteSpace: 'normal' }}>{report.metaDescription ?? '—'}</td></tr>
                <tr><td>Canonical</td><td dir="ltr" style={{ whiteSpace: 'normal' }}>{report.canonical ?? '—'}</td></tr>
                <tr><td>Robots Meta</td><td>{report.robotsMeta ?? '—'}</td></tr>
                <tr><td>Viewport</td><td className="muted">{report.viewport ?? '—'}</td></tr>
                <tr><td>H1</td><td>{report.h1Count}</td></tr>
                <tr><td>Schema</td><td>{report.schemaTypes.join('، ') || '—'}</td></tr>
                <tr><td>Open Graph</td><td>{Object.keys(report.openGraph).join('، ') || '—'}</td></tr>
                <tr><td>robots.txt</td><td>{report.robotsTxt.found ? '✓' : '✖'} {report.robotsTxt.sitemapDeclared ? `(sitemap: معرفی‌شده)` : ''}</td></tr>
                <tr><td>sitemap.xml</td><td>{report.sitemap.found ? `✓ (${report.sitemap.urlCount} آدرس)` : '✖'}</td></tr>
                <tr><td>لینک‌ها</td><td>داخلی {report.links.internal} | خارجی {report.links.external} | شکسته {report.links.broken.length}</td></tr>
                <tr><td>تصاویر</td><td>{report.images.count} تصویر، بدون Alt: {report.images.missingAlt}</td></tr>
                <tr><td>Core Web Vitals</td><td style={{ whiteSpace: 'normal' }}>{report.coreWebVitals.message}</td></tr>
              </tbody></table>
            </div>
            <div>
              <div className="card mb">
                <h3 style={{ marginTop: 0 }}>ایرادات ({problems.length})</h3>
                {problems.map((i) => (
                  <div key={i.code} className="issue">
                    <div className="row1"><PriorityBadge priority={i.priority} /><span className="title">{i.title}</span></div>
                    <div className="desc">{i.detail}</div>
                    {i.howToFix && <div className="fix">💡 {i.howToFix}</div>}
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>موارد تأییدشده ({passed.length})</h3>
                {passed.map((i) => <div key={i.code} className="badge green" style={{ margin: 3 }}>✓ {i.title}</div>)}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>بررسی صفحات تکراری (Duplicate Content)</h3>
        <label className="field">آدرس‌ها (هر خط یک آدرس — تا ۱۰)
          <textarea className="input" dir="ltr" rows={3} value={dupUrls} onChange={(e) => setDupUrls(e.target.value)} />
        </label>
        <button className="btn secondary" disabled={busy} onClick={runDups}>مقایسه با SimHash</button>
        {dups && (
          <div className="mt">
            {dups.errors.length > 0 && <div className="demo-banner">⚠️ {dups.errors.map((e) => `${e.url}: ${e.error}`).join('، ')}</div>}
            {dups.duplicates.length === 0 ? (
              <div className="badge green">هیچ جفت صفحه‌ای تکراری تشخیص داده نشد</div>
            ) : dups.duplicates.map((d, i) => (
              <div key={i} className="issue">
                <div className="row1"><span className={`badge ${d.verdict === 'near-duplicate' ? 'red' : 'orange'}`}>{d.verdict === 'near-duplicate' ? 'تکراری' : 'مشابه'}</span></div>
                <div dir="ltr" className="desc" style={{ textAlign: 'left' }}>{d.a}<br />{d.b}</div>
                <div className="muted">Hamming: {d.simhashHamming} | Jaccard: {d.jaccardShingles}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
