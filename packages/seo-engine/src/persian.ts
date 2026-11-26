/**
 * Persian (and English) text utilities: normalization, tokenization,
 * stopwords, transition words, power words, keyword matching variants.
 * No external dependencies — pure deterministic functions.
 */
import type { Lang } from './types.js';

export const ZWNJ = '\u200c';

/** Normalize Persian/Arabic characters and digits for matching purposes. */
export function normalizePersian(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670]/g, '') // diacritics
    .replace(/\u0640/g, '') // tatweel
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/ھ/g, 'ه')
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30))
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 0x30))
    .replace(/\u00A0/g, ' ')
    .toLowerCase();
}

/** Persian stopwords (function words that carry no topical signal). */
export const PERSIAN_STOPWORDS = new Set<string>([
  'و','در','به','از','که','این','را','با','برای','آن','یک','ها','های','است','هستند','بود','بودند','شد','شده','می','نیز','یا','اما','اگر','پس','تا','بر','هر','همه','برخی','چون','چه','چرا','کدام','وقتی','هنگامی','میان','روی','زیر','بالا','پایین','باید','شاید','خیلی','بسیار','کمی','فقط','حتی','البته','یعنی','مثل','مانند','هم','خود','خودش','ما','شما','او','آنها','ایشان','من','تو','ای','بله','خیر','نه','دارد','دارند','دهد','بودن','شدن','شوند','دهد','باشد','باشند','بوده','شده_است','می‌شود','می‌کنند','می‌دهد','بین','داخل','خارج','سمت','نزد','طبق','مطابق','درباره','قرار','بدون','علاوه',' ضمن','لذا','بنابراین','سپس','اکنون','الان','امروز','دیروز','فردا','همیشه','هرگز','گاهی','اگرچه','هرچند','بااین‌حال','بنابراین','بناب','چنانچه','مگر','مگراینکه','وقتیکه','آنگاه','پس‌از','قبل','بعد','سپس','اول','دوم','سوم','چهارم','پنجم','نخست','نخستین','آخر','آخرین','چیز','چیزی','کسی','کسانی','جای','جایی','جا','طور','گونه','نوع','نوعی','مورد','موارد','برابر','طرف','طرفین','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','صد','هزار','میلیون','تاکنون','تاانتهای','راکه','همان','همین','همینطور','همینطور','دیگر','دیگری','چنین','چنان','آنچه','همچه','هرچه','هرکس','کجا','کجایی','کِی','کی','چند','چندین','چنده','مه','روزی','شبی','صبح','عصر','شام','ناهار','نه','آری','اوه','اوهوم','باهه','خب','خوب','علیحساب','ولی','یااینکه','تاجاییکه','هیچ','هیچ‌کدام','هیچ‌کس','نبود','نیست','نیستند','نمی','نخواهد','خواهد','خواهند','کنند','کند','کنم','کنیم','کنید','کرده','کرد','کردند','بگیرد','بگیرند','گیرد','داده','داد','دادند','بدهد','دادن','داشته','داشت','داشتند','داشتن','توان','توانند','توانم','می‌توان','نمی‌توان','می‌توانند','است که','بودکه','هست_که','برای_اینکه','ازآن','از_آنها','با_این','در_حالی','از_طرفی','به_عنوان','نظیر','فقط','عملاً','اصلاً','اولاً','دوم اینکه','ضمناً','فعلاً','شاید هم','همین‌طور',
].map((w) => w.replace(/\s+/g, '')));

export const ENGLISH_STOPWORDS = new Set<string>([
  'a','an','the','and','or','but','if','then','else','when','while','of','to','in','on','at','by','for','with','about','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','can','could','should','shall','may','might','must','this','that','these','those','it','its','they','them','their','you','your','we','our','i','me','my','he','she','his','her','not','no','yes','so','than','too','very','just','also','only','more','most','some','any','all','each','both','few','other','such','own','same','s','t','don','now','here','there','where','why','how','what','which','who','whom',
]);

