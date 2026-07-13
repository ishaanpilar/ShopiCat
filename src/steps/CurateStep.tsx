import { useState } from 'react';
import type { CatalogConfig, CatalogProduct, PhotoFit } from '../types';
import { ArrowLeft, ArrowRight, Grip, Check, Image } from '../components/icons';

interface Props {
  products: CatalogProduct[];
  setProducts: (p: CatalogProduct[]) => void;
  config: CatalogConfig;
  onBack: () => void;
  onNext: () => void;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export default function CurateStep({ products, setProducts, onBack, onNext }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const includedCount = products.filter((p) => p.included).length;

  const update = (id: string, patch: Partial<CatalogProduct>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const setAll = (included: boolean) => setProducts(products.map((p) => ({ ...p, included })));
  const onlyInStock = () =>
    setProducts(
      products.map((p) => ({
        ...p,
        included: p.specs.some((s) => s.key === 'Availability' && s.val === 'In Stock'),
      })),
    );

  return (
    <div>
      <StepHeader
        title="Curate your products"
        subtitle="Pick what goes in, drag to reorder, and set how each photo is framed."
        onBack={onBack}
        onNext={onNext}
        nextLabel="Design"
        nextDisabled={includedCount === 0}
        count={`${includedCount} included`}
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-subtle text-xs" onClick={() => setAll(true)}>Select all</button>
        <button className="btn-subtle text-xs" onClick={() => setAll(false)}>Deselect all</button>
        <button className="btn-subtle text-xs" onClick={onlyInStock}>Only in-stock</button>
      </div>

      <ul className="space-y-2">
        {products.map((p, i) => {
          const isOpen = expanded === p.id;
          return (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== i) setProducts(move(products, dragIdx, i));
                setDragIdx(null);
              }}
              className={
                'card overflow-hidden transition ' +
                (p.included ? '' : 'opacity-55 ') +
                (dragIdx === i ? 'ring-2 ring-brand/40' : '')
              }
            >
              <div className="flex items-center gap-3 p-2.5 pr-3">
                <span className="cursor-grab px-1 text-[#5c5b57] active:cursor-grabbing" title="Drag to reorder">
                  <Grip />
                </span>
                <span className="w-6 text-center text-xs font-semibold tabular-nums text-[#6c6a64]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-ink-800">
                  {p.images[0] && (
                    <img src={p.images[0].src} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[#8a8880]">
                    <span>{p.price}{p.hasRange ? '+' : ''}</span>
                    <span className="text-[#4a4945]">·</span>
                    <span className="inline-flex items-center gap-1"><Image width={12} height={12} />{p.images.length}</span>
                    {p.tag && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">{p.tag}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="btn-subtle hidden text-xs sm:inline-flex"
                >
                  {isOpen ? 'Close' : 'Photos'}
                </button>
                <Toggle checked={p.included} onChange={(v) => update(p.id, { included: v })} />
              </div>

              {isOpen && (
                <div className="border-t border-white/[0.06] bg-black/20 p-3">
                  <PhotoEditor product={p} onChange={(patch) => update(p.id, patch)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhotoEditor({
  product,
  onChange,
}: {
  product: CatalogProduct;
  onChange: (patch: Partial<CatalogProduct>) => void;
}) {
  const setFit = (idx: number, fit: PhotoFit) =>
    onChange({ images: product.images.map((im, k) => (k === idx ? { ...im, fit } : im)) });

  const showMain = product.images.length >= 3;

  return (
    <div>
      <div className="mb-2 label-xs">Photos — framing &amp; hero</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {product.images.map((im, idx) => (
          <div key={idx} className="overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
            <div className="relative aspect-[4/3] bg-ink-800">
              <img
                src={im.src}
                alt=""
                className={'h-full w-full ' + (im.fit === 'contain' ? 'object-contain bg-white' : 'object-cover')}
              />
              {showMain && (
                <button
                  onClick={() => onChange({ mainIndex: idx })}
                  className={
                    'absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ' +
                    (product.mainIndex === idx ? 'bg-brand text-white' : 'bg-black/60 text-white/70')
                  }
                >
                  {product.mainIndex === idx ? '★ Hero' : 'Set hero'}
                </button>
              )}
            </div>
            <div className="flex">
              {(['cover', 'contain'] as PhotoFit[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFit(idx, f)}
                  className={
                    'flex-1 py-1.5 text-[11px] font-semibold capitalize transition ' +
                    (im.fit === f ? 'bg-brand/15 text-brand' : 'text-[#8a8880] hover:bg-white/5')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6c6a64]">
        <b className="text-[#8a8880]">Cover</b> fills the frame (crops overflow) — best for lifestyle shots.{' '}
        <b className="text-[#8a8880]">Contain</b> shows the whole product on white — best for studio shots.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={
        'relative h-6 w-10 shrink-0 rounded-full transition-colors ' +
        (checked ? 'bg-brand' : 'bg-ink-700')
      }
      role="switch"
      aria-checked={checked}
    >
      <span
        className={
          'absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white transition-transform ' +
          (checked ? 'translate-x-[18px]' : 'translate-x-0.5')
        }
      >
        {checked && <Check width={12} height={12} className="text-brand" />}
      </span>
    </button>
  );
}

export function StepHeader({
  title,
  subtitle,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  count,
  nextBusy,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  count?: string;
  nextBusy?: boolean;
}) {
  return (
    <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-[#8a8880]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {count && <span className="mr-1 text-xs text-[#6c6a64]">{count}</span>}
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </button>
        {onNext && (
          <button className="btn-primary" onClick={onNext} disabled={nextDisabled || nextBusy}>
            {nextLabel ?? 'Next'} <ArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}
