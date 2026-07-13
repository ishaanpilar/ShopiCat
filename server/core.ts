/**
 * Framework-agnostic backend core. Consumed by:
 *   - api/scrape.ts, api/enhance.ts  (Vercel serverless functions in prod)
 *   - vite.config.ts dev bridge      (local `npm run dev`)
 *
 * Each handler takes a parsed JSON body + the process env and returns a plain
 * { status, body } object, so the adapters stay trivial.
 */

type Handler = (
  body: unknown,
  env: Record<string, string | undefined>,
) => Promise<{ status: number; body: unknown }>;

// ------------------------------------------------------------------ scrape ---

/**
 * Turn whatever URL the user pasted into the public Shopify products.json
 * endpoint. Accepts a bare domain, a full store URL, or a collection URL.
 *   allbirds.com                         -> https://allbirds.com/products.json
 *   https://store.com/collections/mens   -> .../collections/mens/products.json
 */
function resolveEndpoint(input: string): { endpoint: string; origin: string; collection: string | null } {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const u = new URL(raw);
  const origin = u.origin;
  const m = u.pathname.match(/\/collections\/([^/]+)/i);
  const collection = m ? decodeURIComponent(m[1]) : null;
  const base = collection ? `${origin}/collections/${collection}` : origin;
  return { endpoint: `${base}/products.json`, origin, collection };
}

function shopNameFromOrigin(origin: string): string {
  const host = new URL(origin).hostname.replace(/^www\./, '').replace(/\.myshopify\.com$/, '');
  const first = host.split('.')[0];
  return first.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Best-effort: Shopify exposes /meta.json on most stores with name+currency. */
async function fetchMeta(origin: string): Promise<{ name?: string; currency?: string }> {
  try {
    const r = await fetch(`${origin}/meta.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return {};
    const j = (await r.json()) as { name?: string; currency?: string };
    return { name: j.name, currency: j.currency };
  } catch {
    return {};
  }
}

export const scrape: Handler = async (body) => {
  const { url, maxPages } = (body ?? {}) as { url?: string; maxPages?: number };
  if (!url || typeof url !== 'string') {
    return { status: 400, body: { error: 'Missing "url" in request body.' } };
  }

  let resolved: ReturnType<typeof resolveEndpoint>;
  try {
    resolved = resolveEndpoint(url);
  } catch {
    return { status: 400, body: { error: `Could not parse "${url}" as a URL.` } };
  }
  const { endpoint, origin, collection } = resolved;

  const cap = Math.min(Math.max(1, maxPages ?? 8), 20); // 250 * 20 = up to 5000 products
  const products: unknown[] = [];
  for (let page = 1; page <= cap; page++) {
    let res: Response;
    try {
      res = await fetch(`${endpoint}?limit=250&page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return { status: 502, body: { error: 'Could not reach the store. Check the URL and try again.' } };
    }
    if (res.status === 404) {
      return {
        status: 404,
        body: {
          error:
            'No public product feed found. Make sure this is a Shopify store URL ' +
            '(e.g. store.com or store.com/collections/all).',
        },
      };
    }
    if (!res.ok) {
      return { status: 502, body: { error: `Store returned HTTP ${res.status} for the product feed.` } };
    }
    let json: { products?: unknown[] };
    try {
      json = (await res.json()) as { products?: unknown[] };
    } catch {
      return {
        status: 502,
        body: { error: 'The URL did not return Shopify product JSON. Is this a Shopify store?' },
      };
    }
    const batch = json.products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }

  if (products.length === 0) {
    return { status: 404, body: { error: 'This store/collection has no public products.' } };
  }

  const meta = await fetchMeta(origin);
  return {
    status: 200,
    body: {
      shopName: meta.name || shopNameFromOrigin(origin),
      currency: meta.currency || null,
      origin,
      collection,
      productCount: products.length,
      products,
    },
  };
};

// ----------------------------------------------------------------- enhance ---

interface EnhanceInput {
  storeName?: string;
  audience?: string;
  products?: { id: string; name: string; desc: string; specs?: string }[];
}

const GEMINI_HOST = 'https://generativelanguage.googleapis.com/v1beta/models';

export const enhance: Handler = async (body, env) => {
  const key = env.GEMINI_API_KEY;
  const input = (body ?? {}) as EnhanceInput;
  const items = input.products ?? [];

  // Graceful no-op when unconfigured — the client falls back to raw descriptions.
  if (!key) return { status: 200, body: { enabled: false, reason: 'no-key' } };
  if (items.length === 0) return { status: 200, body: { enabled: false, reason: 'no-products' } };

  const model = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const list = items
    .map((p, i) => {
      const specs = p.specs ? `\n   fields: ${p.specs.slice(0, 300)}` : '';
      return `${i + 1}. id="${p.id}"\n   title: ${p.name}${specs}\n   description: ${(p.desc || '(none)').slice(0, 600)}`;
    })
    .join('\n');

  const prompt = `You are an editor preparing a premium PRINTED product catalog for "${
    input.storeName || 'this store'
  }"${input.audience ? ` (audience: ${input.audience})` : ''}.

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

  let data: {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  try {
    const r = await fetch(`${GEMINI_HOST}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          // 2.5 flash models "think" by default, which is slow + token-hungry for
          // this structured task — turn it off so the call stays well under the
          // serverless timeout. Ignored by models that don't support it.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(28000),
    });
    data = (await r.json()) as typeof data;
    if (!r.ok) {
      return { status: 200, body: { enabled: false, reason: data?.error?.message || `gemini-${r.status}` } };
    }
  } catch (err) {
    return { status: 200, body: { enabled: false, reason: (err as Error).message } };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(text) as {
      tagline?: string;
      products?: { id: string; name?: string; desc?: string; flag?: string }[];
    };
    return {
      status: 200,
      body: {
        enabled: true,
        tagline: parsed.tagline ?? '',
        products: Array.isArray(parsed.products) ? parsed.products : [],
      },
    };
  } catch {
    return { status: 200, body: { enabled: false, reason: 'bad-json-from-model' } };
  }
};
