/**
 * AI Content Editor — the core of Danesh SEO Studio.
 * contenteditable editor + toolbar + live SEO scoring (client-side engine)
 * + autosave with versioning + AI tasks + issue click-to-locate + SERP preview.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analyzeArticle, type Intent, type SeoReport } from '@danesh/seo-engine';
import { api, type Article, type Version } from '../api.js';
import { useApp } from '../App.js';
import { CriteriaGrid, ScoreGauge } from '../components/ScoreGauge.js';
import { GooglePreview, IssueList } from '../components/IssueList.js';
import { Modal, PriorityBadge, useToast } from '../components/ui.js';

interface DiffResult { added: string[]; removed: string[]; unchangedBlocks: number; wordDelta: number }

export default function EditorPage() {
  const { articleId } = useParams();
  const { workspaceId } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondary, setSecondary] = useState<string[]>([]);
  const [status, setStatus] = useState('draft');
  const [report, setReport] = useState<SeoReport | null>(null);
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [diff, setDiff] = useState<{ result: DiffResult; version: Version } | null>(null);
  const [rightTab, setRightTab] = useState<'issues' | 'keywords' | 'readability' | 'links' | 'meta' | 'preview'>('issues');
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentHtml = useCallback(() => editorRef.current?.innerHTML ?? '', []);

  // ---------- load ----------
  useEffect(() => {
    if (!workspaceId || !articleId) return;
    void (async () => {
      try {
        const res = await api.get<{ article: Article; versions: Version[] }>(`/workspaces/${workspaceId}/articles/${articleId}`);
        setArticle(res.article);
        setVersions(res.versions);
        setTitle(res.article.title);
        setMetaTitle(res.article.metaTitle);
        setMetaDescription(res.article.metaDescription);
        setPrimaryKeyword(res.article.primaryKeyword);
        setSecondary(res.article.secondaryKeywords);
        setStatus(res.article.status);
        setSavedAt(res.article.updatedAt);
        setServerScore(res.article.lastScore?.score ?? null);
        if (editorRef.current) {
          editorRef.current.innerHTML = res.article.contentHtml;
          lastHtmlRef.current = res.article.contentHtml;
        }
        runLocalAnalysis(res.article.contentHtml, res.article);
      } catch (err) {
        toast('error', (err as Error).message);
        navigate('/articles');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, articleId]);

  // ---------- live local analysis (client-side engine, no server needed) ----------
  const runLocalAnalysis = useCallback((html: string, art?: Article) => {
    const r = analyzeArticle({
      html,
      title: (metaTitle || title) || undefined,
      metaDescription: metaDescription || undefined,
      primaryKeyword: primaryKeyword || (art?.primaryKeyword ?? ''),
      secondaryKeywords: secondary,
      lang: 'fa',
      intent: (article?.intent || undefined) as Intent | undefined,
      slug: article?.slug || undefined,
      targetWordCount: article?.targetWords || undefined,
    });
    setReport(r);
  }, [metaTitle, title, metaDescription, primaryKeyword, secondary, article]);

  // re-run analysis when meta inputs change
  useEffect(() => {
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => runLocalAnalysis(currentHtml()), 300);
    return () => { if (scoreTimer.current) clearTimeout(scoreTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaTitle, title, metaDescription, primaryKeyword, secondary.join(',')]);

  // ---------- autosave ----------
  const save = useCallback(async (forceSave = false) => {
    if (!workspaceId || !articleId) return;
    const html = currentHtml();
    setSaving(true);
    try {
      const res = await api.patch<{ savedAt: string; version: { id: string; no: number; note: string } | null }>(
        `/workspaces/${workspaceId}/articles/${articleId}`,
        {
          title,
          contentHtml: html,
          metaTitle,
          metaDescription,
          primaryKeyword,
          secondaryKeywords: secondary,
          status,
          forceSave,
        },
      );
      setSavedAt(res.savedAt);
      if (res.version) {
        setVersions((v) => [{ id: res.version!.id, version_no: res.version!.no, title, note: res.version!.note, score_total: null, created_at: res.savedAt, created_by: '' }, ...v]);
      }
    } catch (err) {
      toast('error', `ذخیره ناموفق: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [workspaceId, articleId, title, metaTitle, metaDescription, primaryKeyword, secondary, status, toast, currentHtml]);

  const onEditorInput = useCallback(() => {
    const html = currentHtml();
    if (html === lastHtmlRef.current) return;
    lastHtmlRef.current = html;
    // live score
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => runLocalAnalysis(html), 350);
    // autosave
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(false), 1800);
  }, [currentHtml, runLocalAnalysis, save]);

  // Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void save(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // ---------- toolbar ----------
  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onEditorInput();
  };

  const insertTable = () => {
    exec('insertHTML', '<table><tr><th>ستون ۱</th><th>ستون ۲</th></tr><tr><td>—</td><td>—</td></tr><tr><td>—</td><td>—</td></tr></table><p><br></p>');
  };

  const insertLink = () => {
    const url = window.prompt('آدرس لینک:', 'https://');
    if (!url) return;
    const sel = window.getSelection()?.toString();
    if (!sel) {
      const text = window.prompt('متن انکرتکست (انکرتکست توصیفی برای سئو بهتر است):', url);
      if (text) exec('insertHTML', `<a href="${url}">${text}</a>`);
    } else {
      exec('createLink', url);
    }
  };

  const insertImage = () => {
    const url = window.prompt('آدرس تصویر:', 'https://');
    if (!url) return;
    const alt = window.prompt('Alt Text تصویر (برای سئوی تصویر ضروری است):') ?? '';
    exec('insertHTML', `<img src="${url}" alt="${alt}" loading="lazy" width="800" height="600">`);
  };

  // ---------- AI ----------
  const runAi = async (task: string, payload: Record<string, unknown> = {}) => {
    if (!workspaceId || !article) return;
    setAiBusy(task);
    try {
      const res = await api.post<{ result: unknown }>(`/workspaces/${workspaceId}/articles/${article.id}/ai/${task}`, payload);
      return res.result;
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'AI_NOT_CONFIGURED') {
        toast('info', 'سرویس AI تنظیم نشده است — از تنظیمات وب‌سایت، Provider و API Key را وارد کنید.');
      } else {
        toast('error', e.message);
      }
      return undefined;
    } finally {
      setAiBusy(null);
    }
  };

  const aiSuggestTitles = async () => {
    const result = await runAi('suggest-titles', { keyword: primaryKeyword }) as { titles?: string[] } | undefined;
    if (result?.titles?.length) {
      const pick = window.prompt(`عنوان‌های پیشنهادی (AI تولید کرده — بازبینی کنید):\n\n${result.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nشماره عنوان موردنظر را وارد کنید:`);
      const idx = Number(pick) - 1;
      if (result.titles[idx]) {
        setMetaTitle(result.titles[idx]);
        toast('success', 'عنوان جایگزین شد — فراموش نکنید ذخیره کنید');
      }
    }
  };

  const aiMeta = async () => {
    const firstPara = editorRef.current?.querySelector('p')?.textContent ?? '';
    const result = await runAi('meta-description', { keyword: primaryKeyword, summary: firstPara.slice(0, 300) }) as { description?: string } | undefined;
    if (result?.description) {
      setMetaDescription(result.description);
      toast('success', 'توضیحات متا تولید شد (AI — بازبینی کنید)');
    }
  };

  const aiFixGrammar = async () => {
    const text = editorRef.current?.innerText ?? '';
    const result = await runAi('fix-grammar', { text: text.slice(0, 6000) }) as { text?: string } | undefined;
    if (result?.text) {
      toast('info', 'متن اصلاح‌شده در کنسول آماده است؛ برای جایگذاری امن، از پیش‌نمایش مقایسه کنید.');
      console.info('[AI fix-grammar]', result.text);
      navigator.clipboard?.writeText(result.text).then(() => toast('success', 'متن اصلاح‌شده در کلیپ‌بورد کپی شد')).catch(() => undefined);
    }
  };

  const aiImproveSelected = async (task: 'rewrite' | 'expand' | 'readability') => {
    const sel = window.getSelection();
    const text = sel?.toString();
    if (!text || text.length < 10) {
      toast('info', 'ابتدا یک پاراگراف را انتخاب کنید');
      return;
    }
    const result = await runAi(task, { text }) as { html?: string } | undefined;
    if (result?.html) {
      document.execCommand('insertHTML', false, result.html);
      onEditorInput();
      toast('success', 'بازنویسی اعمال شد (AI — بازبینی کنید)');
    }
  };

  // ---------- issue locate ----------
  const locateIssue = (issue: { description?: string; title?: string }) => {
    const el = editorRef.current;
    if (!el) return;
    const needle = (issue.description ?? '').replace(/[«»]/g, '').split('…')[0].trim().slice(0, 24);
    if (!needle) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.includes(needle)) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        const rect = range.getBoundingClientRect();
        if (rect.width || rect.height) {
          const span = walker.currentNode.parentElement;
          if (span) {
            span.classList.add('editor-highlight');
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => span.classList.remove('editor-highlight'), 1800);
          }
        }
        return;
      }
    }
    toast('info', 'محل متناظر در ویرایشگر پیدا نشد');
  };

  // ---------- versions ----------
  const restoreVersion = async (v: Version) => {
    if (!workspaceId || !articleId) return;
    if (!window.confirm(`نسخه ${v.version_no} بازیابی شود؟ محتوای فعلی به‌صورت خودکار نسخه جدید می‌شود.`)) return;
    try {
      const res = await api.post<{ article: Article }>(`/workspaces/${workspaceId}/articles/${articleId}/versions/${v.id}/restore`);
      if (editorRef.current) {
        editorRef.current.innerHTML = res.article.contentHtml;
        lastHtmlRef.current = res.article.contentHtml;
      }
      setMetaTitle(res.article.metaTitle);
      setMetaDescription(res.article.metaDescription);
      toast('success', `نسخه ${v.version_no} بازیابی شد`);
      setShowVersions(false);
    } catch (err) { toast('error', (err as Error).message); }
  };

  const compareVersion = async (v: Version) => {
    if (!workspaceId || !articleId) return;
    try {
      const res = await api.get<{ diff: DiffResult }>(`/workspaces/${workspaceId}/articles/${articleId}/versions/${v.id}/diff`);
      setDiff({ result: res.diff, version: v });
    } catch (err) { toast('error', (err as Error).message); }
  };

  // ---------- keyword chips ----------
  const keywordChips = useMemo(() => {
    if (!report) return [];
    const rows = [
      { keyword: report.keywords.primary.keyword, used: report.keywords.primary.occurrences > 0 },
      ...report.keywords.secondary.map((s) => ({ keyword: s.keyword, used: s.occurrences > 0 })),
    ];
    return rows;
  }, [report]);

  if (!article) return <div className="empty">در حال بارگذاری مقاله…</div>;

  const urlPreview = `${article.slug ? `example.com/${article.slug}` : 'example.com/article'}`;

  return (
    <div>
      {/* settings bar */}
      <div className="card mb">
        <div className="grid cols-2">
          <label className="field">عنوان مقاله (H1 مفهومی)
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">کلمه کلیدی اصلی
            <input className="input" value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} />
          </label>
          <label className="field">عنوان سئو (Title) — {metaTitle.length} کاراکتر
            <input className="input" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
          </label>
          <label className="field">توضیحات متا — {metaDescription.length} کاراکتر
            <textarea className="input" rows={2} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
          </label>
        </div>
        <div className="row spread">
          <div className="row">
            {keywordChips.map((c) => (
              <span key={c.keyword} className={`kw-chip ${c.used ? 'used' : 'unused'}`} title={c.used ? 'در محتوا استفاده شده' : 'در محتوا استفاده نشده'}>
                {c.used ? '✓' : '✖'} {c.keyword}
              </span>
            ))}
            <input
              className="input" style={{ width: 200 }} placeholder="+ کلمه فرعی (Enter)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { setSecondary([...secondary, v]); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
          </div>
          <div className="row">
            <select className="input" style={{ width: 130 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">پیش‌نویس</option>
              <option value="in_review">در بازبینی</option>
              <option value="published">منتشرشده</option>
            </select>
            <span className="autosave-note">
              {saving ? 'در حال ذخیره…' : savedAt ? `ذخیره‌شده: ${new Date(savedAt).toLocaleTimeString('fa-IR')}` : ''}
            </span>
            <button className="btn secondary small" onClick={() => setShowVersions(true)}>نسخه‌ها ({versions.length})</button>
            <button className="btn small" onClick={() => void save(true)}>ذخیره (Ctrl+S)</button>
          </div>
        </div>
      </div>

      <div className="editor-layout">
        {/* left: editor */}
        <div>
          <div className="editor-toolbar">
            <button className="tb-btn" onClick={() => exec('undo')} title="Undo">↶</button>
            <button className="tb-btn" onClick={() => exec('redo')} title="Redo">↷</button>
            <span className="tb-sep" />
            {(['h1', 'h2', 'h3', 'p'] as const).map((tag) => (
              <button key={tag} className="tb-btn" onClick={() => exec('formatBlock', `<${tag}>`)}>{tag.toUpperCase()}</button>
            ))}
            <span className="tb-sep" />
            <button className="tb-btn" onClick={() => exec('bold')}><b>B</b></button>
            <button className="tb-btn" onClick={() => exec('italic')}><i>I</i></button>
            <span className="tb-sep" />
            <button className="tb-btn" onClick={() => exec('insertUnorderedList')}>● لیست</button>
            <button className="tb-btn" onClick={() => exec('insertOrderedList')}>۱. لیست</button>
            <button className="tb-btn" onClick={insertTable}>جدول</button>
            <span className="tb-sep" />
            <button className="tb-btn" onClick={insertLink}>🔗 لینک</button>
            <button className="tb-btn" onClick={insertImage}>🖼 تصویر</button>
            <span className="tb-sep" />
            <button className="tb-btn" disabled={aiBusy !== null} onClick={aiSuggestTitles}>{aiBusy === 'suggest-titles' ? '…' : '🤖 عنوان'}</button>
            <button className="tb-btn" disabled={aiBusy !== null} onClick={aiMeta}>{aiBusy === 'meta-description' ? '…' : '🤖 متا'}</button>
            <button className="tb-btn" disabled={aiBusy !== null} onClick={() => void aiImproveSelected('rewrite')}>🤖 بازنویسی</button>
            <button className="tb-btn" disabled={aiBusy !== null} onClick={() => void aiImproveSelected('expand')}>🤖 گسترش</button>
            <button className="tb-btn" disabled={aiBusy !== null} onClick={() => void aiImproveSelected('readability')}>🤖 خوانایی</button>
            <button className="tb-btn" disabled={aiBusy !== null} onClick={aiFixGrammar}>🤖 نگارش</button>
            <span className="tb-sep" />
            <button className="tb-btn" onClick={() => setPreviewMode(!previewMode)}>{previewMode ? '✏️ ویرایش' : '👁 پیش‌نمایش'}</button>
          </div>
          {previewMode ? (
            <div className="editor-area" style={{ background: 'var(--bg)' }}>
              <h1>{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: currentHtml() }} />
            </div>
          ) : (
            <div
              className="editor-area"
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={onEditorInput}
              aria-label="ویرایشگر محتوا"
            />
          )}
          <div className="row spread mt muted">
            <span>کلمات: {report?.wordCount ?? 0} | کاراکترها: {report?.charCount ?? 0} | زمان مطالعه: ~{report?.readingTimeMinutes ?? 0} دقیقه</span>
            <span>
              <button className="btn secondary small" onClick={async () => {
                if (!workspaceId) return;
                try {
                  const res = await api.post<{ score: number; report: SeoReport }>(`/workspaces/${workspaceId}/articles/${article.id}/analyze`);
                  setServerScore(res.score);
                  setReport(res.report);
                  toast('success', `تحلیل کامل سرور: امتیاز ${res.score} (شامل داده رقبا در صورت تنظیم)`);
                } catch (err) { toast('error', (err as Error).message); }
              }}>تحلیل کامل سمت سرور</button>
            </span>
          </div>
        </div>

        {/* right: live panel */}
        <div>
          <div className="card mb">
            <ScoreGauge score={serverScore ?? report?.score ?? 0} grade={report?.grade} />
            {serverScore !== null && Math.abs(serverScore - (report?.score ?? 0)) > 2 && (
              <div className="muted mt">امتیاز سرور (با داده رقبا): {serverScore}</div>
            )}
            {report && <CriteriaGrid criteria={report.criteria} />}
          </div>

          <div className="row mb">
            {(['issues', 'keywords', 'readability', 'links', 'meta', 'preview'] as const).map((t) => (
              <button key={t} className={`btn small ${rightTab === t ? '' : 'secondary'}`} onClick={() => setRightTab(t)}>
                {{ issues: 'ایرادات', keywords: 'کلمات', readability: 'خوانایی', links: 'لینک‌ها', meta: 'عنوان/متا', preview: 'گوگل' }[t]}
              </button>
            ))}
          </div>

          {rightTab === 'issues' && report && (
            <IssueList issues={report.issues} onLocate={locateIssue} />
          )}

          {rightTab === 'keywords' && report && (
            <div className="card">
              <div className="row1"><strong>تراکم کلمه کلیدی:</strong> {report.keywords.primary.densityPct}٪ ({report.keywords.primary.occurrences} بار)</div>
              <div className="muted">پوشش پاراگراف‌ها: {report.keywords.primary.paragraphCoveragePct}٪ | در عنوان: {report.keywords.primary.inTitle ? '✓' : '✖'} | در متا: {report.keywords.primary.inMeta ? '✓' : '✖'} | در هدینگ: {report.keywords.primary.inHeadings}</div>
              {report.keywords.primary.stuffed && (
                <div className="badge red mt">⚠ Keyword Stuffing: {report.keywords.primary.stuffingReasons.join('؛ ')}</div>
              )}
              {report.keywords.suggestedPlacements.length > 0 && (
                <div className="mt"><strong>پیشنهاد محل استفاده:</strong> {report.keywords.suggestedPlacements.join('، ')}</div>
              )}
              {report.semantic.suggestedTerms.length > 0 && (
                <div className="mt">
                  <strong>واژه‌های معنایی پیشنهادی (از رقبا):</strong>
                  <div className="mt">{report.semantic.suggestedTerms.slice(0, 12).map((t) => (
                    <span key={t.term} className="kw-chip unused" title={`در ${t.docs} رقیب استفاده شده`}>{t.term}</span>
                  ))}</div>
                </div>
              )}
            </div>
          )}

          {rightTab === 'readability' && report && (
            <div className="card">
              <div className="row1"><strong>امتیاز خوانایی:</strong> {report.readability.score} ({report.readability.label})</div>
              <div className="muted mt">میانگین طول جمله: {report.readability.avgWordsPerSentence} کلمه</div>
              <div className="muted">جملات مجهول: {report.readability.passiveSentences}</div>
              <div className="muted">نسبت کلمات انتقالی: {(report.readability.transitionSentenceRatio * 100).toFixed(0)}٪</div>
              {report.readability.findings.map((f, i) => <div key={i} className="issue mt">{f}</div>)}
            </div>
          )}

          {rightTab === 'links' && report && (
            <div className="card">
              <div className="row1"><strong>لینک داخلی:</strong> {report.links.internalCount} | <strong>خارجی:</strong> {report.links.externalCount}</div>
              {report.internalLinkSuggestions.length > 0 && (
                <div className="mt"><strong>پیشنهاد لینک داخلی از مقالات دیگر ورک‌اسپیس:</strong>
                  {report.internalLinkSuggestions.map((s) => (
                    <div key={s.url} className="issue"><span className="title">{s.title}</span><div className="desc">{s.reason}</div></div>
                  ))}
                </div>
              )}
              {report.images.suggestions.length > 0 && (
                <div className="mt"><strong>تصاویر:</strong> {report.images.count} تصویر، پوشش Alt {report.images.altCoveragePct}٪</div>
              )}
            </div>
          )}

          {rightTab === 'meta' && report && (
            <div className="card">
              <div className="row1"><strong>طول عنوان:</strong> {report.meta.titleLengthChars} کاراکتر (۳۰–۶۰) | <strong>کلمه کلیدی در عنوان:</strong> {report.meta.keywordInTitle ? '✓' : '✖'}</div>
              {report.meta.suggestedTitles.length > 0 && (
                <div className="mt"><strong>عنوان‌های پیشنهادی قاعده‌محور:</strong>
                  {report.meta.suggestedTitles.map((t) => (
                    <div key={t} className="issue" onClick={() => { setMetaTitle(t); toast('success', 'عنوان جایگزین شد'); }}>
                      <span className="title">{t}</span>
                    </div>
                  ))}
                </div>
              )}
              {report.meta.suggestedMetaDescription && (
                <div className="issue mt" onClick={() => { setMetaDescription(report.meta.suggestedMetaDescription!); }}>
                  <span className="title">پیشنهاد توضیحات متا (کلیک = جایگزینی)</span>
                  <div className="desc">{report.meta.suggestedMetaDescription}</div>
                </div>
              )}
            </div>
          )}

          {rightTab === 'preview' && (
            <GooglePreview title={metaTitle || title} url={urlPreview} description={metaDescription} />
          )}
        </div>
      </div>

      {/* versions modal */}
      {showVersions && (
        <Modal title="نسخه‌های مقاله" onClose={() => setShowVersions(false)}>
          {versions.map((v) => (
            <div key={v.id} className="issue">
              <div className="row1">
                <span className="badge primary">نسخه {v.version_no}</span>
                <span className="title">{v.note}</span>
                <span className="muted">{new Date(v.created_at).toLocaleString('fa-IR')}</span>
              </div>
              <div className="row mt">
                <button className="btn secondary small" onClick={() => void compareVersion(v)}>مقایسه با فعلی</button>
                <button className="btn small" onClick={() => void restoreVersion(v)}>بازیابی</button>
              </div>
            </div>
          ))}
        </Modal>
      )}

      {/* diff modal */}
      {diff && (
        <Modal title={`مقایسه نسخه ${diff.version.version_no} با نسخه فعلی`} onClose={() => setDiff(null)}>
          <div className="muted mb">تغییر خالص کلمات: {diff.result.wordDelta > 0 ? '+' : ''}{diff.result.wordDelta} | بلوک‌های بدون تغییر: {diff.result.unchangedBlocks}</div>
          {diff.result.added.map((b, i) => <div key={`a${i}`} className="diff-block diff-add">+ {b}</div>)}
          {diff.result.removed.map((b, i) => <div key={`r${i}`} className="diff-block diff-rem">− {b}</div>)}
        </Modal>
      )}
    </div>
  );
}
