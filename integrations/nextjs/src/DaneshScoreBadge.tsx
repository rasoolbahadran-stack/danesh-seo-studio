'use client';
/** Live SEO score badge widget for Next.js sites (fetches Danesh public report endpoint). */
import React, { useEffect, useState } from 'react';

export interface DaneshScoreBadgeProps {
  apiBaseUrl: string;
  workspaceId: string;
  articleId: string;
  shareToken: string;
}

interface Report { score: number; grade: string; updatedAt: string }

export default function DaneshScoreBadge({ apiBaseUrl, workspaceId, articleId, shareToken }: DaneshScoreBadgeProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/public/workspaces/${encodeURIComponent(workspaceId)}/articles/${encodeURIComponent(articleId)}/report?token=${encodeURIComponent(shareToken)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Report) => setReport(data))
      .catch((err: Error) => setError(err.message));
  }, [apiBaseUrl, workspaceId, articleId, shareToken]);

  if (error) return <span style={{ color: '#64748b' }}>[گزارش سئو در دسترس نیست]</span>;
  if (!report) return null;
  const color = report.score >= 75 ? '#16a34a' : report.score >= 50 ? '#ea580c' : '#dc2626';
  return (
    <span dir="rtl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 999, border: `1px solid ${color}`, color, fontWeight: 700, fontSize: 13 }}>
      امتیاز سئو: {report.score}/100 ({report.grade})
    </span>
  );
}
