/** Small shared UI primitives: toasts, modal, empty state, buttons. */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// ---------- toasts ----------
interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }
const ToastCtx = createContext<(kind: Toast['kind'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------- modal ----------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="row spread mb">
          <h3>{title}</h3>
          <button className="btn secondary small" onClick={onClose}>بستن ✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- empty state ----------
export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty card">
      <div className="icon">{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      {hint && <div className="muted mt">{hint}</div>}
      {action && <div className="mt">{action}</div>}
    </div>
  );
}

// ---------- status badge ----------
export function StatusBadge({ status }: { status: 'green' | 'orange' | 'red' }) {
  const map = { green: 'مناسب', orange: 'نیازمند بهبود', red: 'دارای ایراد' };
  return <span className={`badge ${status}`}>{map[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, [string, string]> = {
    critical: ['بحرانی', 'red'],
    high: ['مهم', 'red'],
    medium: ['متوسط', 'orange'],
    low: ['کم', 'gray'],
    passed: ['تأیید شده', 'green'],
  };
  const [label, cls] = map[priority] ?? [priority, 'gray'];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function scoreColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}
