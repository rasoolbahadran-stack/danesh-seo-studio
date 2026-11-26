/** Content Brief generator + editor + approval flow. */
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, useToast } from '../components/ui.js';

interface BriefData {
  keyword: string; intent: string; suggestedTitles: string[]; h1: string;
  outline: { h2: string; h3?: string[]; points: string[]; wordTarget: number }[];
  faqs: { question: string; answer: string }[]; relatedKeywords: string[];
  internalLinkSuggestions: string[]; externalSources: string[];
  targetWordCount: number; contentType: string; sources: string[];
}
interface Brief { id: string; keyword: string; status: string; createdAt: string; data: BriefData }

export default function BriefsPage() {
  const { workspaceId } = useApp();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState('');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Brief | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setBriefs((await api.get<{ briefs: Brief[] }>(`/workspaces/${workspaceId}/briefs`)).briefs);
    } catch (err) { toast('error', (err as Error).message); }
  }, [workspaceId, toast]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    if (!workspaceId || keyword.trim().length < 2) return;
    setBusy(true);
    try {
      await api.post(`/workspaces/${workspaceId}/briefs`, {
        keyword: keyword.trim(),
        competitorUrls: competitorUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean),
      });
      toast('success', 'بریف ساخته شد — قابل ویرایش است');
      setKeyword('');
      await load();
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  const approve = async (b: Brief, status: 'draft' | 'approved') => {
    if (!workspaceId) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/briefs/${b.id}`, { status });
      toast('success', status === 'approved' ? 'بریف تأیید شد — اکنون می‌توانید مقاله بسازید' : 'به حالت پیش‌نویس بازگشت');
      await load();
    } catch (err) { toast('error', (err as Error).message); }
  };

  const saveEdits = async () => {
    if (!workspaceId || !editing) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/briefs/${editing.id}`, { data: editing.data });
      toast('success', 'بریف ذخیره شد');
      setEditing(null);
      await load();
    } catch (err) { toast('error', (err as Error).message); }
  };

  if (!workspaceId) return <EmptyState icon="🌐" title="ابتدا وب‌سایت را انتخاب کنید" />;

  return (
    <div>
      <h2 className="mb">بریف محتوا (Content Brief)</h2>
      <div className="card mb">
        <div className="row">
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="کلمه کلیدی مقاله بعدی…"
            value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void generate(); }} />
          <button className="btn" disabled={busy || keyword.trim().length < 2} onClick={generate}>{busy ? 'در حال تولید…' : 'تولید بریف'}</button>
        </div>
        <label className="field mt">آدرس رقبا برای غنی‌سازی بریف (اختیاری — هر خط یک آدرس)
          <textarea className="input" dir="ltr" rows={2} value={competitorUrls} onChange={(e) => setCompetitorUrls(e.target.value)} />
        </label>
        <p className="muted" style={{ fontSize: 12.5 }}>
          ساختار پیشنهادی از قواعد + داده واقعی رقبا + (در صورت تنظیم) AI تولید می‌شود و «قابل ویرایش» است؛ تا زمان تأیید شما، مقاله‌ای از آن ساخته نمی‌شود.
        </p>
      </div>

      {briefs.length === 0 ? (
        <EmptyState icon="📋" title="هیچ بریفی ندارید" hint="اولین بریف را بسازید، ویرایش کنید و تأیید کنید." />
      ) : briefs.map((b) => (
        <div key={b.id} className="card mb">
          <div className="row spread">
            <div className="row1">
              <span className={`badge ${b.status === 'approved' ? 'green' : 'orange'}`}>{b.status === 'approved' ? 'تأییدشده' : 'پیش‌نویس'}</span>
              <strong> {b.keyword}</strong>
              <span className="muted"> — {b.data.contentType} | هدف: {b.data.targetWordCount} کلمه</span>
            </div>
            <div className="row">
              <button className="btn secondary small" onClick={() => setEditing(structuredClone(b))}>ویرایش</button>
              {b.status === 'approved'
                ? <button className="btn secondary small" onClick={() => void approve(b, 'draft')}>لغو تأیید</button>
                : <button className="btn small" onClick={() => void approve(b, 'approved')}>تأیید بریف</button>}
            </div>
          </div>
          <div className="muted mt" style={{ fontSize: 12.5 }}>{b.data.sources.join(' | ')}</div>
          <div className="mt">
            <strong>H1 پیشنهادی:</strong> {b.data.h1}
          </div>
          <div className="mt">
            <strong>عنوان‌ها:</strong> {b.data.suggestedTitles.join(' | ')}
          </div>
          <ol className="mt">
            {b.data.outline.map((o, i) => (
              <li key={i}><strong>{o.h2}</strong> <span className="muted">({o.wordTarget} کلمه)</span>
                {o.points.length > 0 && <div className="muted">{o.points.join('، ')}</div>}
              </li>
            ))}
          </ol>
          <div className="mt"><strong>FAQ:</strong> {b.data.faqs.map((f) => f.question).join(' | ')}</div>
        </div>
      ))}

      {editing && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal" style={{ width: 'min(760px, 100%)' }}>
            <div className="row spread mb">
              <h3>ویرایش بریف: {editing.keyword}</h3>
              <button className="btn secondary small" onClick={() => setEditing(null)}>بستن ✕</button>
            </div>
            <label className="field">H1
              <input className="input" value={editing.data.h1} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, h1: e.target.value } })} />
            </label>
            <label className="field">حجم هدف
              <input className="input" type="number" value={editing.data.targetWordCount}
                onChange={(e) => setEditing({ ...editing, data: { ...editing.data, targetWordCount: Number(e.target.value) } })} />
            </label>
            <strong>ساختار H2/H3:</strong>
            {editing.data.outline.map((o, i) => (
              <div key={i} className="row mt">
                <input className="input" style={{ flex: 2 }} value={o.h2}
                  onChange={(e) => {
                    const outline = [...editing.data.outline];
                    outline[i] = { ...o, h2: e.target.value };
                    setEditing({ ...editing, data: { ...editing.data, outline } });
                  }} />
                <input className="input" style={{ flex: 1 }} type="number" value={o.wordTarget}
                  onChange={(e) => {
                    const outline = [...editing.data.outline];
                    outline[i] = { ...o, wordTarget: Number(e.target.value) };
                    setEditing({ ...editing, data: { ...editing.data, outline } });
                  }} />
                <button className="btn danger small" onClick={() => {
                  setEditing({ ...editing, data: { ...editing.data, outline: editing.data.outline.filter((_, j) => j !== i) } });
                }}>حذف</button>
              </div>
            ))}
            <button className="btn secondary small mt" onClick={() => {
              setEditing({ ...editing, data: { ...editing.data, outline: [...editing.data.outline, { h2: 'سرفصل جدید', points: [], wordTarget: 150 }] } });
            }}>+ سرفصل جدید</button>
            <div className="mt">
              <button className="btn" onClick={saveEdits}>ذخیره بریف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
