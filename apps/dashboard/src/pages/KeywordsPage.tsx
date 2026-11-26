/** Keyword research: seed → long-tails, questions, clusters, related + mapping & cannibalization. */
import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, useToast } from '../components/ui.js';

interface KeywordIdea { keyword: string; source: string; intent: string; estimatedDifficulty: { score: number; level: string; estimated: boolean }; words: number }
interface Cluster { id: string; label: string; keywords: string[]; intents: string[] }
interface Research {
  seed: string; longTails: KeywordIdea[]; questions: KeywordIdea[]; related: { keyword: string; intent: string }[];
  clusters: Cluster[];
  dataProvenance: { volume: string; difficulty: string; note: string };
}
interface MappingEntry { keyword: string; pageId: string | null; pageTitle: string | null; conflict: boolean; note: string }

export default function KeywordsPage() {
  const { workspaceId } = useApp();
  const toast = useToast();
  const [seed, setSeed] = useState('');
  const [research, setResearch] = useState<Research | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'research' | 'mapping' | 'cannibalization'>('research');
  const [mappingKeywords, setMappingKeywords] = useState('');
  const [mapping, setMapping] = useState<{ entries: MappingEntry[]; conflicts: string[] } | null>(null);
  const [cann, setCann] = useState<{ pairs: { articles: { id: string; title: string; primaryKeyword: string }[]; severity: string; reason: string; recommendations: string[] }[]; summary: string } | null>(null);

  const runResearch = async () => {
    if (!workspaceId || seed.trim().length < 2) return;
    setBusy(true);
    try {
      setResearch(await api.post<Research>(`/workspaces/${workspaceId}/keywords/research`, { seed: seed.trim() }));
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  const runMapping = async () => {
    if (!workspaceId) return;
    try {
      const keywords = mappingKeywords.split(/[\n,،]+/).map((s) => s.trim()).filter(Boolean);
      setMapping(await api.post<{ entries: MappingEntry[]; conflicts: string[] }>(`/workspaces/${workspaceId}/keywords/mapping`, { keywords }));
    } catch (err) { toast('error', (err as Error).message); }
  };

  const runCannibalization = async () => {
    if (!workspaceId) return;
    try {
      setCann(await api.get(`/workspaces/${workspaceId}/keywords/cannibalization`));
    } catch (err) { toast('error', (err as Error).message); }
  };

  const intentBadge = (intent: string) => {
    const map: Record<string, [string, string]> = {
      informational: ['اطلاعاتی', 'primary'], commercial: ['تجاری', 'orange'],
      transactional: ['تراکنشی', 'green'], navigational: ['ناوبری', 'gray'], unknown: ['—', 'gray'],
    };
    const [label, cls] = map[intent] ?? [intent, 'gray'];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  if (!workspaceId) return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" />;

  return (
    <div>
      <h2 className="mb">تحقیق کلمات کلیدی</h2>
      <div className="row mb">
        {(['research', 'mapping', 'cannibalization'] as const).map((t) => (
          <button key={t} className={`btn ${tab === t ? '' : 'secondary'}`} onClick={() => { setTab(t); if (t === 'cannibalization' && !cann) void runCannibalization(); }}>
            {{ research: 'جست‌وجو و گسترش', mapping: 'نقشه کلمات (Mapping)', cannibalization: 'کانیبالیزیشن' }[t]}
          </button>
        ))}
      </div>

      {tab === 'research' && (
        <div>
          <div className="card mb">
            <div className="row">
              <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="کلمه کلیدی اصلی را وارد کنید… مثلا: قهوه ساز"
                value={seed} onChange={(e) => setSeed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void runResearch(); }} />
              <button className="btn" disabled={busy || seed.trim().length < 2} onClick={runResearch}>{busy ? 'در حال تحلیل…' : 'تحقیق'}</button>
            </div>
            <p className="muted mt" style={{ fontSize: 12.5 }}>
              گسترش قاعده‌محور فارسی + خوشه‌بندی معنایی. حجم جست‌وجوی «واقعی» فقط با اتصال سرویس داده (DataForSEO/SerpApi) در دسترس است؛ در غیر این صورت داده ساختگی نمایش داده نمی‌شود و سختی کلمات «برآورد شفاف» است.
            </p>
          </div>

          {research && (
            <>
              <div className="card mb">
                <strong>ثبت داده:</strong> <span className="muted">{research.dataProvenance.note}</span>
              </div>
              {research.related.length > 0 && (
                <div className="card mb">
                  <strong>کلمات مرتبط (AI):</strong>
                  <div className="mt">{research.related.map((r) => <span key={r.keyword} className="kw-chip used">{r.keyword}</span>)}</div>
                </div>
              )}
              <div className="grid cols-2">
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Long-tail ({research.longTails.length})</h3>
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>کلمه</th><th>نیت</th><th>سختی (برآورد)</th></tr></thead>
                      <tbody>
                        {research.longTails.slice(0, 24).map((k) => (
                          <tr key={k.keyword}>
                            <td style={{ whiteSpace: 'normal' }}>{k.keyword}</td>
                            <td>{intentBadge(k.intent)}</td>
                            <td><span className={`badge ${k.estimatedDifficulty.score >= 70 ? 'red' : k.estimatedDifficulty.score >= 45 ? 'orange' : 'green'}`}>{k.estimatedDifficulty.level} ({k.estimatedDifficulty.score})</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="card mb">
                    <h3 style={{ marginTop: 0 }}>سوالات کاربران ({research.questions.length})</h3>
                    {research.questions.map((q) => <div key={q.keyword} className="kw-chip">{q.keyword}</div>)}
                  </div>
                  <div className="card">
                    <h3 style={{ marginTop: 0 }}>خوشه‌های معنایی ({research.clusters.length})</h3>
                    {research.clusters.map((c) => (
                      <div key={c.id} className="issue">
                        <div className="row1"><span className="badge primary">{c.label}</span><span className="muted">{c.keywords.length} کلمه</span></div>
                        <div className="mt">{c.keywords.slice(0, 6).map((k) => <span key={k} className="kw-chip">{k}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'mapping' && (
        <div className="card">
          <label className="field">کلمات کلیدی (هر خط یک کلمه یا با ویرگول)
            <textarea className="input" rows={4} value={mappingKeywords} onChange={(e) => setMappingKeywords(e.target.value)} />
          </label>
          <button className="btn" onClick={runMapping}>ساخت نقشه کلمات</button>
          {mapping && (
            <div className="mt">
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>کلمه کلیدی</th><th>صفحه اختصاص‌یافته</th><th>وضعیت</th></tr></thead>
                  <tbody>
                    {mapping.entries.map((e) => (
                      <tr key={e.keyword}>
                        <td>{e.keyword}</td>
                        <td>{e.pageTitle ?? <span className="badge orange">محتوای جدید لازم است</span>}</td>
                        <td>{e.conflict ? <span className="badge red">تداخل (کانیبالیزیشن)</span> : <span className="badge green">✓</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'cannibalization' && (
        <div className="card">
          <div className="row spread mb">
            <strong>بررسی کانیبالیزیشن کلمات کلیدی بین مقالات</strong>
            <button className="btn secondary small" onClick={runCannibalization}>بررسی مجدد</button>
          </div>
          {cann && (
            <>
              <p className="muted">{cann.summary}</p>
              {cann.pairs.map((p, i) => (
                <div key={i} className="issue">
                  <div className="row1">
                    <span className={`badge ${p.severity === 'high' ? 'red' : 'orange'}`}>{p.severity === 'high' ? 'بحرانی' : 'متوسط'}</span>
                    <span className="title">{p.articles[0].title} ↔ {p.articles[1].title}</span>
                  </div>
                  <div className="desc">{p.reason}</div>
                  <div className="mt">{p.recommendations.map((r) => <div key={r}>• {r}</div>)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
