/**
 * Catálogo fictício da Loja por prova (somente mock local).
 * Sem persistência / sem Supabase.
 */

export type StoreMockVariant = {
  id: string;
  name: string;
  stock: number;
};

export type StoreMockProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  sort_order: number;
  /** Gradiente CSS para placeholder premium (sem assets externos). */
  imageTone: string;
  has_variants: boolean;
  /** Estoque sem variação (= variante "Padrão"). */
  stock: number | null;
  variants: StoreMockVariant[];
  /** YYYY-MM-DD opcional — antes disso: "Disponível em breve". */
  sale_starts_at: string | null;
  /** YYYY-MM-DD opcional — depois disso: "Vendas encerradas". */
  sale_ends_at: string | null;
};

export type StoreMockCartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type StoreMockSaleStatus = "open" | "upcoming" | "ended" | "inactive";

export const STORE_MOCK_FULFILLMENT =
  "Retirada junto à entrega do kit, antes da prova.";

export const STORE_MOCK_PAYMENT_NOTE =
  "Os produtos desta prova utilizam a mesma configuração de pagamento do organizador responsável pelo evento.";

export const STORE_MOCK_FULFILLMENT_SHORT =
  "junto à entrega do kit, antes da prova";

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export const storeMockTodayISO = (d = new Date()) => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
};

export const formatStoreMockDateBR = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

/** dd/mm (sem ano) — ex. "Compre até 10/10". */
export const formatStoreMockDateShort = (iso: string | null | undefined) => {
  const full = formatStoreMockDateBR(iso);
  if (!full) return "";
  return full.slice(0, 5);
};

export const storeMockSaleStatus = (
  product: StoreMockProduct,
  today = storeMockTodayISO(),
): StoreMockSaleStatus => {
  if (!product.active) return "inactive";
  const start = product.sale_starts_at?.slice(0, 10) || null;
  const end = product.sale_ends_at?.slice(0, 10) || null;
  if (start && today < start) return "upcoming";
  if (end && today > end) return "ended";
  return "open";
};

/**
 * Escassez verdadeira (estoque real):
 * >10 → sem mensagem
 * 4–10 → "Só X disponíveis"
 * 1–3 → "Últimas X unidades"
 * 0 → "Esgotado"
 */
export const storeMockScarcityLabel = (stock: number): string | null => {
  const n = Math.max(0, Math.floor(Number(stock) || 0));
  if (n <= 0) return "Esgotado";
  if (n <= 3) return `Últimas ${n} unidades`;
  if (n <= 10) return `Só ${n} disponíveis`;
  return null;
};

/** Label por tamanho no seletor. */
export const storeMockVariantStockLabel = (stock: number): string => {
  const n = Math.max(0, Math.floor(Number(stock) || 0));
  if (n <= 0) return "esgotado";
  if (n <= 3) return `últimas ${n} unidades`;
  if (n <= 10) return `${n} disponíveis`;
  return "disponível";
};

export const initialStoreMockCatalog = (): StoreMockProduct[] => [
  {
    id: "mock-viseira",
    name: "Viseira Oficial Trail Run",
    description: "Viseira leve com ajuste, ideal para treinos e prova.",
    price: 39.9,
    active: true,
    sort_order: 1,
    imageTone: "from-emerald-900/80 via-emerald-800/40 to-zinc-900",
    has_variants: false,
    stock: 7,
    variants: [],
    sale_starts_at: null,
    sale_ends_at: "2026-10-10",
  },
  {
    id: "mock-camiseta",
    name: "Camiseta Oficial da Prova",
    description: "Camiseta dry-fit com arte exclusiva da prova.",
    price: 69.9,
    active: true,
    sort_order: 2,
    imageTone: "from-sky-950/90 via-brand/20 to-zinc-900",
    has_variants: true,
    stock: null,
    variants: [
      { id: "mock-cam-p", name: "P", stock: 4 },
      { id: "mock-cam-m", name: "M", stock: 2 },
      { id: "mock-cam-g", name: "G", stock: 6 },
      { id: "mock-cam-gg", name: "GG", stock: 0 },
    ],
    sale_starts_at: null,
    sale_ends_at: "2026-10-10",
  },
  {
    id: "mock-meia",
    name: "Meia Performance",
    description: "Meia cano médio com compressão suave.",
    price: 29.9,
    active: true,
    sort_order: 3,
    imageTone: "from-amber-950/70 via-stone-800/40 to-zinc-900",
    has_variants: false,
    stock: 15,
    variants: [],
    sale_starts_at: null,
    sale_ends_at: "2026-10-10",
  },
];

