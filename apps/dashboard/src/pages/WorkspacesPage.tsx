/** Workspaces (multi-site management) + settings: weights, AI provider, SERP, members. */
import React, { useEffect, useState } from 'react';
import { api, type Workspace, type AiStatus } from '../api.js';
import { useApp } from '../App.js';
import { EmptyState, Modal, useToast } from '../components/ui.js';
import { DEFAULT_WEIGHTS, CRITERION_LABELS } from '@danesh/seo-engine';

interface Member { id: string; email: string; name: string; role: string }

export default function WorkspacesPage() {
  const { workspaces, refresh, workspaceId, setWorkspaceId } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();

  return (
    <div>
      <div className="row spread mb">
        <h2 style={{ margin: 0 }}>وب‌سایت‌ها</h2>
        <button className="btn" onClick={() => setShowCreate(true)}>+ وب‌سایت جدید</button>
      </div>
      {workspaces.length === 0 ? (
        <EmptyState icon="🌐" title="هیچ وب‌سایتی ثبت نشده" hint="برای هر وب‌سایت یک ورک‌اسپیس مستقل با تنظیمات و داده جداسازی‌شده ساخته می‌شود." />
      ) : (
        <div className="grid cols-3">
          {workspaces.map((w) => (
            <div key={w.id} className="card" style={{ borderColor: w.id === workspaceId ? 'var(--primary)' : undefined }}>
              <h3 style={{ marginTop: 0 }}>{w.name}</h3>
              <div className="muted">دامنه: {w.domain || '—'}</div>
              <div className="muted">زبان: {w.lang === 'fa' ? 'فارسی' : 'انگلیسی'} | CMS: {w.cms}</div>
              <div className="row mt">
                <button className="btn small" onClick={() => { setWorkspaceId(w.id); toast('success', `وب‌سایت فعال: ${w.name}`); }}>
                  {w.id === workspaceId ? '✓ فعال' : 'انتخاب'}
                </button>
                <ManageButton workspace={w} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal title="افزودن وب‌سایت جدید" onClose={() => setShowCreate(false)} >
        <CreateForm onDone={async () => { setShowCreate(false); await refresh(); }} />
      </Modal>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [lang, setLang] = useState('fa');
  const [cms, setCms] = useState('other');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { setWorkspaceId } = useApp();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const res = await api.post<{ workspace: Workspace }>('/workspaces', { name, domain, lang, cms });
        await onDone();
        setWorkspaceId(res.workspace.id);
        toast('success', 'وب‌سایت ساخته شد');
      } catch (err) {
        toast('error', (err as Error).message);
      } finally { setBusy(false); }
    }}>
      <label className="field">نام وب‌سایت<input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="field">دامنه<input className="input" dir="ltr" placeholder="example.ir" value={domain} onChange={(e) => setDomain(e.target.value)} /></label>
      <label className="field">زبان اصلی
        <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="fa">فارسی</option><option value="en">English</option>
        </select>
      </label>
      <label className="field">نوع CMS
        <select className="input" value={cms} onChange={(e) => setCms(e.target.value)}>
          <option value="wordpress">WordPress</option>
          <option value="astro">Astro</option>
          <option value="nextjs">Next.js</option>
          <option value="static-html">HTML استاتیک</option>
          <option value="custom-rest">سرویس سفارشی (REST Contract)</option>
          <option value="other">سایر</option>
        </select>
      </label>
      <button className="btn" disabled={busy || name.length < 2}>ایجاد</button>
    </form>
  );
}

function ManageButton({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn secondary small" onClick={() => setOpen(true)}>تنظیمات</button>
      {open && <SettingsModal workspace={workspace} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'general' | 'weights' | 'ai' | 'serp' | 'connection' | 'members'>('general');
  const [name, setName] = useState(workspace.name);
  const [domain, setDomain] = useState(workspace.domain);
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    try { return workspace.weights_json ? (JSON.parse(workspace.weights_json) as Record<string, number>) : { ...DEFAULT_WEIGHTS }; }
    catch { return { ...DEFAULT_WEIGHTS }; }
  });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiBase, setAiBase] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [serpKind, setSerpKind] = useState<'dataforseo' | 'serpapi'>('dataforseo');
  const [serpLogin, setSerpLogin] = useState('');
  const [serpPass, setSerpPass] = useState('');
  const [serpKey, setSerpKey] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('viewer');
  const [connType, setConnType] = useState<string>('none');
  const [connSiteUrl, setConnSiteUrl] = useState('');
  const [connUsername, setConnUsername] = useState('');
  const [connPassword, setConnPassword] = useState('');
  const [connApiKey, setConnApiKey] = useState('');
  const [connWebhookUrl, setConnWebhookUrl] = useState('');
  const [connWebhookSecret, setConnWebhookSecret] = useState('');
  const [connTestResult, setConnTestResult] = useState<string | null>(null);
  const [hasPass, setHasPass] = useState(false);

  const base = `/workspaces/${workspace.id}`;

  useEffect(() => {
    void (async () => {
      try {
        setAiStatus(await api.get<AiStatus>(`${base}/settings/ai`));
        setMembers((await api.get<{ members: Member[] }>(`${base}/members`)).members);
        const conn = await api.get<{ connectionType: string; siteUrl: string; username: string; webhookUrl: string; hasPassword?: boolean }>(`${base}/connection/settings/connection`);
        setConnType(conn.connectionType ?? 'none');
        setConnSiteUrl(conn.siteUrl ?? '');
        setConnUsername(conn.username ?? '');
        setConnWebhookUrl(conn.webhookUrl ?? '');
        setHasPass(Boolean(conn.hasPassword));
      } catch { /* non-admin may get 403 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveConnection = async () => {
    try {
      const body: Record<string, string> = { connectionType: connType, siteUrl: connSiteUrl, username: connUsername, webhookUrl: connWebhookUrl };
      if (connPassword) body.password = connPassword;
      if (connApiKey) body.apiKey = connApiKey;
      if (connWebhookSecret) body.webhookSecret = connWebhookSecret;
      await api.post(`${base}/connection/settings/connection`, body);
      setConnTestResult('✅ ذخیره شد — اکنون «تست اتصال» را بزنید');
    } catch (err) { setConnTestResult(`خطا: ${(err as Error).message}`); }
  };

  const testConnection = async () => {
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`${base}/connection/settings/connection/test`);
      setConnTestResult(`${r.ok ? '✅' : '⛔'} ${r.message}`);
    } catch (err) { setConnTestResult(`خطا: ${(err as Error).message}`); }
  };

  const saveGeneral = async () => {
    try {
      await api.patch(base, { name, domain });
      toast('success', 'ذخیره شد');
    } catch (err) { toast('error', (err as Error).message); }
  };

  const saveWeights = async () => {
    try {
      await api.patch(base, { weights });
      toast('success', 'وزن معیارها ذخیره شد — تحلیل‌های بعدی با این وزن‌ها محاسبه می‌شوند');
    } catch (err) { toast('error', (err as Error).message); }
  };

  const saveAi = async () => {
    try {
      const body: Record<string, string> = {};
      if (aiBase) body.baseUrl = aiBase;
      if (aiModel) body.model = aiModel;
      if (aiKey) body.apiKey = aiKey;
      setAiStatus(await api.post<AiStatus>(`${base}/settings/ai`, body));
      setAiKey('');
      toast('success', 'تنظیمات AI ذخیره شد (کلید به‌صورت رمزنگاری‌شده نگهداری می‌شود)');
    } catch (err) { toast('error', (err as Error).message); }
  };

  const testAi = async () => {
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`${base}/settings/ai/test`);
      toast(r.ok ? 'success' : 'error', r.message);
    } catch (err) { toast('error', (err as Error).message); }
  };

  const saveSerp = async () => {
    try {
      const body = serpKind === 'dataforseo' ? { kind: 'dataforseo', login: serpLogin, password: serpPass } : { kind: 'serpapi', apiKey: serpKey };
      await api.post(`${base}/settings/serp`, body);
      toast('success', 'تنظیمات SERP ذخیره شد');
    } catch (err) { toast('error', (err as Error).message); }
  };

  const addMember = async () => {
    try {
      const r = await api.post<{ message: string }>(`${base}/members`, { email: memberEmail, role: memberRole });
      toast('success', r.message);
      setMembers((await api.get<{ members: Member[] }>(`${base}/members`)).members);
      setMemberEmail('');
    } catch (err) { toast('error', (err as Error).message); }
  };

  const tabs: [string, string][] = [
    ['general', 'عمومی'], ['weights', 'وزن امتیازدهی'], ['ai', 'هوش مصنوعی'], ['serp', 'SERP / داده کلمات'], ['connection', 'اتصال به سایت'], ['members', 'اعضا'],
  ];

  return (
    <Modal title={`تنظیمات: ${workspace.name}`} onClose={onClose}>
      <div className="row mb">
        {tabs.map(([k, label]) => (
          <button key={k} className={`btn small ${tab === k ? '' : 'secondary'}`} onClick={() => setTab(k as typeof tab)}>{label}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div>
          <label className="field">نام<input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">دامنه<input className="input" dir="ltr" value={domain} onChange={(e) => setDomain(e.target.value)} /></label>
          <button className="btn" onClick={saveGeneral}>ذخیره</button>
        </div>
      )}

      {tab === 'weights' && (
        <div>
          <p className="muted">وزن هر معیار در امتیاز کلی (وزن‌ها نسبی هستند و جمع‌شان نرمال‌سازی می‌شود).</p>
          {Object.entries(DEFAULT_WEIGHTS).map(([key, def]) => (
            <label key={key} className="field" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{CRITERION_LABELS[key as keyof typeof CRITERION_LABELS]}</span>
              <input type="number" min={0} max={100} className="input" style={{ width: 80 }}
                value={weights[key] ?? def}
                onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} />
            </label>
          ))}
          <button className="btn" onClick={saveWeights}>ذخیره وزن‌ها</button>
        </div>
      )}

      {tab === 'ai' && (
        <div>
          <p className="muted">
            وضعیت: {aiStatus?.configured
              ? `✅ تنظیم شده (${aiStatus.provider} / مدل ${aiStatus.model} / کلید ${aiStatus.maskedKey})`
              : '⛔ تنظیم نشده — قابلیت‌های AI پیام شفاف «تنظیم نشده» می‌دهند و هیچ خروجی ساختگی نمایش داده نمی‌شود.'}
          </p>
          <label className="field">Base URL (سازگار با OpenAI)
            <input className="input" dir="ltr" placeholder="https://open.bigmodel.cn/api/paas/v4" value={aiBase} onChange={(e) => setAiBase(e.target.value)} />
          </label>
          <label className="field">مدل
            <input className="input" dir="ltr" placeholder="glm-4-flash / gpt-4o-mini / deepseek-chat" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
          </label>
          <label className="field">API Key (فقط برای ذخیره — نمایش داده نمی‌شود)
            <input className="input" dir="ltr" type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn" onClick={saveAi}>ذخیره</button>
            <button className="btn secondary" onClick={testAi}>تست اتصال</button>
          </div>
          <p className="muted mt" style={{ fontSize: 12 }}>
            سازگار با Z.ai GLM، OpenAI، OpenRouter، Groq، DeepSeek و Ollama محلی. کلیدها با AES-256-GCM در دیتابیس رمزنگاری می‌شوند و هرگز به فرانت‌اند برنمی‌گردند.
          </p>
        </div>
      )}

      {tab === 'serp' && (
        <div>
          <label className="field">سرویس
            <select className="input" value={serpKind} onChange={(e) => setSerpKind(e.target.value as typeof serpKind)}>
              <option value="dataforseo">DataForSEO</option>
              <option value="serpapi">SerpApi</option>
            </select>
          </label>
          {serpKind === 'dataforseo' ? (
            <>
              <label className="field">Login<input className="input" dir="ltr" value={serpLogin} onChange={(e) => setSerpLogin(e.target.value)} /></label>
              <label className="field">Password<input className="input" dir="ltr" type="password" value={serpPass} onChange={(e) => setSerpPass(e.target.value)} /></label>
            </>
          ) : (
            <label className="field">API Key<input className="input" dir="ltr" type="password" value={serpKey} onChange={(e) => setSerpKey(e.target.value)} /></label>
          )}
          <button className="btn" onClick={saveSerp}>ذخیره</button>
          <p className="muted mt" style={{ fontSize: 12 }}>
            بدون این سرویس، تحلیل SERP و حجم جست‌وجوی واقعی با وضعیت شفاف «تنظیم نشده» پاسخ می‌دهند — هیچ داده ساختگی تولید نمی‌شود.
          </p>
        </div>
      )}

      {tab === 'connection' && (
        <div>
          <label className="field">نوع اتصال
            <select className="input" value={connType} onChange={(e) => setConnType(e.target.value)}>
              <option value="none">— بدون اتصال —</option>
              <option value="wordpress-rest">WordPress (REST + Application Password)</option>
              <option value="rest-contract">سایت سفارشی (قرارداد REST)</option>
              <option value="webhook">فقط Webhook</option>
            </select>
          </label>
          {connType !== 'none' && connType !== 'webhook' && (
            <>
              <label className="field">آدرس سایت
                <input className="input" dir="ltr" placeholder="https://example.ir" value={connSiteUrl} onChange={(e) => setConnSiteUrl(e.target.value)} />
              </label>
              {connType === 'wordpress-rest' && (
                <>
                  <label className="field">نام کاربری وردپرس
                    <input className="input" dir="ltr" value={connUsername} onChange={(e) => setConnUsername(e.target.value)} />
                  </label>
                  <label className="field">Application Password
                    <input className="input" dir="ltr" type="password" value={connPassword} onChange={(e) => setConnPassword(e.target.value)} placeholder={hasPass ? '**** ذخیره شده — برای تغییر مقدار جدید وارد کنید' : ''} />
                  </label>
                </>
              )}
              {connType === 'rest-contract' && (
                <label className="field">API Key سایت (اختیاری)
                  <input className="input" dir="ltr" type="password" value={connApiKey} onChange={(e) => setConnApiKey(e.target.value)} />
                </label>
              )}
            </>
          )}
          {connType !== 'none' && (
            <>
              {connType === 'webhook' && (
                <>
                  <label className="field">Webhook URL
                    <input className="input" dir="ltr" value={connWebhookUrl} onChange={(e) => setConnWebhookUrl(e.target.value)} />
                  </label>
                  <label className="field">Webhook Secret
                    <input className="input" dir="ltr" type="password" value={connWebhookSecret} onChange={(e) => setConnWebhookSecret(e.target.value)} />
                  </label>
                </>
              )}
              <div className="row">
                <button className="btn" onClick={saveConnection}>ذخیره اتصال</button>
                <button className="btn secondary" onClick={testConnection}>تست اتصال (واقعی)</button>
              </div>
              {connTestResult && <div className="muted mt">{connTestResult}</div>}
              <p className="muted mt" style={{ fontSize: 12 }}>
                اطلاعات اتصال با AES-256-GCM رمزنگاری و در سرور ذخیره می‌شود؛ برای وردپرس، افزونه Connector را روی سایت نصب کنید (integrations/wordpress).
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div>
          {members.map((m) => (
            <div key={m.id} className="row spread issue">
              <span>{m.name} <span className="muted">({m.email})</span></span>
              <span className="badge primary">{m.role}</span>
            </div>
          ))}
          <div className="row mt">
            <input className="input" dir="ltr" placeholder="email@example.ir" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            <select className="input" style={{ width: 110 }} value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
              <option value="viewer">viewer</option><option value="editor">editor</option><option value="admin">admin</option>
            </select>
            <button className="btn" onClick={addMember}>افزودن</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
