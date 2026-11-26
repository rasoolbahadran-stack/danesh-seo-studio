/** Prioritized issue list with click-to-locate + Google SERP preview. */
import React from 'react';
import type { SeoIssue } from '@danesh/seo-engine';
import { PriorityBadge } from './ui.js';

export function IssueList({ issues, onLocate }: { issues: SeoIssue[]; onLocate?: (issue: SeoIssue) => void }) {
  if (issues.length === 0) {
    return <div className="badge green">هیچ ایرادی یافت نشد 🎉</div>;
  }
  return (
    <div>
      {issues.map((issue) => (
        <div key={issue.id} className="issue" onClick={() => onLocate?.(issue)}>
          <div className="row1">
            <PriorityBadge priority={issue.priority} />
            <span className="title">{issue.title}</span>
            {issue.location && <code className="inline">{issue.location}</code>}
          </div>
          <div className="desc">{issue.description}</div>
          <div className="fix">💡 {issue.howToFix}</div>
          <div className="muted" style={{ fontSize: 12 }}>{issue.whyItMatters}</div>
        </div>
      ))}
    </div>
  );
}

export function GooglePreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="google-preview">
      <div className="muted mb" style={{ fontSize: 12 }}>پیش‌نمایش نتیجه جست‌وجوی گوگل</div>
      <p className="gp-title">{title || 'بدون عنوان سئو'}</p>
      <div className="gp-url" dir="ltr">{url || 'example.com'}</div>
      <p className="gp-desc">{description || 'توضیحات متا تنظیم نشده است…'}</p>
    </div>
  );
}
