/**
 * Keyword clustering: greedy agglomerative grouping by token-set Jaccard
 * similarity, with the most frequent head-term as the cluster label.
 */
import { normalizePersian, tokenize, PERSIAN_STOPWORDS } from '@danesh/seo-engine';
import type { KeywordCluster } from './types.js';
import { classifyIntent } from './intent.js';

const DEFAULT_THRESHOLD = 0.34;

function tokenSet(keyword: string): Set<string> {
  const toks = tokenize(normalizePersian(keyword)).filter(
    (t) => !PERSIAN_STOPWORDS.has(t) && t.length >= 2,
  );
  return toks.length > 0 ? new Set(toks) : new Set(tokenize(normalizePersian(keyword)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

function clusterLabel(keywords: string[]): string {
  const df = new Map<string, number>();
  for (const k of keywords) {
    for (const t of tokenSet(k)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  let best = '';
  let bestScore = -1;
  for (const [t, c] of df) {
    const score = c * t.length;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best || keywords[0];
}

export function clusterKeywords(keywords: string[], threshold: number = DEFAULT_THRESHOLD): KeywordCluster[] {
  const items = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .filter((k, i, arr) => arr.indexOf(k) === i); // dedupe
  const sets = items.map((k) => ({ k, s: tokenSet(k) }));
  const clusters: { members: typeof sets }[] = [];

  for (const item of sets) {
    let placed = false;
    for (const c of clusters) {
      const representative = c.members[0].s;
      const sim = jaccard(item.s, representative);
      const sharesOne = [...item.s].some((t) => representative.has(t) && t.length >= 3);
      if (sim >= threshold || (c.members.length >= 2 && sharesOne && sim >= 0.15)) {
        c.members.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ members: [item] });
  }

  return clusters.map((c, i) => {
    const kws = c.members.map((m) => m.k);
    return {
      id: `cluster-${i + 1}`,
      label: clusterLabel(kws),
      keywords: kws,
      intents: [...new Set(kws.map((k) => classifyIntent(k)))],
    };
  });
}
