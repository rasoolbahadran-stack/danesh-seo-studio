/** SVG score gauge + criteria grid. */
import React from 'react';
import type { CriterionResult } from '@danesh/seo-engine';
import { scoreColor, StatusBadge } from './ui.js';

export function ScoreGauge({ score, grade }: { score: number; grade?: string }) {
  const color = scoreColor(score);
  const stroke = { green: '#16a34a', orange: '#ea580c', red: '#dc2626' }[color];
  const R = 52;
  const C = 2 * Math.PI * R;
  const filled = (score / 100) * C;
  return (
    <div className="gauge-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`امتیاز سئو: ${score}`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={stroke} strokeWidth="12"
          strokeDasharray={`${filled} ${C - filled}`} strokeLinecap="round" transform="rotate(-90 60 60)"
        />
        <text x="60" y="66" textAnchor="middle" fontSize="26" fontWeight="800" fill={stroke}>{score}</text>
      </svg>
      <div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>امتیاز کلی سئو</div>
        <div className="gauge-num" style={{ color: stroke }}>
          {score}
          {grade && <span style={{ fontSize: 15 }}> / {grade}</span>}
        </div>
        <StatusBadge status={color} />
      </div>
    </div>
  );
}

export function CriteriaGrid({ criteria }: { criteria: CriterionResult[] }) {
  return (
    <div className="criteria-grid">
      {criteria.map((c) => {
        const color = scoreColor(c.score);
        return (
          <div key={c.key} className="criterion" title={`${c.reasons.join(' — ') || 'بدون نکته'} ${c.fixes.length ? `| پیشنهاد: ${c.fixes.join(' — ')}` : ''}`}>
            <span className={`dot ${color}`} />
            <span className="name">{c.label}</span>
            <span className="score-num" style={{ color: `var(--${color})` }}>{c.score}</span>
            <span className="muted" style={{ fontSize: 11 }}>(وزن {c.weight})</span>
          </div>
        );
      })}
    </div>
  );
}
