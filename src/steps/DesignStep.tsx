import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { CatalogConfig, CatalogProduct, PhotoFrame, Theme } from '../types';
import { priceStrings } from '../lib/shopify';
import { enhanceCatalog, type EnhanceResponse } from '../lib/api';
import { enhanceDirect } from '../lib/gemini';
import { getUserKey, setUserKey, clearUserKey } from '../lib/userKey';
import Catalog, { type CatalogEditor } from '../catalog/Catalog';
import CatalogViewport from '../components/CatalogViewport';
import EditorPanel, { type EditorSelection } from '../components/EditorPanel';
import KeyModal from '../components/KeyModal';
import { StepHeader } from './CurateStep';
import { Sparkles, Spinner, Check, Image as ImageIcon, Download, Alert, X } from '../components/icons';

interface Props {
  products: CatalogProduct[];
  setProducts: (p: CatalogProduct[]) => void;
  config: CatalogConfig;
  setConfig: (c: CatalogConfig) => void;
  storeName: string;
  theme: Theme;
  onBack: () => void;
  onNext: () => void;
}

const ACCENTS = ['#D93A32', '#E8873A', '#C9A227', '#3E9E6E', '#3B82F6', '#8B5CF6', '#EC4899', '#E5E4E0'];
const DEF_FRAME: PhotoFrame = { zoom: 1, x: 0, y: 0 };

const clampFrame = (f: PhotoFrame): PhotoFrame => {
  const m = (f.zoom - 1) * 50 + 10; // allow a little wiggle even at 1×
  return { zoom: f.zoom, x: Math.max(-m, Math.min(m, f.x)), y: Math.max(-m, Math.min(m, f.y)) };
};

interface Warning {
  id: string;
  name: string;
  flag: string;
}
type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; count: number; renamed: number; warnings: Warning[] }
  | { status: 'off'; reason?: string };

