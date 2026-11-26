/** Competitor analysis: fetch real competitor pages and compare coverage. */
import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, useToast } from '../components/ui.js';

interface CompetitorSummary {
  url: string; title: string; wordCount: number; h2Count: number; images: number;
  topTerms: { term: string; count: number }[];
}
interface Result {
  summary: { competitors: CompetitorSummary[]; failed: { url: string; error: string }[]; medianWordCount: number | null };
  comparison: { score: number; semantic: { coveragePct: number | null; suggestedTerms: { term: string; docs: number }[]; competitorTopTerms: { term: string; count: number }[] }; completeness: { coveragePct: number; targetWordCount: number; wordCount: number } } | null;
  missingTopics: string[];
  reportId: string;
}

export default function CompetitorsPage() {
  const { workspaceId, workspaces } = useApp();
  const toast = useToast();
  const [urls, setUrls] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    if (!workspaceId) return;
    const list = urls.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return toast('info', 'حداقل یک آدرس رقیب وارد کنید');
    setBusy(true);
    try {
      setResult(await api.post<Result>(`/workspaces/${workspaceId}/competitors`, { urls: list }));
      toast('success', 'تحلیل رقبا کامل شد');
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  if (!workspaceId) return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" />;

  const activeArticle = result?.comparison ? 'مقاله فعال ورک‌اسپیس انتخاب‌شده مقایسه شد' : null;

  return (
    <div>
      <h2 className="mb">تحلیل رقبا</h2>
      <div className="card mb">
        <label className="field">آدرس صفحات رقیب (هر خط یک آدرس — تا ۵ آدرس)
          <textarea className="input" dir="ltr" rows={3} placeholder={'https://competitor1.ir/turkish-coffee\nhttps://competitor2.com/coffee'} value={urls} onChange={(e) => setUrls(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn" disabled={busy} onClick={run}>{busy ? 'در حال دریافت صفحات…' : 'تحلیل رقبا'}</button>
          <span className="muted">
            صفحات واقعاً دریافت و استخراج می‌شوند (عنوان، هدینگ‌ها، حجم، واژه‌های کلیدی). مقایسه با مقاله فعال ورک‌اسپیس «{workspaces.find((w) => w.id === workspaceId)?.name}» انجام می‌شود.
          </span>
        </div>
      </div>

      {result && (
        <>
          {result.summary.failed.length > 0 && (
            <div className="demo-banner mb">
              ⚠️ برخی آدرس‌ها دریافت نشدند: {result.summary.failed.map((f) => `${f.url} (${f.error})`).join('، ')}
            </div>
          )}
          <div className="grid cols-3 mb">
            {result.summary.competitors.map((c) => (
              <div key={c.url} className="card">
                <h3 style={{ marginTop: 0, fontSize: 15 }}>{c.title || c.url}</h3>
                <div className="muted" dir="ltr" style={{ fontSize: 12 }}>{c.url}</div>
                <div className="row mt">
                  <span className="badge primary">{c.wordCount} کلمه</span>
                  <span className="badge gray">{c.h2Count} H2</span>
                  <span className="badge gray">{c.images} تصویر</span>
                </div>
                <div className="mt">
                  <strong className="muted" style={{ fontSize: 12 }}>واژه‌های کلیدی:</strong>
                  <div className="mt">{c.topTerms.slice(0, 8).map((t) => <span key={t.term} className="kw-chip">{t.term} ({t.count})</span>)}</div>
                </div>
              </div>
            ))}
          </div>

          {result.comparison && (
            <div className="grid cols-2">
              <div className="card">
                <h3 style={{ marginTop: 0 }}>مقایسه با مقاله شما</h3>
                <div>حجم مقاله شما: <strong>{result.comparison.completeness.wordCount}</strong> کلمه در مقابل میانه رقبا: <strong>{result.summary.medianWordCount ?? '—'}</strong></div>
                <div className="progress-line mt"><div style={{ width: `${Math.min(100, result.comparison.completeness.coveragePct)}%`, background: 'var(--primary)' }} /></div>
                <div className="muted mt">پوشش حجم: {result.comparison.completeness.coveragePct}٪ از هدف {result.comparison.completeness.targetWordCount}</div>
                <div className="mt">پوشش معنایی با رقبا: <strong>{result.comparison.semantic.coveragePct ?? '—'}٪</strong></div>
              </div>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>فرصت‌های محتوایی</h3>
                <p className="muted">موضوعات/واژه‌هایی که رقبا پوشش داده‌اند و مقاله شما ندارد:</p>
                {result.missingTopics.map((t) => <span key={t} className="kw-chip unused">{t}</span>)}
                {result.comparison.semantic.suggestedTerms.slice(0, 15).map((t) => (
                  <span key={t.term} className="kw-chip unused" title={`در ${t.docs} رقیب`}>{t.term}</span>
                ))}
              </div>
            </div>
          )}
          {activeArticle && <div className="muted mt">{activeArticle} — برای مقایسه دقیق‌تر، آدرس‌های رقیب را در تنظیمات مقاله ثبت کنید تا در تحلیل زنده هم استفاده شوند.</div>}
        </>
      )}
    </div>
  );
}
