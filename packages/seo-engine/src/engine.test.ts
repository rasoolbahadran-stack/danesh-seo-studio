import { describe, expect, it } from 'vitest';
import {
  analyzeArticle, containsKeyword, countKeywordOccurrences, normalizePersian,
  parseArticle, tokenize, DEFAULT_WEIGHTS, computeTotalScore, statusOf,
  buildSuggestedTitles,
} from './index.js';

const GOOD_ARTICLE = `
<h1>آموزش دم کردن قهوه ترک: راهنمای کامل</h1>
<p>قهوه ترک یکی از قدیمی‌ترین روش‌های دم کردن قهوه در جهان است. در این راهنما مرحله به مرحله یاد می‌گیرید که چگونه یک فنجان قهوه ترک عالی درست کنید.</p>
<h2>قهوه ترک چیست؟</h2>
<p>قهوه ترک روشی است که در آن پودر بسیار نرم قهوه مستقیماً در آب جوش دم می‌شود و بدون فیلتر سرو می‌گردد. این روش در ترکیه، ایران و کشورهای بالکان رایج است.</p>
<h2>وسایل مورد نیاز</h2>
<p>برای دم کردن قهوه ترک به کتری مخصوصی به نام جزوه و پودر قهوه بسیار نرم نیاز دارید.</p>
<ul><li>پودر قهوه ترک بسیار نرم</li><li>آب سرد و تازه</li><li>شکر در صورت تمایل</li></ul>
<h2>مراحل دم کردن</h2>
<h3>انتخاب قهوه</h3>
<p>بهترین قهوه برای این روش، ترکیبات عربیکا با برشته‌کاری متوسط است. پودر باید به اندازه آرد بسیار نرم باشد.</p>
<h3>دم کردن</h3>
<p>آب را در جزوه گرم کنید تا نزدیک جوش برسد، سپس پودر قهوه و شکر را اضافه کنید و آرام هم بزنید. کف تشکیل‌شده را با قاشق بردارید و در فنجان بریزید.</p>
<p>وقتی کف بالا آمد، شعله را خاموش کنید تا قهوه سر ریز نشود. سپس اجازه دهید دانه‌ها ته‌نشین شوند.</p>
<img src="/images/IMG_2043.jpg" width="800" height="600">
<img src="/images/turk-coffee-cup.jpg" alt="فنجان قهوه ترک با کف روی میز" loading="lazy">
<h2>نتیجه‌گیری</h2>
<p>دم کردن قهوه ترک مهارتی است که با تمرین بهتر می‌شود؛ با تنظیم گرما و تمرین، هر بار فنجانی با کف کامل خواهید داشت.</p>
<h2>سوالات متداول</h2>
<p>آیا می‌توان از قهوه آسیاب‌شده معمولی استفاده کرد؟ خیر، پودر بسیار نرم لازم است.</p>
<a href="/latte-art">آموزش لاته آرت</a>
<a href="https://fa.wikipedia.org/wiki/قهوه">ویکی‌پدیای فارسی درباره قهوه</a>
<a href="https://example-shop.com/coffee">اینجا</a>
`;

const HTML_NO_META = `
<h1>عنوان آزمایشی</h1>
<p>${'متن کوتاهی درباره سئو و تولید محتوا. '.repeat(20)}</p>
`;

describe('persian text utilities', () => {
  it('normalizes Arabic characters and digits', () => {
    const n = normalizePersian('كتاب يک ۱۲٣');
    expect(n).toContain('ی');
    expect(n).toContain('ک');
    expect(n).toContain('12');
  });

  it('tokenizes ZWNJ-joined words as one word', () => {
    expect(tokenize(normalizePersian('می‌روم به بازار'))).toHaveLength(3);
  });

  it('matches keyword across ZWNJ variants', () => {
    const text = normalizePersian('می‌خواهم قهوه ترک دم کنم. می خواهم قهوه‌ترک بخورم');
    expect(countKeywordOccurrences(text, 'قهوه ترک').count).toBeGreaterThanOrEqual(2);
    expect(containsKeyword(text, 'قهوه ترک')).toBe(true);
  });
});

