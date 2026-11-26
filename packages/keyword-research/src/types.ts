/** Shared types for keyword research. */

export type IntentLabel = 'informational' | 'commercial' | 'transactional' | 'navigational' | 'unknown';

export interface KeywordIdea {
  keyword: string;
  source: 'modifier' | 'question' | 'related' | 'ai' | 'seed';
  intent: IntentLabel;
  /** Heuristic estimate — clearly flagged, NOT real SERP data */
  estimatedDifficulty: { score: number; level: string; estimated: true };
  words: number;
}

export interface KeywordCluster {
  id: string;
  label: string;
  keywords: string[];
  intents: IntentLabel[];
}

export interface ResearchResult {
  seed: string;
  longTails: KeywordIdea[];
  questions: KeywordIdea[];
  related: KeywordIdea[];
  clusters: KeywordCluster[];
  dataProvenance: {
    volume: 'not_available' | 'available';
    difficulty: 'heuristic_estimate';
    note: string;
  };
}

export interface SerpResult {
  position: number;
  title: string;
  url: string;
  description: string;
}

export interface SerpReport {
  status: 'ok' | 'not_configured' | 'error';
  provider: string;
  keyword: string;
  results: SerpResult[];
  message?: string;
  howToEnable?: string;
}

export interface VolumeReport {
  status: 'ok' | 'not_configured' | 'error';
  provider: string;
  keyword: string;
  volumes: { keyword: string; monthlySearches: number | null; competition?: string }[];
  message?: string;
}
