/** Articles list + creation (optionally from an approved brief). */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ArticleListItem } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, Modal, useToast } from '../components/ui.js';

interface BriefRow { id: string; keyword: string; status: string; data: { suggestedTitles: string[]; targetWordCount: number } }

export default function ArticlesPage() {
  const { workspaceId } = useApp();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const a = await api.get<{ articles: ArticleListItem[] }>(`/workspaces/${workspaceId}/articles`);
      setArticles(a.articles);
      const b = await api.get<{ briefs: BriefRow[] }>(`/workspaces/${workspaceId}/briefs`);
      setBriefs(b.briefs.filter((x) => x.status === 'approved'));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const deleteArticle = async (id: string, title: string) => {
    if (!workspaceId || !window.confirm(`مقاله «${title}» حذف شود؟`)) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/articles/${id}`);
      toast('success', 'مقاله حذف شد');
      void load();
    } catch (err) { toast('error', (err as Error).message); }
  };

  if (!workspaceId) {
    return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" hint="از نوار بالای صفحه یا از صفحه وب‌سایت‌ها." />;
  }
  if (error) return <div className="demo-banner">⚠️ {error}</div>;

  return (
    <div>
      <div className="row spread mb">
        <h2 style={{ margin: 0 }}>مقالات</h2>
        <button className="btn" onClick={() => setShowCreate(true)}>+ مقاله جدید</button>
      </div>
      {articles.length === 0 ? (
        <EmptyState
          icon="📝"
          title="هنوز مقاله‌ای ندارید"
          hint="از صفر شروع کنید یا از یک بریف تأییدشده مقاله بسازید."
          action={<button className="btn" onClick={() => setShowCreate(true)}>ساخت مقاله</button>}
        />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th>عنوان</th><th>کلمه کلیدی اصلی</th><th>نیت جست‌وجو</th><th>وضعیت</th><th>امتیاز سئو</th><th>به‌روزرسانی</th><th></th></tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'normal', minWidth: 180 }}>{a.title}</td>
                  <td>{a.primaryKeyword || '—'}</td>
                  <td className="muted">{intentLabel(a.intent)}</td>
                  <td><span className="badge gray">{statusLabel(a.status)}</span></td>
                  <td>
                    {a.lastScore
                      ? <span className={`badge ${scoreClass(a.lastScore.score)}`}>{a.lastScore.score}</span>
                      : <span className="badge gray">—</span>}
                  </td>
                  <td className="muted">{new Date(a.updatedAt).toLocaleDateString('fa-IR')}</td>
                  <td>
                    <Link className="btn secondary small" to={`/editor/${a.id}`}>ویرایشگر</Link>{' '}
                    <button className="btn danger small" onClick={() => deleteArticle(a.id, a.title)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="مقاله جدید" onClose={() => setShowCreate(false)}>
          <CreateForm briefs={briefs} onDone={async () => { setShowCreate(false); await load(); }} />
        </Modal>
      )}
    </div>
  );
}

function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    informational: 'اطلاعاتی', commercial: 'تجاری', transactional: 'تراکنشی', navigational: 'ناوبری',
  };
  return map[intent] ?? '—';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { draft: 'پیش‌نویس', in_review: 'در بازبینی', published: 'منتشرشده' };
  return map[status] ?? status;
}

function scoreClass(score: number): string {
  if (score >= 75) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

function CreateForm({ briefs, onDone }: { briefs: BriefRow[]; onDone: () => Promise<void> }) {
  const toast = useToast();
  const { workspaceId } = useApp();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [secondary, setSecondary] = useState('');
  const [intent, setIntent] = useState('informational');
  const [targetWords, setTargetWords] = useState(900);
  const [competitorUrls, setCompetitorUrls] = useState('');
  const [briefId, setBriefId] = useState('');
  const [busy, setBusy] = useState(false);

  const applyBrief = (id: string) => {
    setBriefId(id);
    const brief = briefs.find((b) => b.id === id);
    if (!brief) return;
    setKeyword(brief.keyword);
    setTargetWords(brief.data.targetWordCount);
    if (brief.data.suggestedTitles[0]) setTitle(brief.data.suggestedTitles[0]);
  };

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!workspaceId) return;
      setBusy(true);
      try {
        const res = await api.post<{ article: { id: string } }>(`/workspaces/${workspaceId}/articles`, {
          title,
          primaryKeyword: keyword,
          secondaryKeywords: secondary.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
          intent,
          targetWords,
          competitorUrls: competitorUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean),
          briefId: briefId || undefined,
        });
        toast('success', 'مقاله ساخته شد');
        await onDone();
        navigate(`/editor/${res.article.id}`);
      } catch (err) {
        toast('error', (err as Error).message);
      } finally { setBusy(false); }
    }}>
      {briefs.length > 0 && (
        <label className="field">ساخت از بریف تأییدشده (اختیاری)
          <select className="input" value={briefId} onChange={(e) => applyBrief(e.target.value)}>
            <option value="">— بدون بریف —</option>
            {briefs.map((b) => <option key={b.id} value={b.id}>{b.keyword}</option>)}
          </select>
        </label>
      )}
      <label className="field">عنوان مقاله<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
      <label className="field">کلمه کلیدی اصلی<input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} required /></label>
      <label className="field">کلمات کلیدی فرعی (با ویرگول جدا کنید)<input className="input" value={secondary} onChange={(e) => setSecondary(e.target.value)} /></label>
      <div className="grid cols-2">
        <label className="field">نیت جست‌وجو
          <select className="input" value={intent} onChange={(e) => setIntent(e.target.value)}>
            <option value="informational">اطلاعاتی</option>
            <option value="commercial">تجاری</option>
            <option value="transactional">تراکنشی</option>
            <option value="navigational">ناوبری</option>
          </select>
        </label>
        <label className="field">حجم هدف (کلمه)
          <input className="input" type="number" min={100} max={20000} value={targetWords} onChange={(e) => setTargetWords(Number(e.target.value))} />
        </label>
      </div>
      <label className="field">آدرس‌های رقبا (هر خط یک آدرس — برای تحلیل معنایی زنده)
        <textarea className="input" dir="ltr" rows={2} value={competitorUrls} onChange={(e) => setCompetitorUrls(e.target.value)} />
      </label>
      <button className="btn" disabled={busy || !title || !keyword}>{busy ? 'در حال ساخت…' : 'ساخت مقاله و بازکردن ویرایشگر'}</button>
    </form>
  );
}
