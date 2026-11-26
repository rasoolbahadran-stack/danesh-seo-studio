/**
 * Readability analysis with real Persian-language rules:
 * sentence/paragraph lengths, long-word ratio, Persian passive markers,
 * transition-word ratio, repeated phrases. English falls back to Flesch.
 */
import type { Lang, ParsedArticle, ReadabilityReport } from './types.js';
import { sentencesOf, tokenize, normalizePersian, transitionList, ZWNJ } from './persian.js';

const MAX_WORDS_PER_SENTENCE = 25;       // a sentence longer than this is "long"
const TARGET_AVG_SENTENCE_WORDS = 20;    // Persian comfort zone ≈ 20
const TARGET_SENTENCES_PER_PARAGRAPH = 4;
const LONG_WORD_CHARS_FA = 6;            // Persian words > 6 letters (excl. ZWNJ) are "heavy"
const LONG_WORD_CHARS_EN = 9;
const PASSIVE_RE_FA = /(?:[\u0600-\u06FF]{2,}ه\s+(?:شد|شده|گردید|گشته))|(?:شده\s+(?:است|بود))|(?:گردید\B)|(?:گشته\s+است)/;
const TRANSITION_MIN_RATIO = 0.15;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function faLabel(score: number): string {
  if (score >= 80) return 'خوانایی بالا';
  if (score >= 60) return 'قابل قبول';
  if (score >= 40) return 'نیازمند بهبود';
  return 'دشوار برای خواندن';
}

function enLabel(score: number): string {
  if (score >= 80) return 'Very easy to read';
  if (score >= 60) return 'Plain English';
  if (score >= 40) return 'Fairly difficult';
  return 'Difficult';
}

function countSyllablesEn(word: string): number {
  const w = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function repeatedPhrases(sentences: string[], n = 4): string[] {
  const counts = new Map<string, number>();
  for (const s of sentences) {
    const words = tokenize(normalizePersian(s));
    for (let i = 0; i + n <= words.length; i++) {
      const g = words.slice(i, i + n).join(' ');
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g, c]) => `${g} (${c} بار)`);
}

