import type { CatalogProduct } from '../types';
import type { EnhanceResponse } from './api';

/**
 * Browser-direct Gemini call for the BYOK path. The user's key goes straight
 * from their browser to Google (via the x-goog-api-key header) and never
 * touches our server. Used only when no server-side GEMINI_API_KEY is set.
 *
 * NOTE: the prompt below is intentionally identical to the server copy in
 * api/enhance.ts — the two paths must behave the same. Keep them in sync.
 */
const HOST = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-flash-lite-latest';

function buildPrompt(storeName: string, list: string): string {
  return `You are an editor preparing a premium PRINTED product catalog for "${storeName || 'this store'}".

Shopify data is messy: titles are often ALL-CAPS, carry trailing SKUs / model
codes / vendor names / size or collection words, or contain data that belongs in
another field entirely. Descriptions sometimes don't match the product. Your job
is to make each entry correct AND well-written — do not blindly trust the input.

For EACH product below, return:
1. "name": a clean, correct, human-readable product title. Fix ALL-CAPS, remove
   trailing SKUs/model codes, vendor names, size/variant noise, and store or
   collection names. Fix obvious typos. Keep it ACCURATE to what the product
   actually is — never invent facts. If the title is already good, return it as-is.
2. "desc": one tight catalog blurb, 1-2 sentences (max ~240 chars). Sell the
   benefit, keep the real details, no fluff, no emojis, no ALL-CAPS, no exclamation marks.
3. "flag": a short (max ~90 chars) plain-English warning IF something looks wrong
   or inconsistent — e.g. the title looks like a SKU or holds data that belongs in
   another field, the description clearly doesn't match the title, the fields look
   like placeholders/garbage, or key info (like what the product even is) is
   missing. If everything looks fine and consistent, return "" (empty string).

Also write ONE cover tagline for the whole catalog (max 60 chars).

Return ONLY JSON of this exact shape:
{"tagline":"...","products":[{"id":"<same id>","name":"...","desc":"...","flag":"..."}]}

Products:
${list}`;
}

export async function enhanceDirect(
  apiKey: string,
  storeName: string,
  products: CatalogProduct[],
): Promise<EnhanceResponse> {
  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    desc: p.rawDesc,
    specs: p.specs.map((s) => `${s.key}: ${s.val}`).join(' · '),
  }));
  if (items.length === 0) return { enabled: false, reason: 'no-products' };

  const list = items
    .map((p, i) => {
      const specs = p.specs ? `\n   fields: ${p.specs.slice(0, 300)}` : '';
      return `${i + 1}. id="${p.id}"\n   title: ${p.name}${specs}\n   description: ${(p.desc || '(none)').slice(0, 600)}`;
    })
    .join('\n');

  try {
    const r = await fetch(`${HOST}/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(storeName, list) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(28000),
    });
    const data = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!r.ok) return { enabled: false, reason: data?.error?.message || `gemini-${r.status}` };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as {
      tagline?: string;
      products?: { id: string; name?: string; desc?: string; flag?: string }[];
    };
    return {
      enabled: true,
      tagline: parsed.tagline ?? '',
      products: Array.isArray(parsed.products) ? parsed.products : [],
    };
  } catch (e) {
    return { enabled: false, reason: (e as Error).message };
  }
}