describe('parseArticle', () => {
  const parsed = parseArticle(GOOD_ARTICLE, { title: 'آموزش دم کردن قهوه ترک: راهنمای کامل', metaDescription: 'راهنمای کامل دم کردن قهوه ترک', lang: 'fa' });

  it('extracts headings in order', () => {
    expect(parsed.headings.map((h) => h.level)).toEqual([1, 2, 2, 2, 3, 3, 2, 2]);
    expect(parsed.headings[0].text).toContain('قهوه ترک');
  });

  it('extracts images with attributes', () => {
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[0].alt).toBe('');
    expect(parsed.images[1].alt).not.toBe('');
    expect(parsed.images[1].lazy).toBe(true);
    expect(parsed.images[0].filename).toBe('IMG_2043.jpg');
  });

  it('classifies links internal/external', () => {
    expect(parsed.links).toHaveLength(3);
    expect(parsed.links[0].internal).toBe(true);
    expect(parsed.links[1].internal).toBe(false);
    expect(parsed.links[2].anchorText).toBe('اینجا');
  });

  it('counts words and lists/tables', () => {
    expect(parsed.wordCount).toBeGreaterThan(100);
    expect(parsed.lists).toBe(1);
  });
});

describe('analyzeArticle — full report', () => {
  const report = analyzeArticle({
    html: GOOD_ARTICLE,
    primaryKeyword: 'قهوه ترک',
    secondaryKeywords: ['جزوه', 'دم کردن قهوه'],
    lang: 'fa',
    title: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
    metaDescription: 'راهنمای کامل و مرحله‌به‌مرحله دم کردن قهوه ترک؛ از انتخاب پودر تا سرو.',
    intent: 'informational',
  });

  it('computes a deterministic total score as a weighted average', () => {
    const expected = Math.round(
      report.criteria.reduce((a, c) => a + c.score * c.weight, 0)
      / report.criteria.reduce((a, c) => a + c.weight, 0),
    );
    expect(report.score).toBe(expected);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('has all 13 criteria with labels and statuses', () => {
    expect(report.criteria).toHaveLength(13);
    const keys = report.criteria.map((c) => c.key).sort();
    expect(keys).toEqual([...keys].sort()); // deterministic order
    for (const c of report.criteria) {
      expect(c.weight).toBe(DEFAULT_WEIGHTS[c.key]);
      expect(['green', 'orange', 'red']).toContain(c.status);
      expect(statusOf(c.score)).toBe(c.status);
    }
  });

  it('primary keyword stats are consistent with the text', () => {
    expect(report.keywords.primary.occurrences).toBeGreaterThanOrEqual(3);
    const density = (report.keywords.primary.occurrences / report.wordCount) * 100;
    expect(Math.abs(density - report.keywords.primary.densityPct)).toBeLessThan(0.05);
    expect(report.keywords.primary.inTitle).toBe(true);
    expect(report.keywords.primary.inMeta).toBe(true);
    expect(report.keywords.primary.stuffed).toBe(false);
  });

  it('flags the generic anchor and missing alt', () => {
    const ids = report.issues.map((i) => i.id);
    expect(ids).toContain('internalLinks:generic-anchor');
    expect(ids).toContain('images:missing-alt');
  });

  it('readability report has real Persian metrics', () => {
    expect(report.readability.sentences).toBeGreaterThan(5);
    expect(report.readability.avgWordsPerSentence).toBeGreaterThan(5);
    expect(report.readability.score).toBeGreaterThan(0);
    expect(report.readability.label).toBeTruthy();
  });

  it('generates meta suggestions and google preview', () => {
    expect(report.meta.suggestedTitles.length).toBeGreaterThanOrEqual(4);
    expect(report.meta.googlePreview.title).toContain('قهوه ترک');
    expect(buildSuggestedTitles('قهوه ترک')).toHaveLength(5);
  });

  it('is deterministic: same input → identical score & issues', () => {
    const r2 = analyzeArticle({
      html: GOOD_ARTICLE,
      primaryKeyword: 'قهوه ترک',
      secondaryKeywords: ['جزوه', 'دم کردن قهوه'],
      lang: 'fa',
      title: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
      metaDescription: 'راهنمای کامل و مرحله‌به‌مرحله دم کردن قهوه ترک؛ از انتخاب پودر تا سرو.',
      intent: 'informational',
    });
    expect(r2.score).toBe(report.score);
    expect(r2.issues.map((i) => i.id)).toEqual(report.issues.map((i) => i.id));
  });
});

describe('analyzeArticle — problem detection', () => {
  it('detects keyword stuffing from real density', () => {
    const stuffed = `<h1>قهوه ترک</h1><p>${'قهوه ترک '.repeat(15)}کیفیت بالا دارد.</p>`;
    const r = analyzeArticle({ html: stuffed, primaryKeyword: 'قهوه ترک', lang: 'fa' });
    expect(r.keywords.primary.stuffed).toBe(true);
    expect(r.keywords.primary.densityPct).toBeGreaterThan(3.5);
    expect(r.issues.some((i) => i.id === 'keyword:keyword-stuffing')).toBe(true);
  });

  it('flags missing H1 as critical and missing meta', () => {
    const noH1 = '<h2>سرصفحه</h2><p>' + 'متن آزمایشی برای سئو. '.repeat(30) + '</p>';
    const r = analyzeArticle({ html: noH1, primaryKeyword: 'سئو', lang: 'fa' });
    expect(r.issues.some((i) => i.id === 'headings:h1-missing' && i.priority === 'critical')).toBe(true);
    expect(r.issues.some((i) => i.id === 'metaDescription:meta-missing')).toBe(true);
  });

  it('detects keyword absence in content', () => {
    const r = analyzeArticle({ html: HTML_NO_META, primaryKeyword: 'قهوه ترک', lang: 'fa' });
    expect(r.issues.some((i) => i.id === 'keyword:keyword-missing')).toBe(true);
    expect(r.keywords.primary.occurrences).toBe(0);
  });
});

describe('semantic coverage vs competitors', () => {
  const comp1 = {
    url: 'https://competitor1.ir/coffee',
    title: 'قهوه ترک',
    text: 'قهوه ترک با جزوه دم می‌شود و کف قهوه ترک اهمیت زیادی دارد. میزان رطوبت پودر، نوع برشته‌کاری و آب سرد بر کیفیت نهایی اثر می‌گذارد. زمان دم کردن و شعله ملایم باید دقیق کنترل شود. برای انتخاب آب و پودر، آب باید تازه و بدون بو باشد و پودر باید بسیار نرم باشد. کنترل شعله و کف به تمرین نیاز دارد؛ اگر شعله زیاد باشد قهوه سر ریز می‌شود و کف از بین می‌رود. در نهایت اجازه دهید دانه‌ها ته‌نشین شوند تا فنجان شفاف و تمیز سرو شود. تجربه نشان می‌دهد نسبت یک قاشق چای‌خوری برای هر فنجان مناسب است و شکر باید در ابتدای دم کردن اضافه شود نه در پایان.',
    wordCount: 120,
    headings: [{ level: 2, text: 'انتخاب آب و پودر', index: 0 }, { level: 2, text: 'کنترل شعله و کف', index: 1 }],
  };
  const comp2 = {
    url: 'https://competitor2.com/turkish-coffee',
    title: 'Turkish Coffee',
    text: 'برای قهوه ترک، آب سرد و پودر نرم لازم است تا کف خوبی تشکیل شود. کف را با قاشق برمی‌داریم و در فنجان می‌ریزیم. برشته‌کاری متوسط بهترین نتیجه را می‌دهد و پودر باید تازه آسیاب شده باشد. شعله باید ملایم باشد تا قهوه آرام بالا بیاید و سر ریز نشود. انتخاب آب و پودر مهم‌ترین مرحله است؛ آب فیلترشده و پودر عربیکا نرم بهترین کف را می‌دهد. زمان دم کردن حدود سه دقیقه است و در این مدت نباید قهوه را هم بزنیم. پس از دم کردن، دو دقیقه صبر کنید تا دانه‌ها ته‌نشین شوند و سپس سرو کنید.',
    wordCount: 130,
    headings: [{ level: 2, text: 'انتخاب آب و پودر', index: 0 }],
  };

  it('suggests competitor terms missing from the article and computes coverage', () => {
    const r = analyzeArticle({
      html: GOOD_ARTICLE, primaryKeyword: 'قهوه ترک', lang: 'fa',
      competitors: [comp1, comp2],
    });
    expect(r.semantic.competitorCount).toBe(2);
    expect(r.semantic.coveragePct).not.toBeNull();
    expect(r.semantic.suggestedTerms.length).toBeGreaterThan(0);
    expect(r.semantic.suggestedTerms[0].docs).toBeGreaterThanOrEqual(2);
  });

  it('stays neutral when no competitors are provided', () => {
    const r = analyzeArticle({ html: GOOD_ARTICLE, primaryKeyword: 'قهوه ترک', lang: 'fa' });
    expect(r.semantic.coveragePct).toBeNull();
    expect(r.semantic.score).toBe(70);
  });
});
