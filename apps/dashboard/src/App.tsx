/** App shell: router, auth state, workspace context, sidebar. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, getApiMode, getToken, setToken, type User, type Workspace } from './api.js';
import { ToastProvider, useToast } from './components/ui.js';
import LoginPage from './pages/LoginPage.js';
import DashboardPage from './pages/DashboardPage.js';
import WorkspacesPage from './pages/WorkspacesPage.js';
import ArticlesPage from './pages/ArticlesPage.js';
import EditorPage from './pages/EditorPage.js';
import KeywordsPage from './pages/KeywordsPage.js';
import CompetitorsPage from './pages/CompetitorsPage.js';
import TechnicalPage from './pages/TechnicalPage.js';
import BriefsPage from './pages/BriefsPage.js';
import ReportsPage from './pages/ReportsPage.js';

// ---------- contexts ----------
interface AppState {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}
const AppCtx = createContext<AppState>(null as unknown as AppState);
export const useApp = () => useContext(AppCtx);

const NAV = [
  { to: '/', label: '📊 داشبورد' },
  { to: '/articles', label: '📝 مقالات و ویرایشگر' },
  { to: '/keywords', label: '🔑 تحقیق کلمات کلیدی' },
  { to: '/competitors', label: '⚔️ تحلیل رقبا' },
  { to: '/technical', label: '🛠 سئو تکنیکال' },
  { to: '/briefs', label: '📋 بریف محتوا' },
  { to: '/reports', label: '🗂 گزارش‌ها' },
  { to: '/workspaces', label: '🌐 وب‌سایت‌ها و تنظیمات' },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { user, workspaces, workspaceId, setWorkspaceId, logout } = useApp();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">دس</span> دانش سئو استودیو</div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt muted" style={{ fontSize: 12 }}>v0.1.0 — مستقل و قابل اتصال به هر وب‌سایت</div>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>خوش آمدید، {user?.name}</h1>
          <div className="ws-switcher">
            {getApiMode() === 'local' && <span className="badge primary" title="همه داده‌ها فقط در مرورگر شما">حالت محلی</span>}
            <span className="muted">وب‌سایت فعال:</span>
            <select className="ws-select" value={workspaceId ?? ''} onChange={(e) => setWorkspaceId(e.target.value || null)}>
              <option value="">— انتخاب وب‌سایت —</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}{w.domain ? ` (${w.domain})` : ''}</option>
              ))}
            </select>
            <button className="btn secondary small" onClick={logout}>خروج</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function InnerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWs] = useState<string | null>(localStorage.getItem('danesh_ws'));
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const refresh = useCallback(async () => {
    if (getApiMode() !== 'local' && !getToken()) {
      setUser(null);
      setBooting(false);
      return;
    }
    try {
      const me = await api.get<{ user: User }>('/auth/me');
      setUser(me.user);
      const list = await api.get<{ workspaces: Workspace[] }>('/workspaces');
      setWorkspaces(list.workspaces);
      setWs((current) =>
        current && list.workspaces.some((w) => w.id === current) ? current : (list.workspaces[0]?.id ?? null),
      );
    } catch {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (workspaceId) localStorage.setItem('danesh_ws', workspaceId);
  }, [workspaceId]);
  useEffect(() => {
    const onUnauthorized = () => {
      toast('info', 'نشست شما منقضی شد؛ دوباره وارد شوید');
      navigate('/login');
    };
    window.addEventListener('danesh:unauthorized', onUnauthorized);
    return () => window.removeEventListener('danesh:unauthorized', onUnauthorized);
  }, [navigate, toast]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const state = useMemo<AppState>(() => ({
    user, workspaces, workspaceId, setWorkspaceId: setWs, refresh, logout,
  }), [user, workspaces, workspaceId, refresh, logout]);

  if (booting) {
    return <div className="empty" style={{ paddingTop: '30vh' }}>در حال بارگذاری…</div>;
  }

  if (!user) {
    return (
      <AppCtx.Provider value={state}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={refresh} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppCtx.Provider>
    );
  }

  return (
    <AppCtx.Provider value={state}>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/editor/:articleId" element={<EditorPage />} />
          <Route path="/keywords" element={<KeywordsPage />} />
          <Route path="/competitors" element={<CompetitorsPage />} />
          <Route path="/technical" element={<TechnicalPage />} />
          <Route path="/briefs" element={<BriefsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppCtx.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <InnerApp />
      </BrowserRouter>
    </ToastProvider>
  );
}