export default function DesignStep({
  products,
  setProducts,
  config,
  setConfig,
  storeName,
  theme,
  onBack,
  onNext,
}: Props) {
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [selKey, setSelKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [userKey, setUserKeyState] = useState<string | null>(getUserKey());
  const fileRef = useRef<HTMLInputElement>(null);
  const included = useMemo(() => products.filter((p) => p.included), [products]);

  const patch = (p: Partial<CatalogConfig>) => setConfig({ ...config, ...p });

  // ---- product / photo mutation helpers ------------------------------------
  const setPhoto = (id: string, idx: number, up: Partial<CatalogProduct['images'][number]>) =>
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, images: p.images.map((im, k) => (k === idx ? { ...im, ...up } : im)) } : p,
      ),
    );
  const setProductField = (id: string, up: Partial<CatalogProduct>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...up } : p)));

  const updateFrame = (key: string, mut: (f: PhotoFrame) => PhotoFrame) => {
    if (key === '__cover__') return patch({ coverFrame: clampFrame(mut(config.coverFrame ?? DEF_FRAME)) });
    if (key === '__back__') return patch({ backFrame: clampFrame(mut(config.backFrame ?? DEF_FRAME)) });
    const [id, idxS] = key.split(':');
    const idx = Number(idxS);
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    setPhoto(id, idx, { frame: clampFrame(mut(prod.images[idx]?.frame ?? DEF_FRAME)) });
  };
  const resetFrame = (key: string) => {
    if (key === '__cover__') return patch({ coverFrame: undefined });
    if (key === '__back__') return patch({ backFrame: undefined });
    const [id, idxS] = key.split(':');
    setPhoto(id, Number(idxS), { frame: undefined });
  };

  const editor: CatalogEditor = {
    selectedKey: selKey,
    onSelect: setSelKey,
    onPan: (key, dx, dy) => updateFrame(key, (f) => ({ ...f, x: f.x + dx, y: f.y + dy })),
  };

  // ---- resolved current selection ------------------------------------------
  const sel: EditorSelection | null = useMemo(() => {
    if (!selKey) return null;
    if (selKey === '__cover__') return { key: selKey, kind: 'cover', frame: config.coverFrame };
    if (selKey === '__back__') return { key: selKey, kind: 'back', frame: config.backFrame };
    const [id, idxS] = selKey.split(':');
    const product = products.find((p) => p.id === id);
    if (!product) return null;
    const idx = Number(idxS);
    const photo = product.images[idx];
    if (!photo) return null;
    return { key: selKey, kind: 'product', product, idx, photo, frame: photo.frame };
  }, [selKey, products, config.coverFrame, config.backFrame]);

  // Pricing fields re-format every product (except manually overridden ones).
  const repriceWith = (
    over: Partial<Pick<CatalogConfig, 'currencySymbol' | 'currencyDecimals' | 'taxNote'>>,
  ) => {
    const next = { ...config, ...over };
    setConfig(next);
    setProducts(
      products.map((p) =>
        p.priceOverridden
          ? p
          : {
              ...p,
              ...priceStrings(p.priceValue, p.hasRange, {
                currencySymbol: next.currencySymbol,
                currencyDecimals: next.currencyDecimals,
                taxNote: next.taxNote,
              }),
            },
      ),
    );
  };

  function applyResult(res: EnhanceResponse) {
    if (!res.enabled) {
      setAi({ status: 'off', reason: res.reason });
      return;
    }
    const map = new Map((res.products ?? []).map((x) => [x.id, x]));
    let renamed = 0;
    const warnings: Warning[] = [];
    setProducts(
      products.map((p) => {
        const r = map.get(p.id);
        if (!r) return p;
        const name = r.name?.trim() || p.name;
        if (name !== p.name) renamed++;
        if (r.flag && r.flag.trim()) warnings.push({ id: p.id, name, flag: r.flag.trim() });
        return { ...p, name, desc: r.desc?.trim() || p.desc };
      }),
    );
    if (res.tagline) patch({ subtitle: res.tagline });
    setAi({ status: 'done', count: map.size, renamed, warnings });
  }

  // Hybrid: use the deployment's server key when present; otherwise call Gemini
  // directly from the browser with the user's own key (prompting for it once).
  async function polish() {
    if (userKey) {
      setAi({ status: 'loading' });
      applyResult(await enhanceDirect(userKey, storeName, included));
      return;
    }
    setAi({ status: 'loading' });
    try {
      const res = await enhanceCatalog(storeName, included);
      if (res.enabled || res.reason !== 'no-key') {
        applyResult(res);
      } else {
        setAi({ status: 'idle' }); // server has no key → ask the user for theirs
        setShowKeyModal(true);
      }
    } catch (e) {
      setAi({ status: 'off', reason: (e as Error).message });
    }
  }

  async function submitKey(key: string, remember: boolean) {
    setUserKey(key, remember);
    setUserKeyState(key);
    setShowKeyModal(false);
    setAi({ status: 'loading' });
    applyResult(await enhanceDirect(key, storeName, included));
  }

  function removeKey() {
    clearUserKey();
    setUserKeyState(null);
    setAi({ status: 'idle' });
  }

  // ---- save / load ---------------------------------------------------------
  function saveProject() {
    const data = JSON.stringify({ version: 1, config, products }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `${(config.title || 'catalog').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.catalog.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function loadProject(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        if (d.products) setProducts(d.products);
        if (d.config) setConfig(d.config);
        setSelKey(null);
      } catch {
        alert('That file is not a valid catalog project.');
      }
    };
    reader.readAsText(file);
  }

  const p = sel?.product;
  const idx = sel?.idx ?? 0;

  return (
    <div>
      <StepHeader
        title="Design your catalog"
        subtitle="Click any photo to reframe it. Set the cover, pricing and brand details, then preview live."
        onBack={onBack}
        onNext={onNext}
        nextLabel="Preview & export"
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-subtle text-xs" onClick={saveProject}>
          <Download width={14} height={14} /> Save project
        </button>
        <button className="btn-subtle text-xs" onClick={() => fileRef.current?.click()}>
          Load project
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && loadProject(e.target.files[0])}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Controls */}
        <div className="no-print space-y-4">
          {sel && (
            <EditorPanel
              sel={sel}
              onClose={() => setSelKey(null)}
              setFit={(fit) => p && setPhoto(p.id, idx, { fit })}
              setZoom={(zoom) => updateFrame(sel.key, (f) => ({ ...f, zoom }))}
              setBg={(bg) => p && setPhoto(p.id, idx, { bg })}
              resetFrame={() => resetFrame(sel.key)}
              swap={(src) => p && setPhoto(p.id, idx, { src, frame: undefined })}
              setLayout={(layout) => p && setProductField(p.id, { layout })}
              setPrice={(price) => p && setProductField(p.id, { price, priceOverridden: true })}
              setNote={(note) => p && setProductField(p.id, { note: note || null })}
            />
          )}

          {/* AI */}
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="text-brand" />
              <h3 className="text-sm font-semibold">AI review &amp; copywriting</h3>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-[#8a8880]">
              Cleans up messy titles, rewrites descriptions, and <b className="text-[#b9b6ae]">flags
              products where the fields look wrong or mismatched</b> so nothing odd slips into print.
            </p>
            <button className="btn-primary w-full" onClick={polish} disabled={ai.status === 'loading'}>
              {ai.status === 'loading' ? <Spinner /> : <Sparkles />}
              {ai.status === 'loading' ? 'Reviewing…' : 'Review & polish with AI'}
            </button>
            {ai.status === 'done' && (
              <div className="mt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check width={13} height={13} /> Polished {ai.count} products
                  {ai.renamed > 0 && `, cleaned ${ai.renamed} title${ai.renamed > 1 ? 's' : ''}`}.
                </p>
                {ai.warnings.length > 0 ? (
                  <div className="rounded-lg bg-amber-500/[0.07] p-2.5 ring-1 ring-amber-500/20">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
                      <Alert width={12} height={12} /> {ai.warnings.length} to review
                    </div>
                    <ul className="space-y-1.5">
                      {ai.warnings.map((w) => (
                        <li key={w.id}>
                          <button
                            onClick={() => setSelKey(`${w.id}:0`)}
                            className="w-full rounded-md px-2 py-1.5 text-left text-[12px] leading-snug transition hover:bg-amber-500/10"
                          >
                            <span className="block font-semibold text-amber-100/90">{w.name}</span>
                            <span className="block text-amber-300/80">{w.flag}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-[#6c6a64]">No field issues found — everything looks consistent.</p>
                )}
              </div>
            )}
            {ai.status === 'off' && (
              <div className="mt-2 text-xs text-amber-400/90">
                <p>AI unavailable: {ai.reason || 'unknown error'}.</p>
                <button className="btn-subtle mt-1 text-xs" onClick={() => setShowKeyModal(true)}>
                  {userKey ? 'Try a different key' : 'Add your Gemini key'}
                </button>
              </div>
            )}
            {userKey && (
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-[#6c6a64]">
                <span className="inline-flex items-center gap-1.5">
                  <Check width={12} height={12} className="text-emerald-500" /> Using your Gemini key
                </span>
                <span className="flex gap-2">
                  <button onClick={() => setShowKeyModal(true)} className="hover:text-[#b9b6ae]">Change</button>
                  <button onClick={removeKey} className="inline-flex items-center gap-0.5 hover:text-brand">
                    <X width={11} height={11} /> Remove
                  </button>
                </span>
              </div>
            )}
          </section>

          <Section title="Catalog details">
            <Field label="Title">
              <input className="field" value={config.title} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
            <Field label="Tagline / subtitle">
              <input className="field" value={config.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
            </Field>
            <Field label="Edition year">
              <input className="field" value={config.year} onChange={(e) => patch({ year: e.target.value })} />
            </Field>
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency symbol">
                <input className="field" value={config.currencySymbol} onChange={(e) => repriceWith({ currencySymbol: e.target.value })} />
              </Field>
              <Field label="Show decimals">
                <button
                  className={'field flex items-center justify-between ' + (config.currencyDecimals ? 'text-[#eceae4]' : 'text-[#8a8880]')}
                  onClick={() => repriceWith({ currencyDecimals: !config.currencyDecimals })}
                >
                  {config.currencyDecimals ? 'On (1,299.00)' : 'Off (1,299)'}
                </button>
              </Field>
            </div>
            <Field label="Tax / price note (optional)">
              <input className="field" placeholder="e.g. Incl. 18% GST" value={config.taxNote} onChange={(e) => repriceWith({ taxNote: e.target.value })} />
            </Field>
            <p className="text-[11px] text-[#6c6a64]">Changing currency re-prices every product except ones you’ve edited by hand.</p>
          </Section>

          <Section title="Accent colour">
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => patch({ accent: c })}
                  className={'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-ink-900 transition ' + (config.accent.toLowerCase() === c.toLowerCase() ? 'ring-white' : 'ring-transparent')}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-2 ring-transparent">
                <input type="color" value={config.accent} onChange={(e) => patch({ accent: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                <span className="grid h-full w-full place-items-center bg-gradient-to-br from-pink-500 via-yellow-400 to-cyan-400 text-[10px] font-bold text-black">+</span>
              </label>
            </div>
          </Section>

          <Section title="Cover &amp; back photos">
            <ImagePicker label="Cover photo" value={config.coverImage} options={included} onPick={(src) => patch({ coverImage: src, coverFrame: undefined })} />
            <ImagePicker label="Back photo" value={config.backImage} options={included} onPick={(src) => patch({ backImage: src, backFrame: undefined })} />
            <p className="text-[11px] text-[#6c6a64]">Tip: click the cover/back photo in the preview to pan &amp; zoom it.</p>
          </Section>

          <Section title="Contact (back page)">
            <Field label="Website">
              <input className="field" value={config.contact.website} onChange={(e) => patch({ contact: { ...config.contact, website: e.target.value } })} />
            </Field>
            <Field label="Email">
              <input className="field" value={config.contact.email} onChange={(e) => patch({ contact: { ...config.contact, email: e.target.value } })} />
            </Field>
            <Field label="Phone">
              <input className="field" value={config.contact.phone} onChange={(e) => patch({ contact: { ...config.contact, phone: e.target.value } })} />
            </Field>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 flex items-center gap-2 text-xs text-[#6c6a64]">
            <ImageIcon width={13} height={13} /> Live preview · {included.length + 2} pages · click a photo to edit
          </div>
          <CatalogViewport className="lg:h-[calc(100vh-9rem)]">
            <Catalog products={included} config={config} theme={theme} editor={editor} />
          </CatalogViewport>
        </div>
      </div>

      {showKeyModal && <KeyModal onSubmit={submitKey} onClose={() => setShowKeyModal(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="mb-3 text-sm font-semibold" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block label-xs">{label}</span>
      {children}
    </label>
  );
}

function ImagePicker({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | null;
  options: CatalogProduct[];
  onPick: (src: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of options) for (const src of p.allImages) if (!seen.has(src)) (seen.add(src), out.push(src));
    return out;
  }, [options]);

  return (
    <div>
      <span className="mb-1.5 block label-xs">{label}</span>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-lg bg-ink-900 p-2 ring-1 ring-white/10 hover:ring-white/20">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded bg-ink-800">
          {value && <img src={value} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="text-xs text-[#8a8880]">{open ? 'Choose below…' : 'Change photo'}</span>
      </button>
      {open && (
        <div className="mt-2 grid max-h-52 grid-cols-4 gap-1.5 overflow-auto rounded-lg bg-black/30 p-2 ring-1 ring-white/[0.06]">
          {all.map((src) => (
            <button
              key={src}
              onClick={() => {
                onPick(src);
                setOpen(false);
              }}
              className={'aspect-square overflow-hidden rounded ring-2 transition ' + (value === src ? 'ring-brand' : 'ring-transparent hover:ring-white/30')}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
