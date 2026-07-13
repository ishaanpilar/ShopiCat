import { useEffect, useState } from 'react';
import type { CatalogConfig, CatalogProduct, Theme } from '../types';
import Catalog from '../catalog/Catalog';
import CatalogViewport from '../components/CatalogViewport';
import { ArrowLeft, Printer, Download, Check } from '../components/icons';

interface Props {
  products: CatalogProduct[];
  config: CatalogConfig;
  theme: Theme;
  onBack: () => void;
}

export default function ExportStep({ products, config, theme, onBack }: Props) {
  const [zoom, setZoom] = useState<number | undefined>(undefined); // undefined = fit-to-width
  const totalPages = products.length + 2;

  // Dev/deep-link helper: ?showpage=N scrolls the preview to a given page.
  useEffect(() => {
    const n = new URLSearchParams(location.search).get('showpage');
    if (!n) return;
    const t = setTimeout(() => {
      document.querySelectorAll('.catalog-root .page')[Number(n)]?.scrollIntoView({ block: 'start' });
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const step = (d: number) => setZoom((z) => Math.min(1, Math.max(0.25, (z ?? 0.5) + d)));

  return (
    <div>
      <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Preview &amp; export</h2>
          <p className="mt-1 text-sm text-[#8a8880]">
            {totalPages} A4 pages · {products.length} products. Print to PDF straight from your browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-ink-900 p-1 ring-1 ring-white/10">
          <button className="btn-subtle px-2.5 py-1 text-xs" onClick={() => setZoom(undefined)}>Fit</button>
          <button className="btn-subtle px-2.5 py-1 text-xs" onClick={() => step(-0.1)}>–</button>
          <span className="w-12 text-center text-xs tabular-nums text-[#8a8880]">
            {zoom ? `${Math.round(zoom * 100)}%` : 'Auto'}
          </span>
          <button className="btn-subtle px-2.5 py-1 text-xs" onClick={() => step(0.1)}>+</button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.07] px-3 py-2 text-[12px] leading-relaxed text-amber-300/90 ring-1 ring-amber-500/20">
          <Download width={15} height={15} className="mt-0.5 shrink-0" />
          <span>
            In the print dialog: set <b>Destination → Save as PDF</b>, <b>Margins → None</b>, and turn{' '}
            <b>Background graphics ON</b> so the dark theme prints correctly.
          </span>
        </div>
      </div>

      <CatalogViewport zoom={zoom}>
        <Catalog products={products} config={config} theme={theme} />
      </CatalogViewport>

      <div className="no-print mt-4 flex items-center justify-center gap-2 text-xs text-[#6c6a64]">
        <Check width={13} height={13} className="text-emerald-500" />
        What you see here is pixel-identical to the exported PDF.
      </div>
    </div>
  );
}
