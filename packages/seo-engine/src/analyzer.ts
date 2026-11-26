/**
 * The orchestrator: parse HTML → run all criterion analyses → build the
 * complete SeoReport with weighted score, criteria, prioritized issues and
 * sub-reports. Fully deterministic — same input always yields the same output.
 */
import { parseArticle } from './parse.js';
import { analyzeKeywords, suggestSemanticTerms } from './keywords.js';
import { analyzeReadability } from './readability.js';
import { analyzeHeadings } from './headings.js';
import { analyzeMeta } from './meta.js';
import { analyzeImages } from './images.js';
import { analyzeLinks } from './links.js';
import { analyzeSemantic } from './semantic.js';
import { analyzeCompleteness, analyzeIntent, analyzeQuality, analyzeStructure } from './quality.js';
import { computeTotalScore, CRITERION_LABELS, DEFAULT_WEIGHTS, makeIssue, statusOf } from './scoring.js';
import type {
  AnalyzeInput, CompetitorDoc, CriterionKey, CriterionResult, InternalPageHint,
  SeoIssue, SeoReport,
} from './types.js';
import { normalizePersian, tokenize } from './persian.js';

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export interface AnalyzeOptions extends Omit<AnalyzeInput, 'competitors' | 'internalPages'> {
  competitors?: CompetitorDoc[];
  internalPages?: InternalPageHint[];
}

