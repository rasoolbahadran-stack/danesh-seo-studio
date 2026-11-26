/** Dashboard: workspace stats, articles overview, recent reports, live score chart. */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ArticleListItem } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, scoreColor } from '../components/ui.js';

interface Stats { articles: number; published: number; briefs: number; reports: number; avgScore: number | null }
interface ReportRow { id: string; type: string; articleId: string | null; createdAt: string; payload: Record<string, unknown> }

export default function DashboardPage() {
  const { workspaceId, workspaces } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setStats(null); setError(null);
    void (async () => {
      try {
        const s = await api.get<{ stats: Stats }>(`/workspaces/${workspaceId}`);
        setStats(s.stats);
        const a = await api.get<{ articles: ArticleListItem[] }>(`/workspaces/${workspaceId}/articles?limit=6`);
        setArticles(a.articles);
        const r = await api.get<{ reports: ReportRow[] }>(`/workspaces/${workspaceId}/reports`);
        setReports(r.reports.slice(0, 5));
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [workspaceId]);

  if (!workspaceId) {
    return (
      <EmptyState
        icon="🌐"
        title="ابتدا یک وب‌سایت (ورک‌اسپیس) اضافه کنید"
        hint="هر وب‌سایت یک ورک‌اسپیس مستقل با تنظیمات، مقالات و گزارش‌های جداست."
        action={<Link className="btn" to="/workspaces">افزودن وب‌سایت</Link>}
      />
    );
  }
  if (error) return <div className="demo-banner">⚠️ {error}</div>;
  if (!stats) return <div className="empty">در حال بارگذاری…</div>;

  const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? '';

  return (
    <div>
      <div className="row spread mb">
        <h2 style={{ margin: 0 }}>داشبورد {wsName}</h2>
        <Link className="btn" to="/articles">+ مقاله جدید</Link>
      </div>
      <div className="grid cols-4 mb">
        <div className="card stat-card"><div className="num">{stats.articles}</div><div className="label">مقالات</div></div>
        <div className="card stat-card"><div className="num">{stats.published}</div><div className="label">منتشرشده</div></div>
        <div className="card stat-card"><div className="num">{stats.briefs}</div><div className="label">بریف‌های محتوا</div></div>
        <div className="card stat-card"><div className="num" style={{ color: stats.avgScore === null ? 'var(--muted)' : `var(--${scoreColor(stats.avgScore)})` }}>
          {stats.avgScore ?? '—'}
        </div><div className="label">میانگین امتیاز سئو</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="row spread mb"><h3 style={{ margin: 0 }}>مقالات اخیر</h3><Link to="/articles">همه →</Link></div>
          {articles.length === 0 ? (
            <EmptyState icon="📝" title="هنوز مقاله‌ای ندارید" hint="اولین مقاله را بسازید یا از بریف محتوا شروع کنید." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>عنوان</th><th>کلمه کلیدی</th><th>امتیاز</th><th></th></tr></thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td className="muted">{a.primaryKeyword || '—'}</td>
                      <td>
                        {a.lastScore ? (
                          <span className={`badge ${scoreColor(a.lastScore.score)}`}>{a.lastScore.score}</span>
                        ) : <span className="badge gray">بدون تحلیل</span>}
                      </td>
                      <td><Link to={`/editor/${a.id}`}>ویرایش ←</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="row spread mb"><h3 style={{ margin: 0 }}>گزارش‌های اخیر</h3><Link to="/reports">همه →</Link></div>
          {reports.length === 0 ? (
            <EmptyState icon="🗂" title="گزارشی ثبت نشده" hint="با تحلیل مقاله یا سئو تکنیکال، گزارش‌ها اینجا ثبت می‌شوند." />
          ) : (
            reports.map((r) => (
              <div key={r.id} className="issue">
                <div className="row1">
                  <span className="badge primary">{typeLabel(r.type)}</span>
                  <span className="title">{reportTitle(r)}</span>
                </div>
                <div className="muted">{new Date(r.createdAt).toLocaleString('fa-IR')}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  const map: Record<string, string> = { audit: 'Audit نهایی', technical: 'سئو تکنیکال', competitor: 'رقبا' };
  return map[type] ?? type;
}

function reportTitle(r: ReportRow): string {
  const p = r.payload as { totalScore?: number; summary?: { competitors?: unknown[] }; report?: { score?: number } };
  if (r.type === 'audit') return `امتیاز نهایی: ${p.totalScore ?? p.report?.score ?? '—'}`;
  if (r.type === 'competitor') return `${p.summary?.competitors?.length ?? 0} رقیب تحلیل شد`;
  return 'گزارش تکنیکال';
}
