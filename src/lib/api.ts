import type { CatalogProduct, ScrapeResult } from '../types';

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`);
  return data as T;
}

export function scrapeStore(url: string): Promise<ScrapeResult> {
  return postJSON<ScrapeResult>('/api/scrape', { url });
}

export interface EnhanceResponse {
  enabled: boolean;
  reason?: string;
  tagline?: string;
  products?: { id: string; name?: string; desc?: string; flag?: string }[];
}

/** Ask the server (Gemini) to validate + clean titles, polish descriptions,
 * flag mismatched/garbage fields, and write a cover tagline. */
export function enhanceCatalog(
  storeName: string,
  products: CatalogProduct[],
): Promise<EnhanceResponse> {
  return postJSON<EnhanceResponse>('/api/enhance', {
    storeName,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      desc: p.rawDesc,
      specs: p.specs.map((s) => `${s.key}: ${s.val}`).join(' · '),
    })),
  });
}
