import { useMemo, useState } from 'react';
import type { CatalogConfig, CatalogProduct, ScrapeResult } from './types';
import { transformProducts, symbolForCurrency } from './lib/shopify';
import { getTheme } from './lib/themes';
import { Store, Sliders, Sparkles, Printer, Check } from './components/icons';
import ConnectStep from './steps/ConnectStep';
import CurateStep from './steps/CurateStep';
import DesignStep from './steps/DesignStep';
import ExportStep from './steps/ExportStep';

const STEPS = [
  { id: 'connect', label: 'Connect', icon: Store },
  { id: 'curate', label: 'Curate', icon: Sliders },
  { id: 'design', label: 'Design', icon: Sparkles },
  { id: 'export', label: 'Export', icon: Printer },
] as const;

function titleCase(s: string) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function defaultConfig(scrape: ScrapeResult, products: CatalogProduct[]): CatalogConfig {
  const host = (() => {
    try {
      return new URL(scrape.origin).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const firstImg = products[0]?.images[0]?.src ?? null;
  const lastImg = products[products.length - 1]?.images[0]?.src ?? firstImg;
  return {
    title: scrape.shopName,
    subtitle: scrape.collection ? titleCase(scrape.collection) : 'Product Catalog',
    coverImage: firstImg,
    backImage: lastImg,
    currencySymbol: symbolForCurrency(scrape.currency),
    currencyDecimals: !['INR', 'JPY'].includes((scrape.currency ?? '').toUpperCase()),
    taxNote: '',
    accent: '#D93A32',
    themeId: 'stencil',
    contact: { website: host, email: '', phone: '' },
    year: String(new Date().getFullYear()),
  };
}

const STEP_INDEX: Record<string, number> = { connect: 0, curate: 1, design: 2, export: 3 };

export default function App() {
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const autoStore = params.get('store');
  const goTarget = STEP_INDEX[params.get('go') ?? 'curate'] ?? 1;

  const [stepIdx, setStepIdx] = useState(0);
  const [scrape, setScrape] = useState<ScrapeResult | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [config, setConfig] = useState<CatalogConfig | null>(null);

  const theme = useMemo(() => getTheme(config?.themeId ?? 'stencil'), [config?.themeId]);
  const includedCount = products.filter((p) => p.included).length;
  const maxReachable = scrape ? STEPS.length - 1 : 0;

  function handleConnected(result: ScrapeResult) {
    const opts = {
      currencySymbol: symbolForCurrency(result.currency),
      currencyDecimals: !['INR', 'JPY'].includes((result.currency ?? '').toUpperCase()),
      taxNote: '',
    };
    const prods = transformProducts(result, opts);
    setScrape(result);
    setProducts(prods);
    setConfig(defaultConfig(result, prods));
    setStepIdx(goTarget);
  }

  function reset() {
    setScrape(null);
    setProducts([]);
    setConfig(null);
    setStepIdx(0);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button onClick={reset} className="flex items-center gap-2.5 text-left">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <Printer width={17} height={17} />
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight tracking-tight">Catalog Studio</span>
              <span className="block text-[11px] leading-tight text-[#8a8880]">Shopify → print-ready PDF</span>
            </span>
          </button>
          <Stepper stepIdx={stepIdx} maxReachable={maxReachable} onJump={setStepIdx} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {stepIdx === 0 && <ConnectStep onConnected={handleConnected} autoStore={autoStore} />}
        {stepIdx === 1 && config && (
          <CurateStep
            products={products}
            setProducts={setProducts}
            config={config}
            onBack={() => setStepIdx(0)}
            onNext={() => setStepIdx(2)}
          />
        )}
        {stepIdx === 2 && config && scrape && (
          <DesignStep
            products={products}
            setProducts={setProducts}
            config={config}
            setConfig={setConfig}
            storeName={scrape.shopName}
            theme={theme}
            onBack={() => setStepIdx(1)}
            onNext={() => setStepIdx(3)}
          />
        )}
        {stepIdx === 3 && config && (
          <ExportStep
            products={products.filter((p) => p.included)}
            config={config}
            theme={theme}
            onBack={() => setStepIdx(2)}
          />
        )}
      </main>

      {stepIdx > 0 && (
        <footer className="no-print border-t border-white/[0.06] px-5 py-3 text-center text-[11px] text-[#6c6a64]">
          {includedCount} of {products.length} products included · {scrape?.shopName}
        </footer>
      )}
    </div>
  );
}

function Stepper({
  stepIdx,
  maxReachable,
  onJump,
}: {
  stepIdx: number;
  maxReachable: number;
  onJump: (i: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const state = i === stepIdx ? 'active' : i < stepIdx ? 'done' : 'todo';
        const reachable = i <= maxReachable;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <button
              disabled={!reachable}
              onClick={() => reachable && onJump(i)}
              className={
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ' +
                (state === 'active'
                  ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                  : state === 'done'
                    ? 'text-[#eceae4] hover:bg-white/5'
                    : reachable
                      ? 'text-[#8a8880] hover:bg-white/5'
                      : 'text-[#4a4945] cursor-not-allowed')
              }
            >
              <span
                className={
                  'grid h-5 w-5 place-items-center rounded-full text-[10px] ' +
                  (state === 'done' ? 'bg-brand text-white' : 'ring-1 ring-current')
                }
              >
                {state === 'done' ? <Check width={12} height={12} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              <Icon className="sm:hidden" width={15} height={15} />
            </button>
            {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-white/10" />}
          </div>
        );
      })}
    </nav>
  );
}
