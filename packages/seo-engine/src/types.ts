/**
 * @danesh/seo-engine — shared types
 * Deterministic on-page SEO analysis & scoring (Persian-first).
 */

export type Lang = 'fa' | 'en';

export type Intent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export interface HeadingNode {
  level: number;
  text: string;
  index: number;
}

export interface ImageNode {
  src: string;
  alt: string;
  filename: string;
  lazy: boolean;
  hasDimensions: boolean;
  ext: string;
}

export interface LinkNode {
  href: string;
  anchorText: string;
  /** true = internal, false = external, null = non-navigational (mailto/tel/js) */
  internal: boolean | null;
  nofollow: boolean;
}

export interface ParsedArticle {
  lang: Lang;
  title: string;
  metaDescription: string;
  headings: HeadingNode[];
  paragraphs: string[];
  images: ImageNode[];
  links: LinkNode[];
  text: string;
  wordCount: number;
  charCount: number;
  lists: number;
  tables: number;
}

export interface CompetitorDoc {
  url?: string;
  title?: string;
  headings?: HeadingNode[];
  text?: string;
  wordCount?: number;
}

export interface InternalPageHint {
  url: string;
  title: string;
  keywords?: string[];
}

export type CriterionKey =
  | 'keyword'
  | 'contentQuality'
  | 'contentStructure'
  | 'searchIntent'
  | 'readability'
  | 'semantic'
  | 'headings'
  | 'internalLinks'
  | 'externalLinks'
  | 'images'
  | 'title'
  | 'metaDescription'
  | 'completeness';

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface IssueDraft {
  code: string;
  priority: IssuePriority;
  title: string;
  description: string;
  /** Where the issue is located (e.g. selector-ish path or "H2 #3") */
  location?: string;
  whyItMatters: string;
  howToFix: string;
  /** Machine-actionable fix the editor can apply */
  autoFix?: { type: string; payload?: Record<string, unknown> };
}

export interface CriterionOutput {
  score: number;
  reasons: string[];
  fixes: string[];
  issues: IssueDraft[];
}

export interface SeoIssue extends IssueDraft {
  id: string;
  criterion: CriterionKey;
  status: 'open' | 'fixed';
}

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  score: number;
  weight: number;
  status: 'green' | 'orange' | 'red';
  reasons: string[];
  fixes: string[];
  issues: SeoIssue[];
}

export type ScoreWeights = Partial<Record<CriterionKey, number>>;

export interface AnalyzeInput {
  html: string;
  /** SEO title (overrides <title> in html when provided) */
  title?: string;
  metaDescription?: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  lang?: Lang;
  intent?: Intent;
  targetWordCount?: number;
  competitors?: CompetitorDoc[];
  internalPages?: InternalPageHint[];
  weights?: ScoreWeights;
  slug?: string;
}

export interface KeywordUsage {
  keyword: string;
  kind: 'primary' | 'secondary' | 'suggested';
  occurrences: number;
  densityPct: number;
  inTitle: boolean;
  inMeta: boolean;
  inFirstParagraph: boolean;
  inHeadings: boolean;
  suggestedLocations: string[];
}

export interface KeywordReport {
  primary: {
    keyword: string;
    occurrences: number;
    densityPct: number;
    firstOccurrenceWordIndex: number | null;
    inTitle: boolean;
    inMeta: boolean;
    inFirst100Words: boolean;
    inHeadings: number;
    paragraphCoveragePct: number;
    stuffed: boolean;
    stuffingReasons: string[];
  };
  secondary: KeywordUsage[];
  suggestedPlacements: string[];
}

export interface ReadabilityReport {
  lang: Lang;
  score: number;
  label: string;
  sentences: number;
  avgWordsPerSentence: number;
  longSentenceRatio: number;
  paragraphs: number;
  avgSentencesPerParagraph: number;
  longParagraphRatio: number;
  avgWordLength: number;
  longWordRatio: number;
  passiveSentences: number;
  passiveRatio: number;
  transitionSentenceRatio: number;
  repeatedPhrases: string[];
  findings: string[];
}

export interface MetaReport {
  title: string;
  titleLengthChars: number;
  keywordInTitle: boolean;
  keywordInFirstHalf: boolean;
  metaDescription: string;
  metaLengthChars: number;
  keywordInMeta: boolean;
  attractivenessSignals: string[];
  googlePreview: { title: string; url: string; description: string };
  suggestedTitles: string[];
  suggestedMetaDescription: string | null;
}

export interface HeadingsReport {
  outline: { level: number; text: string }[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
  singleH1: boolean;
  noLevelSkip: boolean;
  keywordInHeadings: boolean;
  duplicates: string[];
  tooLong: string[];
}

export interface ImagesReport {
  count: number;
  missingAlt: number;
  altCoveragePct: number;
  genericFilenames: string[];
  notLazy: number;
  modernFormatCount: number;
  suggestions: string[];
}

export interface LinksReport {
  internalCount: number;
  externalCount: number;
  nonNavigational: number;
  genericAnchors: { text: string; href: string }[];
  linksPer100Words: number;
}

export interface SemanticReport {
  competitorCount: number;
  suggestedTerms: { term: string; docs: number; avgTf: number }[];
  coveragePct: number | null;
  competitorTopTerms: { term: string; count: number }[];
  missingTopics: string[];
}

export interface QualityReport {
  vocabRichness: number;
  sentenceVariety: number;
  repeatedSentences: string[];
  fillerRatio: number;
  avgParagraphWords: number;
}

export interface StructureReport {
  lists: number;
  tables: number;
  maxSectionWords: number;
  avgSectionWords: number;
  sectionImbalanceRatio: number | null;
  paragraphCount: number;
}

export interface IntentReport {
  declared: Intent | null;
  detected: Intent;
  signals: string[];
  aligned: boolean | null;
}

export interface CompletenessReport {
  wordCount: number;
  targetWordCount: number;
  coveragePct: number;
  hasIntro: boolean;
  hasConclusion: boolean;
  hasFaq: boolean;
  hasSources: boolean;
}

export interface SeoReport {
  lang: Lang;
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
  score: number;
  grade: string;
  criteria: CriterionResult[];
  issues: SeoIssue[];
  keywords: KeywordReport;
  readability: ReadabilityReport;
  meta: MetaReport;
  headings: HeadingsReport;
  images: ImagesReport;
  links: LinksReport;
  semantic: SemanticReport;
  quality: QualityReport;
  structure: StructureReport;
  intent: IntentReport;
  completeness: CompletenessReport;
  internalLinkSuggestions: { url: string; title: string; reason: string }[];
  generatedAt: string;
}
