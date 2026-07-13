import type { CatalogPhoto, CatalogProduct, PhotoFrame, PhotoLayout } from '../types';
import { X, Check } from './icons';

export interface EditorSelection {
  key: string;
  kind: 'cover' | 'back' | 'product';
  product?: CatalogProduct;
  idx?: number;
  photo?: CatalogPhoto;
  frame?: PhotoFrame;
}

interface Props {
  sel: EditorSelection;
  onClose: () => void;
  setFit: (fit: 'cover' | 'contain') => void;
  setZoom: (zoom: number) => void;
  setBg: (bg: string) => void;
  resetFrame: () => void;
  swap: (src: string) => void;
  setLayout: (layout: PhotoLayout | null) => void;
  setPrice: (price: string) => void;
  setNote: (note: string) => void;
}

export default function EditorPanel(p: Props) {
  const { sel } = p;
  const zoom = sel.frame?.zoom ?? 1;
  const isProduct = sel.kind === 'product' && sel.product && sel.photo;
  const fit = sel.photo?.fit ?? 'cover';

  return (
    <section className="card sticky top-20 z-10 overflow-hidden ring-1 ring-brand/25">
      <div className="flex items-center justify-between bg-brand/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          Editing {sel.kind === 'product' ? sel.product?.name : sel.kind === 'cover' ? 'cover photo' : 'back photo'}
        </div>
        <button onClick={p.onClose} className="text-[#8a8880] hover:text-white"><X width={16} height={16} /></button>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-[12px] leading-relaxed text-[#8a8880]">
          Drag the highlighted photo in the preview to reposition it, then fine-tune below.
        </p>

        {/* Zoom */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label-xs">Zoom</span>
            <span className="text-xs tabular-nums text-[#8a8880]">{zoom.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => p.setZoom(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <button onClick={p.resetFrame} className="btn-subtle mt-1 text-xs">Reset position &amp; zoom</button>
        </div>

        {/* Fit + background (product photos) */}
        {isProduct && (
          <>
            <div>
              <span className="mb-1.5 block label-xs">Framing</span>
              <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
                {(['cover', 'contain'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => p.setFit(f)}
                    className={
                      'flex-1 py-2 text-xs font-semibold capitalize transition ' +
                      (fit === f ? 'bg-brand/15 text-brand' : 'text-[#8a8880] hover:bg-white/5')
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {fit === 'contain' && (
              <div>
                <span className="mb-1.5 block label-xs">Letterbox background</span>
                <div className="flex flex-wrap items-center gap-2">
                  {['#FFFFFF', '#F2F0EA', '#131417', '#1B1C20'].map((c) => (
                    <button
                      key={c}
                      onClick={() => p.setBg(c)}
                      className={
                        'h-7 w-7 rounded ring-2 ring-offset-2 ring-offset-ink-900 ' +
                        ((sel.photo?.bg ?? '#FFFFFF').toLowerCase() === c.toLowerCase() ? 'ring-white' : 'ring-transparent')
                      }
                      style={{ background: c }}
                    />
                  ))}
                  <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded ring-1 ring-white/20">
                    <input
                      type="color"
                      value={sel.photo?.bg ?? '#FFFFFF'}
                      onChange={(e) => p.setBg(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-pink-500 via-yellow-400 to-cyan-400 text-[9px] font-bold text-black">+</span>
                  </label>
                </div>
              </div>
            )}

            {/* Swap image */}
            {sel.product!.allImages.length > 1 && (
              <div>
                <span className="mb-1.5 block label-xs">Swap photo ({sel.product!.allImages.length} available)</span>
                <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-auto rounded-lg bg-black/30 p-2 ring-1 ring-white/[0.06]">
                  {sel.product!.allImages.map((src) => (
                    <button
                      key={src}
                      onClick={() => p.swap(src)}
                      className={
                        'relative aspect-square overflow-hidden rounded ring-2 transition ' +
                        (sel.photo!.src === src ? 'ring-brand' : 'ring-transparent hover:ring-white/30')
                      }
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      {sel.photo!.src === src && (
                        <span className="absolute right-0.5 top-0.5 rounded-full bg-brand p-0.5 text-white"><Check width={9} height={9} /></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product-level overrides */}
            <div className="border-t border-white/[0.06] pt-4">
              <span className="mb-2 block label-xs">This product</span>
              <div className="space-y-3">
                <div>
                  <span className="mb-1.5 block text-[11px] text-[#8a8880]">Photo layout</span>
                  <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
                    {([['Auto', null], ['1', 'one'], ['2', 'two'], ['3', 'three']] as const).map(([lbl, val]) => (
                      <button
                        key={lbl}
                        onClick={() => p.setLayout(val as PhotoLayout | null)}
                        className={
                          'flex-1 py-1.5 text-xs font-semibold transition ' +
                          ((sel.product!.layout ?? null) === val ? 'bg-brand/15 text-brand' : 'text-[#8a8880] hover:bg-white/5')
                        }
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-[#8a8880]">Price (override)</span>
                  <input className="field" value={sel.product!.price} onChange={(e) => p.setPrice(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-[#8a8880]">Footnote / disclaimer</span>
                  <input
                    className="field"
                    placeholder="Optional note under the photos"
                    value={sel.product!.note ?? ''}
                    onChange={(e) => p.setNote(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
