import type {
  CatalogProduct,
  CatalogPhoto,
  ScrapeResult,
  ShopifyProduct,
  SpecRow,
} from '../types';

/**
 * Longest common suffix across every product title — the "- <Vehicle>" style
 * shared tail many stores append. Ported from the blueprint's
 * detect_suffix_len(): tolerant of mixed dash characters, and only trusted
 * when the shared tail is at least 6 real (non dash/space) characters, so a
 * store with no such convention keeps its titles verbatim.
 */
export function detectSuffixLen(titles: string[]): number {
  if (titles.length < 2) return 0;
  const normed = titles.map((t) => t.replace(/[‐-―]/g, '-'));
  const reversed = normed.map((t) => [...t].reverse().join(''));
  let prefix = reversed[0];
  for (const s of reversed.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  const common = [...prefix].reverse().join('');
  return common.replace(/[ -]/g, '').length >= 6 ? common.length : 0;
}

/** Trailing "(...)" badge on a title, e.g. "Bumper (ADAS Compatible)". */
function extractTag(name: string): { name: string; tag: string | null } {
  const m = name.match(/\s*\(([^()]+)\)\s*$/);
  if (m) return { name: name.slice(0, m.index).trim(), tag: m[1].trim().toUpperCase() };
  return { name: name.trim(), tag: null };
}

export function formatPrice(amount: number, symbol: string, decimals: boolean): string {
  const isWhole = amount === Math.round(amount);
  const opts: Intl.NumberFormatOptions =
    decimals && !isWhole
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 };
  return `${symbol}${amount.toLocaleString('en-US', opts)}`;
}

/** HTML body_html -> readable plain text, mirroring the blueprint's Stripper. */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    let out = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toLowerCase();
        if (tag === 'li') out += '\n• ';
        else if (['p', 'div', 'ul', 'ol', 'br'].includes(tag)) out += '\n';
        out += walk(child);
        if (['p', 'div', 'ul', 'ol'].includes(tag)) out += '\n';
      }
    });
    return out;
  };
  return walk(doc.body)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

/** Collapse to one paragraph, then clip on a sentence boundary near `max`. */
export function flattenAndClip(text: string, max = 360): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…').trim();
}

function buildSpecs(p: ShopifyProduct, shopName: string): SpecRow[] {
  const rows: SpecRow[] = [];
  const singleVariant = p.variants.length === 1 && p.variants[0].title === 'Default Title';

  if (!singleVariant) {
    for (const opt of p.options ?? []) {
      if (!opt.name || opt.name === 'Title') continue;
      const values = [...new Set(opt.values.filter(Boolean))];
      if (values.length) rows.push({ key: opt.name, val: values.join(' · '), sub: null });
    }
  }
  if (p.product_type) rows.push({ key: 'Type', val: p.product_type, sub: null });
  if (p.vendor && p.vendor.toLowerCase() !== shopName.toLowerCase())
    rows.push({ key: 'Brand', val: p.vendor, sub: null });

  const skus = [...new Set(p.variants.map((v) => v.sku).filter((s): s is string => !!s))];
  if (skus.length) rows.push({ key: 'SKU', val: skus.length > 2 ? `${skus[0]} +${skus.length - 1}` : skus.join(', '), sub: null });

  const anyAvailable = p.variants.some((v) => v.available);
  rows.push({ key: 'Availability', val: anyAvailable ? 'In Stock' : 'Sold Out', sub: null });

  return rows.slice(0, 6);
}

function chooseFit(img: { width: number; height: number }): 'cover' | 'contain' {
  // Near-square studio shots are usually product-on-white → letterbox them so
  // nothing gets cropped. Wide/tall lifestyle shots fill (cover). A rough
  // heuristic the user can override per photo in the Curate step.
  if (!img.width || !img.height) return 'cover';
  const ratio = img.width / img.height;
  return ratio > 0.92 && ratio < 1.08 ? 'contain' : 'cover';
}

export interface TransformOpts {
  currencySymbol: string;
  currencyDecimals: boolean;
  taxNote: string;
}

/** Re-derive the formatted price + sub-line for a product (used when the user
 * changes currency/tax settings in the Design step, without re-scraping). */
export function priceStrings(
  priceValue: number,
  hasRange: boolean,
  opts: TransformOpts,
): { price: string; priceSub: string } {
  const price = formatPrice(priceValue, opts.currencySymbol, opts.currencyDecimals);
  const priceSub = hasRange ? (opts.taxNote ? `From · ${opts.taxNote}` : 'From') : opts.taxNote;
  return { price, priceSub };
}

export function transformProducts(scrape: ScrapeResult, opts: TransformOpts): CatalogProduct[] {
  const titles = scrape.products.map((p) => p.title);
  const suffixLen = detectSuffixLen(titles);

  return scrape.products
    .filter((p) => p.images.length > 0) // no photos = nothing to show in a catalog
    .map((p): CatalogProduct => {
      const stripped = suffixLen ? p.title.slice(0, -suffixLen).trim() : p.title.trim();
      const { name, tag } = extractTag(stripped);

      const prices = p.variants.map((v) => parseFloat(v.price)).filter((n) => !isNaN(n));
      const min = prices.length ? Math.min(...prices) : 0;
      const hasRange = new Set(prices).size > 1;
      const { price, priceSub } = priceStrings(min, hasRange, opts);

      const rawDesc = htmlToText(p.body_html);
      const images: CatalogPhoto[] = p.images.slice(0, 3).map((img) => ({
        src: img.src,
        fit: chooseFit(img),
      }));
      const allImages = p.images.map((img) => img.src);

      return {
        id: p.handle,
        name,
        tag,
        fullTitle: p.title,
        url: `${scrape.origin}/products/${p.handle}`,
        priceValue: min,
        hasRange,
        price,
        priceSub,
        priceOverridden: false,
        desc: flattenAndClip(rawDesc),
        rawDesc,
        specs: buildSpecs(p, scrape.shopName),
        note: null,
        images,
        allImages,
        layout: null,
        mainIndex: 0,
        included: true,
      };
    });
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', CAD: '$', AUD: '$', NZD: '$', SGD: '$',
  EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥',
  AED: 'AED ', SAR: 'SAR ', ZAR: 'R', BRL: 'R$', MXN: '$',
};

export function symbolForCurrency(code: string | null): string {
  if (!code) return '$';
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code} `;
}
