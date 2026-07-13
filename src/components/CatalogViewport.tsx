import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const PAGE_W_PX = 794; // 210mm at 96dpi

/**
 * Scales the full-size A4 catalog down to fit the available width on screen,
 * using CSS `zoom` so document flow (and scrollbars) stay correct without
 * manual height math. In print, index.css resets both zoom and transform so
 * pages render at true A4. Pass `zoom` to override the auto fit-to-width.
 */
export default function CatalogViewport({
  children,
  zoom,
  className = '',
}: {
  children: ReactNode;
  zoom?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.5);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth - 32; // padding allowance
      setFit(Math.min(1, Math.max(0.2, cw / PAGE_W_PX)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effective = zoom ?? fit;

  return (
    <div
      ref={wrapRef}
      className={
        'catalog-viewport flex justify-center overflow-auto rounded-xl bg-[#0e0e10] p-4 ring-1 ring-white/[0.06] ' +
        className
      }
    >
      <div className="catalog-scaler shrink-0" style={{ zoom: effective } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
