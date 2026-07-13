// ---- Raw Shopify shapes (subset of the public products.json we consume) ----

export interface ShopifyImage {
  src: string;
  width: number;
  height: number;
}

export interface ShopifyVariant {
  title: string;
  sku: string | null;
  price: string; // plain decimal string, e.g. "14600.00"
  available: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface ShopifyOption {
  name: string;
  values: string[];
}

export interface ShopifyProduct {
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  options: ShopifyOption[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ScrapeResult {
  shopName: string;
  currency: string | null;
  origin: string;
  collection: string | null;
  productCount: number;
  products: ShopifyProduct[];
}

// ---- Renderer-facing structured product (mirrors the blueprint's dict) ----

export type PhotoFit = 'cover' | 'contain';
export type PhotoLayout = 'one' | 'two' | 'three';

/** Pan/zoom reframe applied as `translate(x%,y%) scale(zoom)` on the <img>.
 * x/y are percentages of the frame; scale-invariant so preview === print. */
export interface PhotoFrame {
  zoom: number; // >= 1
  x: number; // -.. .. percent
  y: number;
}

export interface CatalogPhoto {
  src: string;
  fit: PhotoFit;
  bg?: string; // letterbox background behind a 'contain' shot (default white)
  frame?: PhotoFrame; // pan/zoom reframe
}

export interface SpecRow {
  key: string;
  val: string;
  sub: string | null;
}

export interface CatalogProduct {
  id: string; // stable = handle
  name: string; // display name, shared suffix stripped
  tag: string | null; // trailing (parenthetical) badge, e.g. "ADAS COMPATIBLE"
  fullTitle: string;
  url: string;
  priceValue: number; // lowest variant price, numeric (for re-formatting on currency change)
  hasRange: boolean; // multiple distinct variant prices
  price: string; // formatted, lowest variant price (may be user-overridden)
  priceSub: string; // "From · <note>" or just the note
  priceOverridden: boolean; // user set price manually — skip auto re-formatting
  desc: string; // flattened description (raw or AI-polished)
  rawDesc: string; // always the store's original, for the AI to rewrite from
  specs: SpecRow[];
  note: string | null;
  images: CatalogPhoto[]; // the chosen (up to 3) photos, in display order
  allImages: string[]; // every source image, for swapping in the editor
  layout: PhotoLayout | null; // null = auto from image count
  mainIndex: number; // which image is the hero in the 3-up bento
  included: boolean; // user toggle in Curate step
}

// ---- Catalog-level config the user controls in the Design step ----

export interface CatalogConfig {
  title: string; // cover headline
  subtitle: string; // cover sub / tagline
  coverImage: string | null; // src
  coverFrame?: PhotoFrame; // pan/zoom for the cover photo
  backImage: string | null; // src
  backFrame?: PhotoFrame; // pan/zoom for the back photo
  currencySymbol: string;
  currencyDecimals: boolean; // show cents
  taxNote: string; // e.g. "Incl. 18% GST", or ""
  accent: string; // hex, theme accent
  themeId: string;
  contact: {
    website: string;
    email: string;
    phone: string;
  };
  year: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  tokens: {
    bg: string;
    panel: string;
    ink: string;
    grey: string;
    accent: string; // overridden by config.accent at render time
    hairline: string;
    hairlineSoft: string;
  };
  displayFont: string; // headlines / prices
  bodyFont: string; // body text, spec tables
}