export const storeMockRawStock = (
  product: StoreMockProduct,
  variantId: string | null,
): number => {
  if (product.has_variants) {
    const v = product.variants.find((x) => x.id === variantId);
    return Math.max(0, v?.stock ?? 0);
  }
  return Math.max(0, product.stock ?? 0);
};

export const storeMockAvailableStock = (
  product: StoreMockProduct,
  variantId: string | null,
): number => {
  if (!product.active) return 0;
  if (storeMockSaleStatus(product) !== "open") return 0;
  return storeMockRawStock(product, variantId);
};

export const storeMockTotalUnits = (product: StoreMockProduct): number => {
  if (product.has_variants) {
    return product.variants.reduce((s, v) => s + (v.stock || 0), 0);
  }
  return product.stock ?? 0;
};

export const storeMockLineLabel = (
  product: StoreMockProduct,
  variantId: string | null,
): string => {
  if (!product.has_variants || !variantId) return product.name;
  const v = product.variants.find((x) => x.id === variantId);
  return v ? `${product.name} — ${v.name}` : product.name;
};

export const storeMockCartProductsAmount = (
  catalog: StoreMockProduct[],
  cart: StoreMockCartLine[],
): number => {
  let sum = 0;
  for (const line of cart) {
    const p = catalog.find((x) => x.id === line.productId);
    if (!p || !p.active) continue;
    sum += p.price * line.quantity;
  }
  return Math.round(sum * 100) / 100;
};

/** Resumo visual fixo para Minha Conta (não depende do carrinho da inscrição). */
export const STORE_MOCK_ACCOUNT_DEMO = {
  registration: 89.9,
  products: 109.8,
  total: 199.7,
  items: [
    {
      id: "demo-viseira",
      name: "Viseira Oficial Trail Run",
      variant_name: null as string | null,
      quantity: 1,
      unit_price: 39.9,
      line_total: 39.9,
      imageTone: "from-emerald-900/80 via-emerald-800/40 to-zinc-900",
      fulfillment_type: "kit_pickup",
      fulfillment_note: STORE_MOCK_FULFILLMENT_SHORT,
    },
    {
      id: "demo-camiseta",
      name: "Camiseta Oficial da Prova",
      variant_name: "M",
      quantity: 1,
      unit_price: 69.9,
      line_total: 69.9,
      imageTone: "from-sky-950/90 via-brand/20 to-zinc-900",
      fulfillment_type: "kit_pickup",
      fulfillment_note: STORE_MOCK_FULFILLMENT_SHORT,
    },
  ],
};

/** Converte carrinho mock → itens do componente compartilhado. */
export const storeMockCartToAcquiredItems = (
  catalog: StoreMockProduct[],
  cart: StoreMockCartLine[],
) => {
  const items: {
    id: string;
    name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
    imageTone: string;
    fulfillment_type: string;
    fulfillment_note: string;
  }[] = [];
  for (const line of cart) {
    const p = catalog.find((x) => x.id === line.productId);
    if (!p) continue;
    const variant = line.variantId
      ? p.variants.find((v) => v.id === line.variantId)
      : null;
    items.push({
      id: `${line.productId}:${line.variantId ?? "default"}`,
      name: p.name,
      variant_name: variant?.name ?? null,
      quantity: line.quantity,
      unit_price: p.price,
      line_total: Math.round(p.price * line.quantity * 100) / 100,
      imageTone: p.imageTone,
      fulfillment_type: "kit_pickup",
      fulfillment_note: STORE_MOCK_FULFILLMENT_SHORT,
    });
  }
  return items;
};
