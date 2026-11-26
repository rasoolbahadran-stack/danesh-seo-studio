/** Login & register + API base configuration (for demo/Pages deployments). */
import React, { useState } from 'react';
import { api, getApiBase, setApiBase, setToken } from '../api.js';
import { useToast } from '../components/ui.js';

export default function LoginPage({ onLogin }: { onLogin: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [apiBase, setBase] = useState(getApiBase());
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setApiBase(apiBase);
      const res =
        mode === 'login'
          ? await api.post<{ token: string }>('/auth/login', { email, password })
          : await api.post<{ token: string }>('/auth/register', { email, password, name });
      setToken(res.token);
      await onLogin();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
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
        <form onSubmit={submit}>
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
          <label className="field">آدرس سرور API (برای نسخه دمو روی GitHub Pages)
            <input className="input" dir="ltr" placeholder="https://your-server.com" value={apiBase} onChange={(e) => setBase(e.target.value)} />
          </label>
          <button className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'در حال پردازش…' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
          </button>
        </form>
        <div className="row mt" style={{ justifyContent: 'center' }}>
          {mode === 'login' ? (
            <button className="btn ghost" onClick={() => setMode('register')}>حساب ندارید؟ ثبت‌نام کنید</button>
          ) : (
            <button className="btn ghost" onClick={() => setMode('login')}>قبلاً ثبت‌نام کرده‌اید؟ ورود</button>
          )}
        </div>
        <p className="muted mt" style={{ fontSize: 12 }}>
          نسخه‌ای که فقط Frontend روی GitHub Pages است صراحتاً «دمو» است؛ برای عملکرد کامل، Backend را روی سرور اجرا کنید و آدرس آن را در فیلد بالا وارد کنید.
        </p>
      </div>
    </div>
  );
}
