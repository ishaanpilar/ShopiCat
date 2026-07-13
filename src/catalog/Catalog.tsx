import { useMemo, useRef, type CSSProperties } from 'react';
import type { CatalogConfig, CatalogProduct, PhotoFrame, Theme } from '../types';
import { themeVars } from '../lib/themes';
import './catalog.css';

const CONTENTS_ROWS_PER_PAGE = 16; // empirically the most that fit one A4 contents page

/** Shopify CDN supports on-the-fly resizing — keep print sharp without huge files. */
function sized(src: string, w: number): string {
  if (!/shopify/i.test(src)) return src;
  return src.includes('?') ? `${src}&width=${w}` : `${src}?width=${w}`;
}

export interface CatalogEditor {
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onPan: (key: string, dxPct: number, dyPct: number) => void;
}

function frameStyle(frame?: PhotoFrame): CSSProperties | undefined {
  if (!frame) return undefined;
  return { transform: `translate(${frame.x}%, ${frame.y}%) scale(${frame.zoom})`, transformOrigin: 'center' };
}

function PriceAmount({ price }: { price: string }) {
  // Split the currency symbol into its own span (the display font may lack the
  // glyph — the blueprint's Rupee gotcha). The .cur span uses --body instead.
  const m = price.match(/^([^\d]+)/);
  if (m) return (<><span className="cur">{m[1]}</span>{price.slice(m[1].length)}</>);
  return <>{price}</>;
}

function Photo({
  src,
  fit,
  bg,
  frame,
  w = 1000,
  extra = '',
  editorKey,
  editor,
}: {
  src: string;
  fit?: 'cover' | 'contain';
  bg?: string;
  frame?: PhotoFrame;
  w?: number;
  extra?: string;
  editorKey?: string;
  editor?: CatalogEditor;
}) {
  const dragging = useRef(false);
  const interactive = !!(editor && editorKey);
  const selected = interactive && editor!.selectedKey === editorKey;
  const cls =
    'photobox' + (fit === 'contain' ? ' contain' : '') + (extra ? ' ' + extra : '') +
    (interactive ? ' editable' : '') + (selected ? ' selected' : '');
  const boxStyle: CSSProperties | undefined = fit === 'contain' && bg ? { background: bg } : undefined;

  return (
    <div
      className={cls}
      style={boxStyle}
      onPointerDown={
        interactive
          ? (e) => {
              editor!.onSelect(editorKey!);
              dragging.current = true;
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* ignore — synthetic/absent pointer */
              }
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e) => {
              if (!dragging.current) return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              editor!.onPan(editorKey!, (e.movementX / r.width) * 100, (e.movementY / r.height) * 100);
            }
          : undefined
      }
      onPointerUp={
        interactive
          ? (e) => {
              dragging.current = false;
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }
          : undefined
      }
    >
      <img src={sized(src, w)} alt="" loading="eager" decoding="sync" draggable={false} style={frameStyle(frame)} />
    </div>
  );
}

interface Props {
  products: CatalogProduct[]; // already filtered to included + ordered
  config: CatalogConfig;
  theme: Theme;
  editor?: CatalogEditor; // present = interactive editing enabled
}

