# ShopiCat — Shopify Catalog Generator

Point it at **any Shopify store** and get a **print-ready product catalog PDF**.
React + Vite front end, Vercel serverless functions, and Google Gemini for
AI review and copywriting.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## How it works

The whole thing hangs off one fact: **every Shopify store exposes its products
as public JSON, no auth** — `https://<store>/products.json` (and
`/collections/<handle>/products.json`). Onboarding a store is just pasting a URL.

Four steps:

1. **Connect** — paste a store or collection URL. `/api/scrape` proxies Shopify's
   feed (paginated) so there's no CORS issue.
2. **Curate** — pick products, drag to reorder, choose each photo's framing
   (cover vs. contain) and the hero shot.
3. **Design** — cover, tagline, currency, tax note, accent colour, contact info,
   plus a click-to-reframe photo editor (pan/zoom, cover vs. contain, letterbox
   colour, photo swap, per-product price/layout/footnote). **Review & polish with
   AI** cleans up messy titles (ALL-CAPS, stray SKUs/vendor codes), rewrites
   descriptions, writes a cover tagline, and **flags products whose fields look
   wrong or mismatched** — it validates the data, it doesn't just rephrase it.
4. **Export** — a live A4 preview that is pixel-identical to the PDF. Print to PDF
   straight from the browser (`@page` + one `.page` per sheet — no PDF library).

The catalog itself is a faithful port of the blueprint's "Stencil Spec-Sheet"
design system: every colour is a CSS token, so re-theming is swapping ~7 values

+ two fonts (see `src/lib/themes.ts` — add themes there).

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173 — API routes work in dev too
```

`npm run dev` alone is fully functional: a small Vite plugin (`vite.config.ts`)
mounts the same handlers as `/api/*`, so you don't need the Vercel CLI.

Deep link for demos: `?store=allbirds.com&go=export` prefills and jumps ahead.

## Enable AI (optional)

The app works without it — it falls back to the store's own titles & descriptions.
To turn on the Gemini review/polish, get a free key at
https://aistudio.google.com/apikey and:

```bash
cp .env.example .env
# set GEMINI_API_KEY=...
```

Default model is `gemini-flash-lite-latest` (fast, cheap, rarely rate-limited).
Override with `GEMINI_MODEL` — e.g. `gemini-flash-latest` for higher quality.
If the model is briefly overloaded the app degrades gracefully (keeps store copy).

## Deploy to Vercel

1. Push this `app/` folder to a Git repo (set it as the Vercel **root directory**
   if the repo has other folders).
2. Import into Vercel — it auto-detects Vite. `api/*.ts` become serverless funcs.
3. Add the `GEMINI_API_KEY` environment variable in the Vercel project settings.

Or from this folder: `npx vercel` (then `npx vercel --prod`).

## Printing tips

In the browser print dialog: **Destination → Save as PDF**, **Margins → None**,
and **Background graphics ON** (so the dark theme prints). Large catalogs (100+
products) make large PDFs — curate down or lower the widths in
`src/catalog/Catalog.tsx` (`sized()`).

## Layout

```
api/            Vercel serverless functions (thin wrappers)
  scrape.ts     proxy + paginate Shopify products.json
  enhance.ts    Gemini review + copy polish
  _lib/core.ts  framework-agnostic handlers (shared by api/ and the dev bridge)
src/
  types.ts            Shopify + catalog data models
  lib/shopify.ts      transform: suffix-strip, price format, html to text, specs
  lib/themes.ts       token-based themes (skin-only)
  lib/api.ts          client fetch helpers
  catalog/            the A4 catalog renderer + ported design-system CSS
  components/          CatalogViewport (scaled preview), icons
  steps/              Connect / Curate / Design / Export wizard
```

## Not yet (roadmap)

- More themes (the system is ready; only one ships).
- Auto white-background detection for photo fit (currently a heuristic + manual toggle).
- Logo upload for the header/cover (currently uses the website text).

## License

MIT — see [LICENSE](LICENSE).
