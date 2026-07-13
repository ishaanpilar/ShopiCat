import { useEffect, useRef, useState } from 'react';
import type { ScrapeResult } from '../types';
import { scrapeStore } from '../lib/api';
import { ArrowRight, Spinner, Store, External } from '../components/icons';

const EXAMPLES = ['allbirds.com', 'gymshark.com', 'shop.prad4x4.com/collections/all'];

export default function ConnectStep({
  onConnected,
  autoStore,
}: {
  onConnected: (r: ScrapeResult) => void;
  autoStore?: string | null;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoDone = useRef(false);

  async function go(target?: string) {
    const input = (target ?? url).trim();
    if (!input) return;
    setUrl(input);
    setLoading(true);
    setError(null);
    try {
      const result = await scrapeStore(input);
      onConnected(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Optional deep-link: ?store=<url> prefills and auto-generates on load.
  useEffect(() => {
    if (autoStore && !autoDone.current) {
      autoDone.current = true;
      go(autoStore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStore]);

  return (
    <div className="mx-auto max-w-2xl pt-6 sm:pt-16">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
        <Store width={14} height={14} /> Works with any Shopify store
      </div>
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-[42px]">
        Turn any Shopify store into a<br className="hidden sm:block" />{' '}
        <span className="text-brand">print-ready catalog.</span>
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#98958d]">
        Paste a store or collection URL. We pull the products straight from Shopify's public
        feed, let you curate and polish them with AI, and export a designed PDF you can print.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="mt-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5c5b57]">
              <Store width={18} height={18} />
            </span>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourstore.com  or  store.com/collections/summer"
              className="field pl-10"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary sm:px-6" disabled={loading || !url.trim()}>
            {loading ? <Spinner /> : <ArrowRight />}
            {loading ? 'Fetching…' : 'Generate'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-[#6c6a64]">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => go(ex)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 font-medium text-[#b9b6ae] ring-1 ring-white/[0.06] transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <External width={12} height={12} /> {ex}
          </button>
        ))}
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          ['Public data, no login', 'Reads Shopify’s open product JSON — no API keys or store access required.'],
          ['AI-polished copy', 'Gemini rewrites messy descriptions into tight catalog blurbs and a cover tagline.'],
          ['Real PDF export', 'A4 pages rendered in the browser, printed to PDF exactly as previewed.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-4">
            <div className="text-sm font-semibold">{t}</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-[#8a8880]">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