export default function Catalog({ products, config, theme, editor }: Props) {
  const brand = config.contact.website || config.title;
  const contentsPageCount = Math.max(1, Math.ceil(products.length / CONTENTS_ROWS_PER_PAGE));
  const totalPages = products.length + 2 + contentsPageCount;

  const Head = ({ pageNo, right }: { pageNo: number; right?: string }) => (
    <div className="head">
      <div className="brand">{brand}</div>
      <div className="h-meta" dangerouslySetInnerHTML={{ __html: right ?? `Page <b>${pad(pageNo)}</b> / ${totalPages}` }} />
    </div>
  );

  const Foot = ({ pageNo, left }: { pageNo: number; left: string }) => (
    <div className="foot">
      <div>{left}</div>
      <div className="pageno"><span>{pad(pageNo)}</span> / {totalPages}</div>
    </div>
  );

  const cover = (
    <section className="page cover" key="cover">
      <div className="cover-frame" />
      <div className="head">
        <div className="brand">{brand}</div>
        <div className="h-meta">Product Catalog · {config.year}</div>
      </div>
      <div className="label" style={{ marginTop: '9mm' }}>{config.subtitle || 'Product Catalog'}</div>
      <div className="cover-title">{config.title}<span className="red">.</span></div>
      <div className="cover-sub">{products.length} Products · {config.year} Edition</div>
      <div className="cover-info">
        <div className="ci"><div className="ck">Products</div><div className="cv">{products.length} Listed</div></div>
        <div className="ci"><div className="ck">Edition</div><div className="cv">{config.year}</div></div>
        <div className="ci"><div className="ck">Format</div><div className="cv">A4 Print</div></div>
      </div>
      <div className="cover-photo">
        {config.coverImage ? (
          <Photo src={config.coverImage} fit="cover" w={1400} frame={config.coverFrame} editorKey="__cover__" editor={editor} />
        ) : (
          <div className="photobox" />
        )}
      </div>
      <div className="cover-foot">
        <div className="meta">{config.contact.website}</div>
        <div className="meta">{config.contact.email}</div>
      </div>
    </section>
  );

  const contentsPages = useMemo(() => {
    const pages = [];
    for (let cp = 0; cp < contentsPageCount; cp++) {
      const start = cp * CONTENTS_ROWS_PER_PAGE;
      const chunk = products.slice(start, start + CONTENTS_ROWS_PER_PAGE);
      const pageNo = 2 + cp;
      pages.push(
        <section className="page" key={`toc-${cp}`}>
          <Head pageNo={pageNo} />
          <div className="label" style={{ marginTop: '8mm' }}>Contents</div>
          <div className="toc-title">Product Index</div>
          <div className="toc">
            {chunk.map((p, j) => {
              const idx = start + j;
              const pageOf = idx + 2 + contentsPageCount;
              const priceLabel = p.priceSub.startsWith('From') ? `${p.price} +` : p.price;
              return (
                <div className="toc-row" key={p.id}>
                  <div className="idx">{pad(idx + 1)}</div>
                  <div className="tname">{p.name}</div>
                  <div className="tprice">{priceLabel}</div>
                  <div className="tpage">{pad(pageOf)}</div>
                </div>
              );
            })}
          </div>
          {cp === contentsPageCount - 1 && config.taxNote && (
            <div className="foot-note">{config.taxNote} · Prices as of catalog print date</div>
          )}
          <Foot pageNo={pageNo} left={`${config.title} · Product Range`} />
        </section>,
      );
    }
    return pages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, contentsPageCount, config.taxNote, config.title, config.year, totalPages, brand]);

  const productPages = products.map((p, i) => {
    const pageNo = i + 2 + contentsPageCount;
    const imgs = p.images;
    const layout = p.layout ?? (imgs.length >= 3 ? 'three' : imgs.length === 2 ? 'two' : 'one');
    const photo = (k: number, extra = '') => (
      <Photo
        key={k}
        src={imgs[k].src}
        fit={imgs[k].fit}
        bg={imgs[k].bg}
        frame={imgs[k].frame}
        extra={extra}
        editorKey={`${p.id}:${k}`}
        editor={editor}
      />
    );

    let photos;
    if (layout === 'three' && imgs.length >= 3) {
      const order = [p.mainIndex, ...[0, 1, 2].filter((k) => k !== p.mainIndex)];
      photos = (
        <div className="product-photos three">
          {photo(order[0], 'main')}
          {photo(order[1])}
          {photo(order[2])}
        </div>
      );
    } else if (layout === 'one' || imgs.length < 2) {
      photos = <div className="product-photos one">{photo(0)}</div>;
    } else {
      photos = <div className="product-photos two">{photo(0)}{photo(1)}</div>;
    }

    return (
      <section className="page" key={p.id}>
        <Head pageNo={pageNo} />
        <div className="p-head">
          <div>
            <div className="label">Product {pad(i + 1)} / {products.length}</div>
            <div className="p-title">{p.name}</div>
            <div className="p-vehicle">{config.title}{p.tag && <span className="tag">{p.tag}</span>}</div>
          </div>
          <div className="p-price">
            <div className="amount"><PriceAmount price={p.price} /></div>
            {p.priceSub && <div className="sub">{p.priceSub}</div>}
          </div>
        </div>
        {p.desc && <p className="p-desc">{p.desc}</p>}
        {p.specs.length > 0 && (
          <div className="spec-table">
            {p.specs.map((s, j) => (
              <div className="srow" key={j}>
                <div className="idx">{pad(j + 1)}</div>
                <div className="key">{s.key}</div>
                <div className="val">{s.val}{s.sub && <span className="vsub">{s.sub}</span>}</div>
              </div>
            ))}
          </div>
        )}
        {photos}
        {p.note && <div className="foot-note">{p.note}</div>}
        <Foot pageNo={pageNo} left={p.name} />
      </section>
    );
  });

  const back = (
    <section className="page back" key="back">
      <Head pageNo={totalPages} />
      <div className="label" style={{ marginTop: '8mm' }}>Orders &amp; Enquiries</div>
      <div className="back-title">Get In Touch<span className="red">.</span></div>
      <div className="contact-table">
        {config.contact.website && (<div className="crow"><div className="ck">Web</div><div className="cv">{config.contact.website}</div></div>)}
        {config.contact.email && (<div className="crow"><div className="ck">Mail</div><div className="cv">{config.contact.email}</div></div>)}
        {config.contact.phone && (<div className="crow"><div className="ck">Tel</div><div className="cv">{config.contact.phone}</div></div>)}
      </div>
      <div className="etp"><span>#</span>{slug(config.title)}{config.year}</div>
      <div className="back-photo">
        {config.backImage ? (
          <Photo src={config.backImage} fit="cover" w={1400} frame={config.backFrame} editorKey="__back__" editor={editor} />
        ) : (
          <div className="photobox" />
        )}
      </div>
      <Foot pageNo={totalPages} left={config.contact.website || 'Catalog'} />
    </section>
  );

  return (
    <div className="catalog-root" style={themeVars(theme, config.accent)}>
      {cover}
      {contentsPages}
      {productPages}
      {back}
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '') || 'Catalog';
}