export function analyzeArticle(input: AnalyzeOptions): SeoReport {
  const lang = input.lang ?? 'fa';
  const article = parseArticle(input.html, {
    lang,
    title: input.title,
    metaDescription: input.metaDescription,
  });

  const competitors = input.competitors ?? [];
  const primaryKeyword = input.primaryKeyword?.trim() || '';

  // ---------- sub-analyses ----------
  const keywords = analyzeKeywords({
    article,
    primaryKeyword,
    secondaryKeywords: input.secondaryKeywords ?? [],
    titleOverride: input.title,
    metaOverride: input.metaDescription,
  });
  const readability = analyzeReadability(article);
  const meta = analyzeMeta({ article, primaryKeyword, title: input.title, metaDescription: input.metaDescription, slug: input.slug });
  const headings = analyzeHeadings(article, primaryKeyword);
  const images = analyzeImages(article);
  const links = analyzeLinks(article);
  const semantic = analyzeSemantic(article, competitors);
  const quality = analyzeQuality(article);
  const structure = analyzeStructure(article);
  const intent = analyzeIntent(article, input.intent ?? null);

  const competitorWordCounts = competitors.map((c) => c.wordCount ?? 0).filter((n) => n > 0);
  const targetWordCount =
    input.targetWordCount ?? median(competitorWordCounts) ?? 900;
  const completeness = analyzeCompleteness(article, targetWordCount);

  // ---------- keyword criterion ----------
  const kwCriteria = () => {
    const score0 = 100;
    let score = score0;
    const reasons: string[] = [];
    const fixes: string[] = [];
    const issues: SeoIssue[] = [];
    const p = keywords.primary;

    if (!primaryKeyword) {
      score -= 50;
      reasons.push('کلمه کلیدی اصلی تعیین نشده است');
      issues.push(makeIssue('keyword', {
        code: 'no-primary-keyword',
        priority: 'critical',
        title: 'کلمه کلیدی اصلی تعیین نشده',
        description: 'امتیازدهی بهینه‌سازی کلمات کلیدی بدون کلمه کلیدی اصلی معنا ندارد.',
        whyItMatters: 'بدون کلمه کلیدی هدف، بهینه‌سازی و سنجش ارتباط محتوا ممکن نیست.',
        howToFix: 'در تنظیمات مقاله، کلمه کلیدی اصلی را مشخص کنید.',
      }));
    } else {
      if (p.occurrences === 0) {
        score -= 45;
        reasons.push('کلمه کلیدی اصلی در متن استفاده نشده است');
        fixes.push('کلمه کلیدی را طبیعی در متن (به‌ویژه پاراگراف اول) بیاورید');
        issues.push(makeIssue('keyword', {
          code: 'keyword-missing',
          priority: 'critical',
          title: 'کلمه کلیدی اصلی در محتوا نیست',
          description: `«${primaryKeyword}» هیچ‌بار در متن نیامده است.`,
          whyItMatters: 'گوگل نمی‌تواند ارتباط صفحه با این کلمه را تشخیص دهد.',
          howToFix: 'کلمه کلیدی را در پاراگراف اول، یکی از هدینگ‌ها و متن اصلی به‌کار ببرید.',
        }));
      } else {
        if (p.densityPct < 0.4) {
          score -= 15;
          reasons.push(`تراکم کلمه کلیدی خیلی کم است (${p.densityPct}٪)`);
        }
        if (p.densityPct > 3.5) {
          score -= 25;
          reasons.push(`تراکم کلمه کلیدی خیلی زیاد است (${p.densityPct}٪) — نشانه Keyword Stuffing`);
        }
        if (p.stuffed) {
          score -= 20;
          reasons.push(...p.stuffingReasons.map((r) => `Stuffing: ${r}`));
          issues.push(makeIssue('keyword', {
            code: 'keyword-stuffing',
            priority: 'high',
            title: 'تکرار غیرطبیعی کلمه کلیدی (Keyword Stuffing)',
            description: p.stuffingReasons.join('؛ '),
            whyItMatters: 'تکرار مصنوعی کلمه کلیدی توسط گوگل جریمه می‌شود و اعتماد کاربر را کم می‌کند.',
            howToFix: 'برخی تکرارها را با مترادف‌ها یا لحن طبیعی جایگزین کنید.',
          }));
        }
        if (!p.inTitle) {
          score -= 10;
          fixes.push('کلمه کلیدی را در عنوان سئو بیاورید');
        }
        if (!p.inFirst100Words && p.firstOccurrenceWordIndex === null) {
          // already penalized as missing
        } else if (!p.inFirst100Words) {
          score -= 8;
          reasons.push('کلمه کلیدی در ۱۰۰ کلمه اول نیامده است');
        }
        if (!p.inHeadings) {
          score -= 8;
          fixes.push('کلمه کلیدی را در یکی از H2ها بیاورید');
        }
        if (p.paragraphCoveragePct < 20 && article.wordCount > 400) {
          score -= 10;
          reasons.push('کلمه کلیدی فقط در بخش کوچکی از مقاله آمده است');
        }
      }
    }

    const unusedSecondary = keywords.secondary.filter((s) => s.occurrences === 0);
    if (unusedSecondary.length > 0) {
      score -= Math.min(15, unusedSecondary.length * 5);
      reasons.push(`${unusedSecondary.length} کلمه کلیدی فرعی استفاده نشده است`);
      for (const s of unusedSecondary) {
        issues.push(makeIssue('keyword', {
          code: `secondary-missing-${s.keyword}`,
          priority: 'medium',
          title: `کلمه کلیدی فرعی «${s.keyword}» استفاده نشده`,
          description: 'این کلمه مرتبط در محتوا نیست و پوشش معنایی را کاهش می‌دهد.',
          whyItMatters: 'کلمات مرتبط به گوگل کمک می‌کنند موضوع را کامل تشخیص دهد.',
          howToFix: `کلمه «${s.keyword}» را طبیعی در متن یا یکی از هدینگ‌ها بیاورید.`,
          autoFix: { type: 'suggest-insert-keyword', payload: { keyword: s.keyword } },
        }));
      }
    }

    score = Math.max(0, Math.min(100, score));
    return { score, reasons, fixes, issues, key: 'keyword' as CriterionKey };
  };

  const buildResult = (
    key: CriterionKey,
    score: number,
    reasons: string[],
    fixes: string[],
    issues: SeoIssue[],
  ): CriterionResult => ({
    key,
    label: CRITERION_LABELS[key],
    score,
    weight: DEFAULT_WEIGHTS[key],
    status: statusOf(score),
    reasons,
    fixes,
    issues,
  });

  // ---------- issue builders per criterion ----------
  const kwResult = kwCriteria();
  const keywordIssues = kwResult.issues as SeoIssue[];

  const headingIssues: SeoIssue[] = [];
  if (!headings.singleH1) {
    headingIssues.push(makeIssue('headings', {
      code: headings.h1Count === 0 ? 'h1-missing' : 'h1-multiple',
      priority: headings.h1Count === 0 ? 'critical' : 'high',
      title: headings.h1Count === 0 ? 'هیچ H1 وجود ندارد' : 'بیش از یک H1 در صفحه',
      description: `تعداد H1: ${headings.h1Count}`,
      whyItMatters: 'H1 سیگنال اصلی موضوع صفحه برای موتور جست‌وجو است.',
      howToFix: headings.h1Count === 0
        ? 'یک H1 برای عنوان اصلی مقاله تعیین کنید.'
        : 'همه H1ها به H2 تغییر دهند به‌جز یکی.',
      autoFix: headings.h1Count > 1 ? { type: 'demote-extra-h1', payload: {} } : undefined,
    }));
  }
  if (!headings.noLevelSkip) {
    headingIssues.push(makeIssue('headings', {
      code: 'level-skip',
      priority: 'medium',
      title: 'پرش در ساختار هدینگ‌ها',
      description: 'مثلاً از H2 مستقیماً به H4 رفته‌اید.',
      whyItMatters: 'ساختار سلسله‌مراتبی درست به فهم موضوع کمک می‌کند.',
      howToFix: 'سطوح هدینگ‌ها را اصلاح کنید تا بدون پرش باشند.',
    }));
  }
  if (headings.duplicates.length > 0) {
    headingIssues.push(makeIssue('headings', {
      code: 'duplicate-headings',
      priority: 'low',
      title: 'هدینگ‌های تکراری',
      description: headings.duplicates.join('، '),
      whyItMatters: 'هدینگ تکراری نشانه محتوای تکراری است.',
      howToFix: 'هدینگ‌های تکراری را متمایز کنید.',
    }));
  }

  const titleIssues: SeoIssue[] = [];
  if (!meta.keywordInTitle) {
    titleIssues.push(makeIssue('title', {
      code: 'keyword-not-in-title',
      priority: 'high',
      title: 'کلمه کلیدی اصلی در عنوان سئو نیست',
      description: `عنوان فعلی: «${meta.title || '—'}»`,
      whyItMatters: 'عنوان قوی‌ترین سیگنال On-Page برای کلمه کلیدی است.',
      howToFix: 'کلمه کلیدی را در ابتدای عنوان بگذارید.',
      autoFix: { type: 'set-title', payload: { title: meta.suggestedTitles[0] } },
    }));
  }
  if (meta.titleLengthChars < 30 || meta.titleLengthChars > 60) {
    titleIssues.push(makeIssue('title', {
      code: 'title-length',
      priority: meta.titleLengthChars < 15 || meta.titleLengthChars > 70 ? 'high' : 'medium',
      title: meta.titleLengthChars < 30 ? 'عنوان سئو کوتاه است' : 'عنوان سئو بلند است',
      description: `${meta.titleLengthChars} کاراکتر (بازه بهینه: ۳۰–۶۰)`,
      whyItMatters: 'عنوان خارج از بازه یا بریده می‌شود یا فضای رتبه‌بندی را هدر می‌دهد.',
      howToFix: 'طول عنوان را در بازه ۳۰ تا ۶۰ کاراکتر تنظیم کنید.',
      autoFix: { type: 'suggest-title', payload: { titles: meta.suggestedTitles } },
    }));
  }

  const metaIssues: SeoIssue[] = [];
  if (!meta.metaDescription) {
    metaIssues.push(makeIssue('metaDescription', {
      code: 'meta-missing',
      priority: 'high',
      title: 'توضیحات متا وجود ندارد',
      description: 'Meta Description خالی است.',
      whyItMatters: 'توضیحات متا بر نرخ کلیک (CTR) در نتایج جست‌وجو اثر مستقیم دارد.',
      howToFix: 'توضیحات ۱۲۰ تا ۱۶۰ کاراکتری شامل کلمه کلیدی بنویسید.',
      autoFix: meta.suggestedMetaDescription
        ? { type: 'set-meta-description', payload: { description: meta.suggestedMetaDescription } }
        : undefined,
    }));
  } else if (meta.metaLengthChars < 70 || meta.metaLengthChars > 165) {
    metaIssues.push(makeIssue('metaDescription', {
      code: 'meta-length',
      priority: 'medium',
      title: 'طول توضیحات متا خارج از بازه است',
      description: `${meta.metaLengthChars} کاراکتر (بازه بهینه: ۱۲۰–۱۶۰)`,
      whyItMatters: 'خارج از این بازه در SERP بریده می‌شود.',
      howToFix: 'طول توضیحات را تنظیم کنید.',
    }));
  }

  const imageIssues: SeoIssue[] = [];
  if (images.count === 0) {
    imageIssues.push(makeIssue('images', {
      code: 'no-images',
      priority: 'high',
      title: 'مقاله بدون تصویر است',
      description: 'هیچ تصویری در محتوا نیست.',
      whyItMatters: 'تصویر شاخص برای اشتراک‌گذاری و CTR ضروری است.',
      howToFix: 'یک تصویر مرتبط با Alt توصیفی اضافه کنید.',
      autoFix: { type: 'insert-image-prompt', payload: {} },
    }));
  } else {
    if (images.missingAlt > 0) {
      imageIssues.push(makeIssue('images', {
        code: 'missing-alt',
        priority: 'high',
        title: 'برخی تصاویر بدون Alt Text هستند',
        description: `${images.missingAlt} تصویر از ${images.count} بدون Alt است.`,
        whyItMatters: 'Alt برای دسترس‌پذیری و درک تصویر توسط موتور جست‌وجو لازم است.',
        howToFix: 'برای همه تصاویر Alt توصیفی بنویسید.',
        autoFix: { type: 'open-alt-editor', payload: {} },
      }));
    }
    if (images.genericFilenames.length > 0) {
      imageIssues.push(makeIssue('images', {
        code: 'generic-filename',
        priority: 'low',
        title: 'نام فایل تصاویر عمومی است',
        description: images.genericFilenames.join('، '),
        whyItMatters: 'نام فایل توصیفی سیگنال کوچکی برای سئوی تصویر است.',
        howToFix: 'نام فایل‌ها را قبل از آپلود توصیفی کنید.',
      }));
    }
  }

  const linkIssues: SeoIssue[] = [];
  if (links.internalCount === 0) {
    linkIssues.push(makeIssue('internalLinks', {
      code: 'no-internal-links',
      priority: 'high',
      title: 'هیچ لینک داخلی وجود ندارد',
      description: 'هیچ لینکی به صفحات دیگر سایت خودتان داده نشده است.',
      whyItMatters: 'لینک داخلی خزش و توزیع اعتبار را بهبود می‌دهد و کاربر را نگه می‌دارد.',
      howToFix: 'دو تا سه لینک داخلی مرتبط با انکرتکست توصیفی اضافه کنید.',
    }));
  }
  if (links.genericAnchors.length > 0) {
    linkIssues.push(makeIssue('internalLinks', {
      code: 'generic-anchor',
      priority: 'medium',
      title: 'انکرتکست‌های کلی',
      description: links.genericAnchors.map((a) => `«${a.text}»`).join('، '),
      whyItMatters: 'انکرتکست توصیفی به گوگل می‌گوید صفحه مقصد درباره چیست.',
      howToFix: 'انکرتکست را به عبارت توصیفی تغییر دهید.',
    }));
  }

  const internalLinkSuggestions = buildInternalSuggestions(article, input.internalPages ?? []);

  // ---------- criteria ----------
  const criteria: CriterionResult[] = [
    buildResult('keyword', kwResult.score, kwResult.reasons, kwResult.fixes, keywordIssues),
    buildResult('contentQuality', quality.score, quality.repeatedSentences.length
      ? [`جملات تکراری: ${quality.repeatedSentences.length}`]
      : [`تنوع واژگان: ${(quality.vocabRichness * 100).toFixed(0)}٪`, `تنوع طول جملات: ${quality.sentenceVariety}`],
      ['پاراگراف‌های تکراری را حذف یا بازنویسی کنید'],
      quality.repeatedSentences.length > 0
        ? [makeIssue('contentQuality', {
            code: 'repeated-sentences',
            priority: 'medium',
            title: 'جملات تکراری در متن',
            description: quality.repeatedSentences.join('؛ '),
            whyItMatters: 'تکرار جمله کیفیت را پایین می‌آورد.',
            howToFix: 'جملات تکراری را ادغام یا حذف کنید.',
          })]
        : []),
    buildResult('contentStructure', structure.score,
      [`تعداد لیست: ${structure.lists}، جدول: ${structure.tables}`, `پاراگراف‌ها: ${structure.paragraphCount}`],
      ['برای بخش‌های بلند از لیست یا جدول استفاده کنید'],
      article.wordCount > 400 && structure.lists === 0 && structure.tables === 0
        ? [makeIssue('contentStructure', {
            code: 'no-scannable-blocks',
            priority: 'low',
            title: 'متن بلند بدون لیست/جدول',
            description: 'برای مقالات بیش از ۴۰۰ کلمه، بلوک‌های قابل اسکن توصیه می‌شود.',
            whyItMatters: 'لیست‌ها و جدول‌ها خوانایی و ماندگاری کاربر را بالا می‌برند.',
            howToFix: 'یک لیست یا جدول به محتوای بلند اضافه کنید.',
          })]
        : []),
    buildResult('searchIntent', intent.score,
      intent.signals.length ? intent.signals : ['سیگنال مشخصی از نیت جست‌وجو یافت نشد'],
      intent.declared && intent.aligned === false ? ['محتوا را با نیت اعلام‌شده هماهنگ کنید'] : [],
      intent.declared && intent.aligned === false
        ? [makeIssue('searchIntent', {
            code: 'intent-mismatch',
            priority: 'medium',
            title: 'عدم هماهنگی با نیت جست‌وجو',
            description: `نیت اعلام‌شده: ${intent.declared} — تشخیص سیستم: ${intent.detected}`,
            whyItMatters: 'محتوای ناهماهنگ با نیت کاربر رتبه نمی‌گیرد.',
            howToFix: 'لحن و ساختار محتوا را با نیت جست‌وجوی کلمه کلیدی هماهنگ کنید.',
          })]
        : []),
    buildResult('readability', readability.score, readability.findings,
      ['جملات طولانی را بشکنید و پاراگراف‌ها را کوتاه‌تر کنید'],
      readability.score < 50
        ? [makeIssue('readability', {
            code: 'low-readability',
            priority: 'high',
            title: 'خوانایی پایین',
            description: `امتیاز خوانایی: ${readability.score} (${readability.label})`,
            whyItMatters: 'متن دشوار باعث ترک صفحه می‌شود.',
            howToFix: 'میانگین جمله را زیر ۲۰ کلمه و پاراگراف‌ها را حداکثر ۴ جمله‌ای کنید.',
            autoFix: { type: 'ai-improve-readability', payload: {} },
          })]
        : []),
    buildResult('semantic', semantic.score,
      semantic.coveragePct === null
        ? ['رقبی برای مقایسه معنایی ارائه نشده است']
        : [`پوشش معنایی نسبت به رقبا: ${semantic.coveragePct}٪`, `${semantic.suggestedTerms.length} واژه پیشنهادی`],
      ['واژه‌های پیشنهادی را در متن بیاورید'],
      semantic.suggestedTerms.slice(0, 8).map((t) => makeIssue('semantic', {
        code: `semantic-gap-${t.term}`,
        priority: t.docs >= 3 ? 'medium' : 'low',
        title: `واژه معنایی «${t.term}» در محتوا نیست`,
        description: `در ${t.docs} رقیب استفاده شده (میانگین ${t.avgTf} بار).`,
        whyItMatters: 'پوشش معنایی کامل‌تر شانس رتبه‌بندی را بالا می‌برد.',
        howToFix: `درباره «${t.term}» در بخش مرتبط توضیح دهید.`,
      })),
    ),
    buildResult('headings', headings.score,
      [`H1: ${headings.h1Count}، H2: ${headings.h2Count}، H3: ${headings.h3Count}`, headings.keywordInHeadings ? 'کلمه کلیدی در هدینگ‌ها هست' : 'کلمه کلیدی در هدینگ‌ها نیست'],
      ['ساختار H1→H2→H3 را بدون پرش رعایت کنید'],
      headingIssues,
    ),
    buildResult('internalLinks', links.score,
      [`لینک داخلی: ${links.internalCount}`, `لینک خارجی: ${links.externalCount}`],
      ['لینک داخلی مرتبط اضافه کنید'],
      linkIssues.filter((i) => i.criterion === 'internalLinks'),
    ),
    buildResult('externalLinks', links.externalCount === 0 && article.wordCount > 600 ? Math.max(0, 100 - 40) : 100,
      [`تعداد لینک خارجی: ${links.externalCount}`],
      ['یک منبع معتبر خارجی لینک دهید'],
      links.externalCount === 0 && article.wordCount > 600
        ? [makeIssue('externalLinks', {
            code: 'no-external-links',
            priority: 'low',
            title: 'بدون لینک خارجی معتبر',
            description: 'برای مقالات بلند، ارجاع به منبع معتبر نشانه اعتماد است.',
            whyItMatters: 'ارجاع به منابع معتبر به E-E-A-T کمک می‌کند.',
            howToFix: 'یک یا دو لینک خارجی به منابع معتبر اضافه کنید.',
          })]
        : []),
    buildResult('images', images.score,
      [`تعداد تصاویر: ${images.count}`, `پوشش Alt: ${images.altCoveragePct}٪`],
      images.suggestions,
      imageIssues,
    ),
    buildResult('title', meta.score,
      [`طول عنوان: ${meta.titleLengthChars} کاراکتر`, meta.keywordInTitle ? 'کلمه کلیدی در عنوان هست' : 'کلمه کلیدی در عنوان نیست'],
      meta.suggestedTitles.length ? ['پیشنهاد عنوان‌های جایگزین را بررسی کنید'] : [],
      titleIssues,
    ),
    buildResult('metaDescription', meta.score,
      [`طول توضیحات متا: ${meta.metaLengthChars} کاراکتر`],
      ['توضیحات متا را در بازه ۱۲۰–۱۶۰ کاراکتر تنظیم کنید'],
      metaIssues,
    ),
    buildResult('completeness', completeness.score,
      [`حجم: ${completeness.wordCount} از هدف ${completeness.targetWordCount} کلمه (${completeness.coveragePct}٪)`,
        `مقدمه: ${completeness.hasIntro ? '✔' : '✖'} | نتیجه‌گیری: ${completeness.hasConclusion ? '✔' : '✖'} | FAQ: ${completeness.hasFaq ? '✔' : '✖'}`],
      ['بخش‌های ناقص (مقدمه/نتیجه‌گیری/FAQ) را تکمیل کنید'],
      completeness.coveragePct < 75
        ? [makeIssue('completeness', {
            code: 'below-target-length',
            priority: completeness.coveragePct < 50 ? 'high' : 'medium',
            title: 'حجم مقاله کمتر از هدف است',
            description: `${completeness.wordCount} کلمه در مقابل هدف ${completeness.targetWordCount} (${completeness.coveragePct}٪)`,
            whyItMatters: 'مقایسه با رقبا نشان می‌دهد پوشش موضوع ناکامل است.',
            howToFix: 'بخش‌های ناقص را بر اساس موضوعات جاافتاده گسترش دهید.',
            autoFix: { type: 'ai-expand-content', payload: {} },
          })]
        : []),
  ];

  const { score, grade } = computeTotalScore(criteria);
  const allIssues = [...criteria.flatMap((c) => c.issues)];

  return {
    lang,
    wordCount: article.wordCount,
    charCount: article.charCount,
    readingTimeMinutes: Math.max(1, Math.round(article.wordCount / 220)),
    score,
    grade,
    criteria,
    issues: allIssues,
    keywords,
    readability,
    meta,
    headings,
    images: images,
    links,
    semantic,
    quality,
    structure,
    intent,
    completeness,
    internalLinkSuggestions,
    generatedAt: new Date().toISOString(),
  };
}

function buildInternalSuggestions(
  article: ParsedArticleLike,
  pages: InternalPageHint[],
): { url: string; title: string; reason: string }[] {
  if (pages.length === 0) return [];
  const articleTerms = new Set(tokenize(normalizePersian(article.text)));
  const out: { url: string; title: string; reason: string }[] = [];
  for (const p of pages) {
    const terms = new Set(tokenize(normalizePersian(`${p.title} ${(p.keywords ?? []).join(' ')}`)));
    const overlap = [...terms].filter((t) => articleTerms.has(t) && t.length >= 3);
    if (overlap.length >= 2) {
      out.push({ url: p.url, title: p.title, reason: `اشتراک موضوعی: ${overlap.slice(0, 3).join('، ')}` });
    }
    if (out.length >= 8) break;
  }
  return out;
}

type ParsedArticleLike = ReturnType<typeof parseArticle>;
