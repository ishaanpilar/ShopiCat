/**
 * Vercel serverless function — Gemini review + copywriting pass.
 *
 * Self-contained on purpose (see api/scrape.ts). Core logic is exported
 * (`enhanceCore`) for the Vite dev bridge; the default export is the Vercel
 * handler. Degrades gracefully to { enabled:false } when GEMINI_API_KEY is
 * unset or the model is unavailable, so the client can fall back to store copy.
 */

type Env = Record<string, string | undefined>;

interface EnhanceInput {
  storeName?: string;
  audience?: string;
  products?: { id: string; name: string; desc: string; specs?: string }[];
}

const GEMINI_HOST = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function enhanceCore(body: unknown, env: Env): Promise<{ status: number; body: unknown }> {
  const key = env.GEMINI_API_KEY;
  const input = (body ?? {}) as EnhanceInput;
  const items = input.products ?? [];

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
          // 2.5+ flash models "think" by default — slow + token-hungry for this
          // structured task. Off keeps the call under the serverless timeout.
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
}

// Vercel entrypoint. The client posts { storeName, products[] }.
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST.' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const { status, body: out } = await enhanceCore(body, process.env);
    res.status(status).json(out);
  } catch (err) {
    res.status(500).json({ error: `Enhance failed: ${(err as Error).message}` });
  }
}
