/**
 * Vercel serverless function — proxies Shopify's public products.json.
 *
 * Self-contained on purpose: no imports from outside this file, so Vercel's
 * function bundler has nothing to trace/resolve. The core logic is also
 * exported (`scrapeCore`) so the Vite dev bridge (vite.config.ts) can reuse it
 * locally without the Vercel runtime.
 */

type Env = Record<string, string | undefined>;

/**
 * Turn whatever URL the user pasted into the public products.json endpoint.
 *   allbirds.com                        -> https://allbirds.com/products.json
 *   https://store.com/collections/mens  -> .../collections/mens/products.json
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

export async function scrapeCore(body: unknown, _env: Env): Promise<{ status: number; body: unknown }> {
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
}

// Vercel entrypoint. The client posts { url, maxPages? }.
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST.' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { status, body: out } = await scrapeCore(body, process.env);
    res.status(status).json(out);
  } catch (err) {
    res.status(500).json({ error: `Scrape failed: ${(err as Error).message}` });
  }
}