/** Persian discourse-transition words used in the readability analysis. */
export const TRANSITIONS_FA = [
  'اما','بنابراین','همچنین','سپس','در نتیجه','به عبارت دیگر','علاوه بر این','برای مثال','در واقع','از طرف دیگر','در ادامه','ابتدا','اول','نخست','در نهایت','در پایان','به طور کلی','به‌طور کلی','به عبارتی','نکته مهم','نکته قابل توجه','توجه داشته باشید','بر اساس','بر همین اساس','از این رو','در همین راستا','در کنار این','علاوه بر آن','همچنین در','مانند','برای نمونه','نمونه آن','به عنوان مثال','مثلا','مثلاً','یعنی','در حقیقت','خلاصه اینکه','جمع‌بندی','نتیجه اینکه','با این حال','بااین‌حال','با وجود این','در مقابل','در عوض','برعکس','هیچ‌گاه','مطمئناً','قطعاً','توصیه می‌شود','پیشنهاد می‌شود','مهم است','توجه کنید','زیرا','چراکه','برای اینکه','به همین دلیل','به دلیل این','در پی','در راستای',
];

export const TRANSITIONS_EN = [
  'however','therefore','moreover','furthermore','in addition','for example','for instance','in conclusion','on the other hand','first','second','finally','in summary','as a result','consequently','nevertheless','meanwhile','instead','thus','hence','accordingly','specifically','in particular','overall','in short',
];

/** Persian power words that improve title/meta click-through (heuristic). */
export const POWER_WORDS_FA = [
  'بهترین','راهنما','آموزش','رایگان','کامل','جامع','بررسی','مقایسه','ترفند','نکات','مرحله','گام‌به‌گام','ساده','سریع','حرفه‌ای','تخصصی','اصول','قوانین','خطاهای رایج','اشتباهات','مخفی','لازم','ضروری','معرفی','جدید','به‌روز','۲۰۲۶','2026','۲۰۲۵','2025','لیست','مجموعه','پکیج','امتیاز','دلار','پول','درآمد','سود','پیشنهاد','شگفت‌انگیز','فوق‌العاده',
];

/** Generic anchor texts considered low-quality for linking. */
export const GENERIC_ANCHORS = [
  'اینجا','این‌جا','اینجا','این صفحه','کلیک کنید','اینجا کلیک کنید','دانلود','لینک','بیشتر','ادامه','این لینک','this page','click here','read more','more','link','download','here',
];

export function stopwordSet(lang: Lang): Set<string> {
  return lang === 'fa' ? PERSIAN_STOPWORDS : ENGLISH_STOPWORDS;
}

export function transitionList(lang: Lang): string[] {
  return lang === 'fa' ? TRANSITIONS_FA : TRANSITIONS_EN;
}

/** Split text into sentences using Persian-aware terminators. */
export function sentencesOf(text: string): string[] {
  return text
    .replace(/([.!؟?…؛;])\s*/g, '$1\n')
    .split(/[\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize text into words. ZWNJ-joined forms stay as single tokens. */
export function tokenize(text: string): string[] {
  return text
    .split(/[^\p{L}\p{N}\u200c]+/u)
    .map((t) => t.replace(/^\u200c+|\u200c+$/g, ''))
    .filter((t) => t.length > 0 && t !== ZWNJ);
}

/** Count words for Persian text (ZWNJ-joined = one word). */
export function countWords(text: string): number {
  return tokenize(text).length;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Keyword matching variants (handles ZWNJ differences like «می‌روم/می روم/میروم»).
 */
export function keywordVariants(keyword: string): string[] {
  const n = normalizePersian(keyword).trim();
  const set = new Set<string>();
  if (n) set.add(n);
  set.add(n.split(ZWNJ).join(' '));
  set.add(n.split(ZWNJ).join(''));
  return [...set].filter(Boolean);
}

/**
 * Count occurrences of a keyword with word boundaries (all variants,
 * de-duplicated by match position). The text is canonicalized (ZWNJ→space)
 * so «قهوه‌ترک» (ZWNJ-joined) also matches the keyword «قهوه ترک».
 */
export function countKeywordOccurrences(normalizedText: string, keyword: string): { count: number; firstIndex: number } {
  const canonical = normalizedText.split(ZWNJ).join(' ');
  const positions = new Set<number>();
  let firstIndex = -1;
  for (const variant of keywordVariants(keyword)) {
    const v = variant.split(ZWNJ).join(' ');
    if (!v) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(v)}(?![\\p{L}\\p{N}])`, 'gu');
    for (const m of canonical.matchAll(re)) {
      const idx = m.index ?? 0;
      positions.add(idx);
      if (firstIndex === -1 || idx < firstIndex) firstIndex = idx;
    }
  }
  return { count: positions.size, firstIndex };
}

export function containsKeyword(normalizedText: string, keyword: string): boolean {
  return countKeywordOccurrences(normalizedText, keyword).count > 0;
}

/** Build a normalized search space from a raw string (for matching). */
export function normalized(text: string): string {
  return normalizePersian(text);
}
