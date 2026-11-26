/** Shared application context passed into route factories. */
import type { AppConfig } from '../config.js';
import type { Repos } from '../db/repos.js';
import type { Logger } from '../lib/logger.js';
import type { AiService } from '../services/aiService.js';
import type { AnalysisService } from '../services/analysisService.js';
import type { CompetitorService } from '../services/competitorService.js';
import type { KeywordService } from '../services/keywordService.js';
import type { BriefService } from '../services/briefService.js';

export interface AppContext {
  cfg: AppConfig;
  repos: Repos;
  logger: Logger;
  encryptionKey: string;
  ai: AiService;
  analysis: AnalysisService;
  competitors: CompetitorService;
  keywords: KeywordService;
  briefs: BriefService;
}