export function analyzeReadability(article: ParsedArticle): ReadabilityReport {
  const lang: Lang = article.lang;
  const sentences = sentencesOf(article.text);
  const words = tokenize(normalizePersian(article.text));
  const paragraphs = article.paragraphs;
  const transitions = transitionList(lang);

  const sentenceWordCounts = sentences.map((s) => tokenize(normalizePersian(s)).length);
  const totalSentenceWords = sentenceWordCounts.reduce((a, b) => a + b, 0);
  const avgWordsPerSentence = sentences.length ? totalSentenceWords / sentences.length : 0;
  const longSentences = sentenceWordCounts.filter((c) => c > MAX_WORDS_PER_SENTENCE).length;
  const longSentenceRatio = sentences.length ? longSentences / sentences.length : 0;

  const paragraphSentenceCounts = paragraphs.map((p) => Math.max(1, sentencesOf(p).length));
  const avgSentencesPerParagraph = paragraphSentenceCounts.length
    ? paragraphSentenceCounts.reduce((a, b) => a + b, 0) / paragraphSentenceCounts.length : 0;
  const longParagraphs = paragraphSentenceCounts.filter((c) => c > TARGET_SENTENCES_PER_PARAGRAPH + 1).length;
  const longParagraphRatio = paragraphSentenceCounts.length ? longParagraphs / paragraphSentenceCounts.length : 0;

  const wordLens = words.map((w) => w.split(ZWNJ).join('').length);
  const avgWordLength = wordLens.length ? wordLens.reduce((a, b) => a + b, 0) / wordLens.length : 0;
  const longWordLimit = lang === 'fa' ? LONG_WORD_CHARS_FA : LONG_WORD_CHARS_EN;
  const longWords = wordLens.filter((l) => l > longWordLimit).length;
  const longWordRatio = words.length ? longWords / words.length : 0;

  const passiveSentences = lang === 'fa'
    ? sentences.filter((s) => PASSIVE_RE_FA.test(normalizePersian(s))).length
    : sentences.filter((s) => /\b(was|were|been|being)\b/i.test(s)).length;
  const passiveRatio = sentences.length ? passiveSentences / sentences.length : 0;

  const withTransition = sentences.filter((s) => {
    const n = normalizePersian(s);
    return transitions.some((t) => n.startsWith(normalizePersian(t)) || n.includes(normalizePersian(t)));
  }).length;
  const transitionSentenceRatio = sentences.length ? withTransition / sentences.length : 0;

  const findings: string[] = [];
  let score: number;

  if (lang === 'fa') {
    score = 100;
    if (avgWordsPerSentence > TARGET_AVG_SENTENCE_WORDS) {
      const pen = Math.min(40, (avgWordsPerSentence - TARGET_AVG_SENTENCE_WORDS) * 2.2);
      score -= pen;
      findings.push(`میانگین طول جمله ${avgWordsPerSentence.toFixed(1)} کلمه است؛ برای فارسی حدود ۲۰ کلمه ایده‌آل است (−${Math.round(pen)} امتیاز)`);
    }
    if (longSentenceRatio > 0.25) {
      const pen = Math.min(25, (longSentenceRatio - 0.25) * 120);
      score -= pen;
      findings.push(`${(longSentenceRatio * 100).toFixed(0)}٪ جملات طولانی‌تر از ۲۵ کلمه هستند (−${Math.round(pen)} امتیاز)`);
    }
    if (avgSentencesPerParagraph > TARGET_SENTENCES_PER_PARAGRAPH) {
      const pen = Math.min(20, (avgSentencesPerParagraph - TARGET_SENTENCES_PER_PARAGRAPH) * 8);
      score -= pen;
      findings.push(`پاراگراف‌ها به‌طور میانگین ${avgSentencesPerParagraph.toFixed(1)} جمله دارند (هدف حداکثر ۴) (−${Math.round(pen)} امتیاز)`);
    }
    if (longWordRatio > 0.12) {
      const pen = Math.min(20, (longWordRatio - 0.12) * 200);
      score -= pen;
      findings.push(`${(longWordRatio * 100).toFixed(0)}٪ واژه‌ها طولانی‌تر از ۶ حرف هستند (−${Math.round(pen)} امتیاز)`);
    }
    if (passiveRatio > 0.08) {
      const pen = Math.min(15, (passiveRatio - 0.08) * 250);
      score -= pen;
      findings.push(`${passiveSentences} جمله با ساخت مجهول شناسایی شد (−${Math.round(pen)} امتیاز)`);
    }
    if (transitionSentenceRatio < TRANSITION_MIN_RATIO) {
      const pen = Math.min(10, (TRANSITION_MIN_RATIO - transitionSentenceRatio) * 80);
      score -= pen;
      findings.push(`فقط ${(transitionSentenceRatio * 100).toFixed(0)}٪ جملات از کلمات ربط/انتقال استفاده می‌کنند (−${Math.round(pen)} امتیاز)`);
    }
    score = clamp(Math.round(score), 5, 99);
  } else {
    // Flesch Reading Ease
    const syllables = words.reduce((a, w) => a + countSyllablesEn(w), 0);
    const fre = words.length && sentences.length
      ? 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
      : 0;
    score = clamp(Math.round(fre), 0, 100);
    if (score < 60) findings.push(`Flesch score ${score} — aim for 60+`);
    if (avgWordsPerSentence > 22) findings.push(`Average sentence length ${avgWordsPerSentence.toFixed(1)} words — aim for ≤ 22`);
  }

  const reps = repeatedPhrases(sentences);
  if (reps.length) findings.push(`عبارات تکراری: ${reps.join('، ')}`);

  return {
    lang,
    score,
    label: lang === 'fa' ? faLabel(score) : enLabel(score),
    sentences: sentences.length,
    avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(1)),
    longSentenceRatio: Number(longSentenceRatio.toFixed(3)),
    paragraphs: paragraphs.length,
    avgSentencesPerParagraph: Number(avgSentencesPerParagraph.toFixed(1)),
    longParagraphRatio: Number(longParagraphRatio.toFixed(3)),
    avgWordLength: Number(avgWordLength.toFixed(1)),
    longWordRatio: Number(longWordRatio.toFixed(3)),
    passiveSentences,
    passiveRatio: Number(passiveRatio.toFixed(3)),
    transitionSentenceRatio: Number(transitionSentenceRatio.toFixed(3)),
    repeatedPhrases: reps,
    findings,
  };
}
