/**
 * Duplicate/similarity detection: 64-bit SimHash over word 4-gram shingles
 * + Jaccard overlap. Used for duplicate pages and near-duplicate content.
 */
import { normalizePersian, tokenize } from '@danesh/seo-engine';

function fnv1a64(str: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash;
}

function shingles(text: string, n = 4): string[] {
  const words = tokenize(normalizePersian(text));
  if (words.length < n) return words.length ? [words.join(' ')] : [];
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(' '));
  return out;
}

/** 64-bit SimHash of a text (stable across runs). */
export function simhash64(text: string): bigint {
  const sh = shingles(text);
  if (sh.length === 0) return 0n;
  const bits = new Array<number>(64).fill(0);
  for (const s of sh) {
    const h = fnv1a64(s);
    for (let b = 0; b < 64; b++) {
      bits[b] += (h >> BigInt(b)) & 1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (bits[b] > 0) out |= 1n << BigInt(b);
  return out;
}

export function hammingHexDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

export interface SimilarityResult {
  simhashHamming: number;
  jaccardShingles: number;
  verdict: 'near-duplicate' | 'similar' | 'different';
}

export function compareTexts(a: string, b: string): SimilarityResult {
  const hamming = hammingHexDistance(simhash64(a), simhash64(b));
  const sa = new Set(shingles(a));
  const sb = new Set(shingles(b));
  const jac = jaccard(sa, sb);
  const verdict = jac >= 0.8 || hamming <= 6 ? 'near-duplicate' : jac >= 0.45 || hamming <= 16 ? 'similar' : 'different';
  return {
    simhashHamming: hamming,
    jaccardShingles: Number(jac.toFixed(3)),
    verdict,
  };
}
