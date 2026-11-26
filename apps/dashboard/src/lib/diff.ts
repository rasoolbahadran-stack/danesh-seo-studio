/** Block-level diff between two HTML versions (same algorithm as the API). */
export interface BlockDiffResult {
  added: string[];
  removed: string[];
  unchangedBlocks: number;
  wordDelta: number;
}

function blocksOf(html: string): string[] {
  const out: string[] = [];
  const re = /<(h[1-6]|p|li|blockquote|tr)[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const text = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
  }
  return out;
}

function wordCount(texts: string[]): number {
  return texts.reduce((a, t) => a + t.split(/\s+/).filter(Boolean).length, 0);
}

export function blockDiff(beforeHtml: string, afterHtml: string): BlockDiffResult {
  const before = blocksOf(beforeHtml);
  const after = blocksOf(afterHtml);
  const afterSet = new Map<string, number>();
  for (const b of after) afterSet.set(b, (afterSet.get(b) ?? 0) + 1);
  const beforeSet = new Map<string, number>();
  for (const b of before) beforeSet.set(b, (beforeSet.get(b) ?? 0) + 1);

  const added: string[] = [];
  for (const [b, c] of afterSet) {
    const extra = c - (beforeSet.get(b) ?? 0);
    for (let i = 0; i < extra; i++) added.push(b);
  }
  const removed: string[] = [];
  for (const [b, c] of beforeSet) {
    const extra = c - (afterSet.get(b) ?? 0);
    for (let i = 0; i < extra; i++) removed.push(b);
  }
  return {
    added,
    removed,
    unchangedBlocks: Math.max(0, Math.min(before.length, after.length) - added.length - removed.length),
    wordDelta: wordCount(after) - wordCount(before),
  };
}
