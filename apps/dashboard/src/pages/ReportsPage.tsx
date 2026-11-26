/** Reports archive: audits, technical, competitor reports. */
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, PriorityBadge, useToast } from '../components/ui.js';

interface ReportRow { id: string; type: string; articleId: string | null; createdAt: string; payload: Record<string, unknown> }

export default function ReportsPage() {
  const { workspaceId } = useApp();
  const toast = useToast();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [type, setType] = useState('');
  const [open, setOpen] = useState<ReportRow | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await api.get<{ reports: ReportRow[] }>(`/workspaces/${workspaceId}/reports${type ? `?type=${type}` : ''}`);
      setReports(res.reports);
    } catch (err) { toast('error', (err as Error).message); }
  }, [workspaceId, type, toast]);

  useEffect(() => { void load(); }, [load]);

  if (!workspaceId) return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" />;

  return (
    <div>
      <h2 className="mb">گزارش‌های سئو</h2>
      <div className="row mb">
        {[['', 'همه'], ['audit', 'Audit نهایی'], ['technical', 'تکنیکال'], ['competitor', 'رقبا']].map(([k, label]) => (
          <button key={k} className={`btn ${type === k ? '' : 'secondary'}`} onClick={() => setType(k)}>{label}</button>
        ))}
        <button className="btn secondary small" onClick={load}>بازخوانی</button>
      </div>

      {reports.length === 0 ? (
        <EmptyState icon="🗂" title="گزارشی موجود نیست" hint="با تحلیل مقاله (Audit) یا بررسی تکنیکال، گزارش‌ها ثبت می‌شوند." />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>نوع</th><th>تاریخ</th><th>خلاصه</th><th></th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td><span className="badge primary">{{ audit: 'Audit نهایی', technical: 'تکنیکال', competitor: 'رقبا' }[r.type] ?? r.type}</span></td>
                  <td className="muted">{new Date(r.createdAt).toLocaleString('fa-IR')}</td>
                  <td>{summary(r)}</td>
                  <td><button className="btn secondary small" onClick={() => setOpen(r)}>مشاهده</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="modal" style={{ width: 'min(820px, 100%)' }}>
            <div className="row spread mb">
              <h3>گزارش {open.type} — {new Date(open.createdAt).toLocaleString('fa-IR')}</h3>
              <button className="btn secondary small" onClick={() => setOpen(null)}>بستن ✕</button>
            </div>
            {renderPayload(open)}
          </div>
        </div>
      )}
    </div>
  );
}

function summary(r: ReportRow): string {
  const p = r.payload as Record<string, unknown> & { totalScore?: number; summary?: { competitors?: unknown[] }; issues?: unknown[] };
  if (r.type === 'audit') return `امتیاز نهایی: ${p.totalScore ?? '—'} | بحرانی: ${(p as { criticalCount?: number }).criticalCount ?? 0}`;
  if (r.type === 'competitor') return `${(p.summary as { competitors?: unknown[] })?.competitors?.length ?? 0} رقیب`;
  if (r.type === 'technical') return `${Array.isArray(p.issues) ? p.issues.length : 0} بررسی`;
  return '—';
}

function renderPayload(r: ReportRow) {
  const p = r.payload as Record<string, never> as {
    report?: { issues?: { id: string; priority: string; title: string; description: string; howToFix: string }[]; criteria?: { label: string; score: number; status: string }[] };
    technical?: { issues?: { code: string; priority: string; title: string; detail: string }[] };
    cannibalization?: { summary?: string; pairs?: { reason: string }[] };
    summary?: { competitors?: { url: string; wordCount: number }[]; medianWordCount?: number | null };
    totalScore?: number; grade?: string; passed?: number; criticalCount?: number; highCount?: number;
  };
  return (
    <div>
      {p.totalScore !== undefined && (
        <div className="card mb">
          <strong>امتیاز نهایی: {p.totalScore} ({p.grade})</strong>
          <div className="muted">تأییدشده: {p.passed} | بحرانی: {p.criticalCount} | مهم: {p.highCount}</div>
          {p.cannibalization?.summary && <div className="muted mt">{p.cannibalization.summary}</div>}
          {p.cannibalization?.pairs?.map((x, i) => <div key={i} className="issue"><div className="desc">{x.reason}</div></div>)}
        </div>
      )}
      {p.report?.criteria && (
        <div className="card mb">
          <strong>معیارها:</strong>
          <div className="mt">{p.report.criteria.map((c) => (
            <div key={c.label} className="criterion"><span className={`dot ${c.status === 'green' ? 'green' : c.status === 'orange' ? 'orange' : 'red'}`} /><span className="name">{c.label}</span><strong>{c.score}</strong></div>
          ))}</div>
        </div>
      )}
      {p.report?.issues && (
        <div className="card mb">
          <strong>ایرادات ({p.report.issues.length}):</strong>
          <div className="mt">{p.report.issues.map((i) => (
            <div key={i.id} className="issue">
              <div className="row1"><PriorityBadge priority={i.priority} /><span className="title">{i.title}</span></div>
              <div className="desc">{i.description}</div>
              <div className="fix">💡 {i.howToFix}</div>
            </div>
          ))}</div>
        </div>
      )}
      {p.technical?.issues && (
        <div className="card mb">
          <strong>بررسی تکنیکال:</strong>
          <div className="mt">{p.technical.issues.map((i) => (
            <div key={i.code} className="issue">
              <div className="row1"><PriorityBadge priority={i.priority} /><span className="title">{i.title}</span></div>
              <div className="desc">{i.detail}</div>
            </div>
          ))}</div>
        </div>
      )}
      {p.summary?.competitors && (
        <div className="card mb">
          <strong>رقبا:</strong>
          {p.summary.competitors.map((c) => <div key={c.url} className="muted" dir="ltr" style={{ textAlign: 'left' }}>{c.url} — {c.wordCount} کلمه</div>)}
        </div>
      )}
      <details>
        <summary className="muted">JSON کامل گزارش</summary>
        <pre className="json">{JSON.stringify(r.payload, null, 2)}</pre>
      </details>
    </div>
  );
}
