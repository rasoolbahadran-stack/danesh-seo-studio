import { describe, expect, it } from 'vitest';
import { analyzeEEAT, compareTexts, simhash64, detectCannibalization, buildKeywordMapping } from './index.js';

const HTML_WITH_EEAT = `
<h1>بررسی کامل قهوه‌سازهای برقی</h1>
<p>نویسنده: سارا محمدی. ما ۱۲ مدل قهوه‌ساز را به مدت سه ماه بررسی کردیم و تست کردیم.</p>
<h2>روش تست</h2>
<p>در تست‌ها ۶۵ درصد از مدل‌ها کف کامل تولید کردند. آخرین به‌روزرسانی: ۲۰۲۶.</p>
<a href="https://en.wikipedia.org/wiki/Coffee_maker">منبع ویکی‌پدیا</a>
<a href="https://www.gov.ir/standards">استاندارد ملی</a>
<p>بر اساس تجربه ما، دمای آب مهم‌ترین عامل است.</p>
`;

const HTML_BARE = '<h1>عنوان</h1><p>متن ساده بدون هیچ سیگنال خاص.</p>';

describe('EEAT indicators', () => {
  it('detects author, experience, statistics, freshness and credible sources', () => {
    const r = analyzeEEAT(HTML_WITH_EEAT);
    const byKey = Object.fromEntries(r.indicators.map((i) => [i.key, i]));
    expect(byKey.author.present).toBe(true);
    expect(byKey.experience.present).toBe(true);
    expect(byKey.statistics.present).toBe(true);
    expect(byKey.freshness.present).toBe(true);
    expect(byKey['credible-sources'].present).toBe(true);
    expect(r.eeatIndex).toBeGreaterThanOrEqual(70);
    expect(r.note).toContain('نه امتیاز رسمی گوگل');
  });

  it('reports low indicators for bare content', () => {
    const r = analyzeEEAT(HTML_BARE);
    expect(r.eeatIndex).toBeLessThanOrEqual(40);
  });
});

describe('similarity / duplicates', () => {
  const A = 'قهوه ترک با پودر نرم دم می‌شود و کف کامل دارد. دما و شعله مهم است. جزوه باید تمیز باشد. آب سرد استفاده می‌کنیم.';
  const A2 = 'قهوه ترک با پودر نرم دم می‌شود و کف کامل دارد. دما و شعله مهم است. جزوه باید تمیز باشد. آب سرد استفاده می‌کنیم.';
  const B = 'طراحی رابط کاربری به تجربه کاربر وابسته است. رنگ‌ها و تایپوگرافی نقش دارند. تست کاربردپذیری لازم است. نمونه اولیه بسازیم.';

  it('marks identical texts as near-duplicate (stable simhash)', () => {
    expect(simhash64(A)).toBe(simhash64(A2));
    const r = compareTexts(A, A2);
    expect(r.verdict).toBe('near-duplicate');
    expect(r.jaccardShingles).toBeGreaterThan(0.8);
  });

  it('marks unrelated texts as different', () => {
    expect(compareTexts(A, B).verdict).toBe('different');
  });
});

describe('keyword cannibalization & mapping', () => {
  const articles = [
    { id: 'a1', title: 'بهترین قهوه ترک', primaryKeyword: 'قهوه ترک', wordCount: 900 },
    { id: 'a2', title: 'راهنمای قهوه ترک', primaryKeyword: 'قهوه ترک', wordCount: 700 },
    { id: 'a3', title: 'آموزش لاته آرت', primaryKeyword: 'لاته آرت', wordCount: 800 },
  ];

  it('detects identical primary keywords as a high-severity pair', () => {
    const r = detectCannibalization(articles);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0].severity).toBe('high');
    expect(r.pairs[0].articles[0].id).toBe('a1');
    expect(r.pairs[0].recommendations.length).toBeGreaterThan(0);
  });

  it('mapping prevents the same page from owning conflicting keywords', () => {
    const m = buildKeywordMapping(['قهوه ترک', 'آموزش قهوه ترک', 'لاته آرت'], articles);
    expect(m.entries[0].pageId).toBe('a1');
    expect(m.entries[1].conflict).toBe(true);
    expect(m.entries[2].pageId).toBe('a3');
    expect(m.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('mapping marks unmatched keywords as needing new content', () => {
    const m = buildKeywordMapping(['کفش ورزشی نایک'], articles);
    expect(m.entries[0].pageId).toBeNull();
    expect(m.entries[0].note).toContain('محتوای جدید');
  });
});
