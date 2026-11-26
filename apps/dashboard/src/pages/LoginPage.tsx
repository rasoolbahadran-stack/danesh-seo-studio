/** Login page — سه راه ورود: یک‌کلیک ادمین، حالت محلی بدون سرور، فرم پیشرفته */
import React, { useState } from 'react';
import { api, DEFAULT_ADMIN, getApiBase, getMode, setApiBase, setMode, setToken } from '../api.js';
import { useToast } from '../components/ui.js';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> }) {
  const [advanced, setAdvanced] = useState(false);
  const [mode, setFormMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [apiBase, setBase] = useState(getApiBase());
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const finish = async () => {
    await onLogin();
  };

  // ورود سریع ادمین — رسول بهادران / 1234 (سرور)
  const quickAdmin = async () => {
    setBusy('admin');
    try {
      setMode('server');
      setApiBase(apiBase);
      const res = await api.post<{ token: string }>('/auth/login', { email: DEFAULT_ADMIN.email, password: DEFAULT_ADMIN.password });
      setToken(res.token);
      await finish();
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'NETWORK') {
        toast('error', 'سرور در دسترس نیست — از دکمه «ورود بدون سرور» استفاده کنید یا آدرس API را بررسی کنید.');
      } else {
        toast('error', e.message);
      }
    } finally {
      setBusy(null);
    }
  };

  // حالت محلی — بدون هیچ سروری
  const localMode = async () => {
    setBusy('local');
    try {
      setMode('local');
      setToken(null);
      await finish();
      toast('success', 'حالت محلی فعال شد — همه داده‌ها فقط در مرورگر شما ذخیره می‌شود.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('form');
    try {
      setMode('server');
      setApiBase(apiBase);
      const res =
        mode === 'login'
          ? await api.post<{ token: string }>('/auth/login', { email, password })
          : await api.post<{ token: string }>('/auth/register', { email, password, name });
      setToken(res.token);
      await finish();
    } catch (err) {
      const e2 = err as Error & { code?: string };
      if (e2.code === 'NETWORK') toast('error', 'سرور در دسترس نیست — از دکمه «ورود بدون سرور» استفاده کنید.');
      else toast('error', e2.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="auth-box">
      <div className="card">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="logo">دس</span> دانش سئو استودیو
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>
          پلتفرم مستقل تحلیل، تولید و بهینه‌سازی سئو با هوش مصنوعی
        </p>

        {/* ورود سریع مالک ابزار */}
        <button
          className="btn"
          style={{ width: '100%', padding: '14px', fontSize: 16, marginBottom: 10 }}
          disabled={busy !== null}
          onClick={quickAdmin}
        >
          {busy === 'admin' ? 'در حال ورود…' : '⚡ ورود سریع — رسول بهادران (ادمین)'}
        </button>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
          بدون ثبت‌نام؛ با حساب پیش‌فرض ادمین (رمز پیش‌فرض: ۱۲۳۴ — بعد از ورود می‌توانید تغییر دهید)
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* حالت محلی — بدون سرور */}
        <button
          className="btn secondary"
          style={{ width: '100%', padding: '12px', marginBottom: 6 }}
          disabled={busy !== null}
          onClick={localMode}
        >
          {busy === 'local' ? 'در حال آماده‌سازی…' : '🔌 ورود بدون سرور — حالت محلی مرورگر'}
        </button>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
          بدون API و بدون نصب هیچ چیز؛ تحلیل، ویرایشگر و تحقیق کلمات همین‌جا در مرورگر کار می‌کند و داده‌ها فقط روی دستگاه شما ذخیره می‌شود.
          {getMode() === 'local' && <> (حالت فعلی: محلی)</>}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* فرم پیشرفته — برای کاربران چندنفره */}
        <button className="btn ghost" style={{ width: '100%' }} onClick={() => setAdvanced(!advanced)}>
          {advanced ? 'بستن فرم پیشرفته ▲' : 'ورود/ثبت‌نام پیشرفته (چند کاربره) ▼'}
        </button>
        {advanced && (
          <form onSubmit={submitForm} className="mt">
            {mode === 'register' && (
              <label className="field">نام و نام خانوادگی
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </label>
            )}
            <label className="field">ایمیل
              <input className="input" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">رمز عبور (حداقل ۸ کاراکتر)
              <input className="input" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <label className="field">آدرس سرور API (خالی بگذارید اگر داشبورد روی همان سرور است)
              <input className="input" dir="ltr" placeholder="https://your-server.com" value={apiBase} onChange={(e) => setBase(e.target.value)} />
            </label>
            <button className="btn" style={{ width: '100%' }} disabled={busy !== null}>
              {busy === 'form' ? 'در حال پردازش…' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
            </button>
            <div className="row mt" style={{ justifyContent: 'center' }}>
              {mode === 'login' ? (
                <button type="button" className="btn ghost" onClick={() => setFormMode('register')}>حساب ندارید؟ ثبت‌نام</button>
              ) : (
                <button type="button" className="btn ghost" onClick={() => setFormMode('login')}>قبلاً ثبت‌نام کرده‌اید؟ ورود</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
