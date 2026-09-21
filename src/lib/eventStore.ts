/**
 * Loja por prova — helpers de catálogo (Supabase real).
 * Sem seed automático. Sem criação de pedidos nesta fase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isEventStoreAdminEnabled, isEventStorePublicEnabled } from "@/lib/eventStoreDev";

export type EventStoreVariant = {
  id: string;
  product_id: string;
  name: string;
  stock_quantity: number | null;
  price_override: number | null;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type EventStoreProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
};

export type EventStoreProduct = {
  id: string;
  event_id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  active: boolean;
  sort_order: number;
  has_variants: boolean;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  created_at?: string;
  updated_at?: string;
  variants: EventStoreVariant[];
  images: EventStoreProductImage[];
};

export const EVENT_STORE_MAX_IMAGES = 6;

export type EventStoreAvailabilityRow = {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  unit_price: number;
  stock_quantity: number | null;
  reserved_quantity: number;
  available_quantity: number | null;
  unlimited: boolean;
  active: boolean;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
};

const DEFAULT_SIZE_NAMES = ["P", "M", "G", "GG"] as const;

/** YYYY-MM-DD no fuso America/Sao_Paulo a partir de timestamptz ISO. */
export function eventStoreIsoToDateInput(
  iso: string | null | undefined,
): string {
  if (!iso) return "";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Início do dia (SP) → timestamptz ISO. Aceita só YYYY-MM-DD válido. */
export function eventStoreDateInputToStartISO(
  date: string | null | undefined,
): string | null {
  const d = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  // Offset fixo America/Sao_Paulo (sem horário de verão desde 2019)
  return `${d}T00:00:00.000-03:00`;
}

/** Fim do dia (SP) → timestamptz ISO. Aceita só YYYY-MM-DD válido. */
export function eventStoreDateInputToEndISO(
  date: string | null | undefined,
): string | null {
  const d = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return `${d}T23:59:59.999-03:00`;
}

export function formatEventStoreDateBR(
  iso: string | null | undefined,
): string {
  const ymd = eventStoreIsoToDateInput(iso);
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Soma visual de estoque (null = ilimitado). */
export function eventStoreStockSummary(variants: EventStoreVariant[]): {
  label: string;
  total: number | null;
  unlimited: boolean;
} {
  const active = variants.filter((v) => v.active);
  if (active.length === 0) {
    return { label: "Sem variantes", total: 0, unlimited: false };
  }
  const allUnlimited = active.every((v) => v.stock_quantity == null);
  if (allUnlimited) {
    return { label: "Ilimitado", total: null, unlimited: true };
  }
  const finite = active.filter((v) => v.stock_quantity != null);
  const total = finite.reduce((s, v) => s + (v.stock_quantity ?? 0), 0);
  const hasUnlimited = active.some((v) => v.stock_quantity == null);
  if (hasUnlimited) {
    return {
      label: `${total} ${total === 1 ? "unidade" : "unidades"} · +ilimitado`,
      total,
      unlimited: false,
    };
  }
  return {
    label: `${total} ${total === 1 ? "unidade" : "unidades"}`,
    total,
    unlimited: false,
  };
}

export function defaultSizeVariantDrafts(): Omit<
  EventStoreVariant,
  "id" | "product_id"
>[] {
  return DEFAULT_SIZE_NAMES.map((name, i) => ({
    name,
    stock_quantity: 0,
    price_override: null,
    active: true,
    sort_order: i,
  }));
}

export async function fetchEventStoreProducts(
  eventId: string,
): Promise<EventStoreProduct[]> {
  const withImages = await supabase
    .from("event_store_products")
    .select(
      "*, event_store_product_variants(*), event_store_product_images(*)",
    )
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  // Migration 19 ainda não aplicada → fallback sem galeria
  const result =
    withImages.error &&
    /event_store_product_images/i.test(withImages.error.message)
      ? await supabase
          .from("event_store_products")
          .select("*, event_store_product_variants(*)")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      : withImages;

  if (result.error) throw result.error;

  return (result.data ?? []).map((row: any) => {
    const variants = (
      (row.event_store_product_variants ?? []) as EventStoreVariant[]
    )
      .slice()
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
    let images = (
      (row.event_store_product_images ?? []) as EventStoreProductImage[]
    )
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    // Retrocompat: se há capa e a galeria está vazia, expõe a capa como única.
    if (
      images.length === 0 &&
      row.image_url &&
      String(row.image_url).trim()
    ) {
      images = [
        {
          id: `legacy-cover-${row.id}`,
          product_id: row.id,
          image_url: row.image_url,
          sort_order: 0,
        },
      ];
    }

    const {
      event_store_product_variants: _v,
      event_store_product_images: _i,
      ...product
    } = row;
    return { ...product, variants, images } as EventStoreProduct;
  });
}

export async function fetchEventStoreAvailability(
  eventId: string,
): Promise<EventStoreAvailabilityRow[]> {
  const { data, error } = await supabase.rpc("get_event_store_availability", {
    _event_id: eventId,
  });
  if (error) throw error;
  return (data ?? []) as EventStoreAvailabilityRow[];
}

/** Preparado para checkout futuro — não cria pedido. */
export function useEventStoreAvailability(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event_store_availability", eventId],
    enabled: !!eventId && isEventStoreAdminEnabled(),
    queryFn: () => fetchEventStoreAvailability(eventId!),
  });
}

export function useEventStoreProducts(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin_event_store_products", eventId],
    enabled: !!eventId && isEventStoreAdminEnabled(),
    queryFn: () => fetchEventStoreProducts(eventId!),
  });
}

export type SaveEventStoreProductInput = {
  id?: string;
  event_id: string;
  name: string;
  description: string;
  image_url: string | null;
  price: number;
  active: boolean;
  sort_order: number;
  has_variants: boolean;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  /** Estoque da variante Padrão quando !has_variants (null = ilimitado). */
  default_stock: number | null;
  variants: {
    id?: string;
    name: string;
    stock_quantity: number | null;
    price_override: number | null;
    active: boolean;
    sort_order: number;
  }[];
  /** Galeria (máx. 6). A capa é a de is_cover=true (ou a primeira). */
  images: {
    id?: string;
    image_url: string;
    sort_order: number;
    is_cover: boolean;
  }[];
};

/**
 * Cria/atualiza produto + sincroniza variantes e galeria.
 * Variantes removidas do form: desativadas (sem hard delete).
 * Imagens removidas do form: hard delete na galeria (não afetam pedidos).
 */
export async function saveEventStoreProduct(
  input: SaveEventStoreProductInput,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome do produto.");
  if (input.price < 0) throw new Error("Preço inválido.");

  const gallery = (input.images ?? [])
    .map((img, i) => ({
      ...img,
      image_url: String(img.image_url ?? "").trim(),
      sort_order: img.sort_order ?? i,
    }))
    .filter((img) => img.image_url.length > 0)
    .slice(0, EVENT_STORE_MAX_IMAGES);

  if (gallery.length > EVENT_STORE_MAX_IMAGES) {
    throw new Error(`No máximo ${EVENT_STORE_MAX_IMAGES} imagens por produto.`);
  }

  const cover =
    gallery.find((g) => g.is_cover)?.image_url ||
    gallery[0]?.image_url ||
    input.image_url?.trim() ||
    null;

  // Capa primeiro no sort_order persistido
  const ordered = (() => {
    if (!gallery.length) return [];
    const coverUrl = cover;
    const coverIdx = gallery.findIndex((g) => g.image_url === coverUrl);
    if (coverIdx <= 0) {
      return gallery.map((g, i) => ({ ...g, sort_order: i, is_cover: i === 0 }));
    }
    const next = [...gallery];
    const [c] = next.splice(coverIdx, 1);
    next.unshift(c);
    return next.map((g, i) => ({ ...g, sort_order: i, is_cover: i === 0 }));
  })();

  const productPayload = {
    event_id: input.event_id,
    name,
    description: input.description.trim(),
    image_url: cover,
    price: input.price,
    active: input.active,
    sort_order: input.sort_order,
    has_variants: input.has_variants,
    sale_starts_at: input.sale_starts_at,
    sale_ends_at: input.sale_ends_at,
  };

  let productId = input.id;

  if (productId) {
    const { error } = await supabase
      .from("event_store_products")
      .update(productPayload)
      .eq("id", productId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("event_store_products")
      .insert(productPayload)
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
  }

  const { data: existingVariants, error: loadErr } = await supabase
    .from("event_store_product_variants")
    .select("*")
    .eq("product_id", productId);
  if (loadErr) throw loadErr;

  const existing = (existingVariants ?? []) as EventStoreVariant[];
  const keepIds = new Set<string>();

  const desired = input.has_variants
    ? input.variants
        .map((v, i) => ({
          ...v,
          name: v.name.trim() || `Opção ${i + 1}`,
          sort_order: v.sort_order ?? i,
        }))
        .filter((v) => v.name.length > 0)
    : [
        {
          id: existing.find(
            (v) => v.name.trim().toLowerCase() === "padrão",
          )?.id,
          name: "Padrão",
          stock_quantity: input.default_stock,
          price_override: null as number | null,
          active: true,
          sort_order: 0,
        },
      ];

  if (desired.length === 0) {
    throw new Error("Informe ao menos uma variante.");
  }

  for (const v of desired) {
    const row = {
      product_id: productId!,
      name: v.name,
      stock_quantity: v.stock_quantity,
      price_override: v.price_override,
      active: v.active !== false,
      sort_order: v.sort_order,
    };

    if (v.id) {
      const { error } = await supabase
        .from("event_store_product_variants")
        .update(row)
        .eq("id", v.id)
        .eq("product_id", productId!);
      if (error) throw error;
      keepIds.add(v.id);
    } else {
      const { data, error } = await supabase
        .from("event_store_product_variants")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      keepIds.add(data.id);
    }
  }

  // Variantes fora do formulário: desativar (preserva histórico / FKs)
  for (const old of existing) {
    if (!keepIds.has(old.id) && old.active) {
      const { error } = await supabase
        .from("event_store_product_variants")
        .update({ active: false })
        .eq("id", old.id);
      if (error) throw error;
    }
  }

  // Galeria: upsert + delete das removidas (ids reais; ignora legacy-cover-*)
  const { data: existingImages, error: imgLoadErr } = await supabase
    .from("event_store_product_images")
    .select("*")
    .eq("product_id", productId);
  if (imgLoadErr) throw imgLoadErr;

  const existingImgs = (existingImages ?? []) as EventStoreProductImage[];
  const keepImageIds = new Set<string>();

  for (const img of ordered) {
    const realId =
      img.id && !String(img.id).startsWith("legacy-cover-")
        ? img.id
        : undefined;
    const row = {
      product_id: productId!,
      image_url: img.image_url,
      sort_order: img.sort_order,
    };
    if (realId) {
      const { error } = await supabase
        .from("event_store_product_images")
        .update(row)
        .eq("id", realId)
        .eq("product_id", productId!);
      if (error) throw error;
      keepImageIds.add(realId);
    } else {
      const { data, error } = await supabase
        .from("event_store_product_images")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      keepImageIds.add(data.id);
    }
  }

  for (const old of existingImgs) {
    if (!keepImageIds.has(old.id)) {
      const { error } = await supabase
        .from("event_store_product_images")
        .delete()
        .eq("id", old.id);
      if (error) throw error;
    }
  }

  return productId!;
}

export async function setEventStoreProductActive(
  productId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("event_store_products")
    .update({ active })
    .eq("id", productId);
  if (error) throw error;
}

export async function uploadEventStoreProductImage(
  eventId: string,
  file: File,
): Promise<string> {
  const BUCKET = "corporacao-bucket";
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `events/store-products/${eventId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ─── Catálogo público (inscrição) ───────────────────────────────────────────

export type EventStoreCartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};

export type EventStoreCatalogVariant = {
  id: string;
  name: string;
  unit_price: number;
  available_quantity: number | null;
  unlimited: boolean;
  active: boolean;
};

export type EventStoreCatalogProduct = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  /** Galeria ordenada (capa primeiro). */
  image_urls: string[];
  has_variants: boolean;
  sort_order: number;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  variants: EventStoreCatalogVariant[];
};

export type EventStoreSaleStatus = "open" | "upcoming" | "ended";

export function eventStoreSaleStatus(
  saleStartsAt: string | null | undefined,
  saleEndsAt: string | null | undefined,
  now = new Date(),
): EventStoreSaleStatus {
  if (saleStartsAt) {
    const start = new Date(saleStartsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return "upcoming";
  }
  if (saleEndsAt) {
    const end = new Date(saleEndsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return "ended";
  }
  return "open";
}

/** Escassez a partir de available_quantity real (null/unlimited → sem msg). */
export function eventStoreScarcityLabel(
  available: number | null | undefined,
  unlimited?: boolean,
): string | null {
  if (unlimited || available == null) return null;
  const n = Math.max(0, Math.floor(Number(available) || 0));
  if (n <= 0) return "Esgotado";
  if (n <= 3) return `Últimas ${n} unidades`;
  if (n <= 10) return `Só ${n} disponíveis`;
  return null;
}

export function eventStoreVariantStockLabel(
  available: number | null | undefined,
  unlimited?: boolean,
): string {
  if (unlimited || available == null) return "disponível";
  const n = Math.max(0, Math.floor(Number(available) || 0));
  if (n <= 0) return "esgotado";
  if (n <= 3) return `últimas ${n} unidades`;
  if (n <= 10) return `${n} disponíveis`;
  return "disponível";
}

export function eventStoreVariantRemaining(
  v: EventStoreCatalogVariant,
): number | null {
  if (v.unlimited || v.available_quantity == null) return null;
  return Math.max(0, Math.floor(v.available_quantity));
}

export function eventStoreMaxQty(v: EventStoreCatalogVariant | undefined): number {
  if (!v) return 0;
  if (v.unlimited || v.available_quantity == null) return 999;
  return Math.max(0, Math.floor(v.available_quantity));
}

export async function fetchEventStoreSignupCatalog(
  eventId: string,
): Promise<EventStoreCatalogProduct[]> {
  const [availability, products] = await Promise.all([
    fetchEventStoreAvailability(eventId),
    fetchEventStoreProducts(eventId),
  ]);

  const byProduct = new Map<string, EventStoreAvailabilityRow[]>();
  for (const row of availability) {
    if (!row.active) continue;
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  const out: EventStoreCatalogProduct[] = [];
  for (const p of products) {
    if (!p.active) continue;
    const rows = byProduct.get(p.id);
    if (!rows?.length) continue;

    const variants: EventStoreCatalogVariant[] = rows.map((r) => ({
      id: r.variant_id,
      name: r.variant_name,
      unit_price: Number(r.unit_price) || 0,
      available_quantity: r.available_quantity,
      unlimited: r.unlimited === true,
      active: r.active === true,
    }));

    // Prefer sale window from availability row (same product)
    const sale_starts_at =
      rows[0]?.sale_starts_at ?? p.sale_starts_at ?? null;
    const sale_ends_at = rows[0]?.sale_ends_at ?? p.sale_ends_at ?? null;

    const galleryUrls = (p.images ?? [])
      .map((img) => String(img.image_url ?? "").trim())
      .filter(Boolean);
    const cover = (p.image_url ?? "").trim() || galleryUrls[0] || null;
    const image_urls = (() => {
      if (!cover) return galleryUrls;
      const rest = galleryUrls.filter((u) => u !== cover);
      return [cover, ...rest];
    })();

    out.push({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      image_url: cover,
      image_urls,
      has_variants: p.has_variants,
      sort_order: p.sort_order ?? 0,
      sale_starts_at,
      sale_ends_at,
      variants,
    });
  }

  out.sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"),
  );
  return out;
}

export function useEventStoreSignupCatalog(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event_store_signup_catalog", eventId],
    enabled: !!eventId && isEventStorePublicEnabled(),
    queryFn: () => fetchEventStoreSignupCatalog(eventId!),
  });
}

export function eventStoreCartProductsAmount(
  catalog: EventStoreCatalogProduct[],
  cart: EventStoreCartLine[],
): number {
  let sum = 0;
  for (const line of cart) {
    const p = catalog.find((x) => x.id === line.productId);
    const v = p?.variants.find((x) => x.id === line.variantId);
    if (!p || !v) continue;
    sum += v.unit_price * line.quantity;
  }
  return Math.round(sum * 100) / 100;
}

export function eventStoreCartToAcquiredItems(
  catalog: EventStoreCatalogProduct[],
  cart: EventStoreCartLine[],
) {
  const items: {
    id: string;
    name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
    image: string | null;
    fulfillment_type: string;
    fulfillment_note: string;
  }[] = [];

  for (const line of cart) {
    const p = catalog.find((x) => x.id === line.productId);
    const v = p?.variants.find((x) => x.id === line.variantId);
    if (!p || !v) continue;
    const showVariant =
      p.has_variants &&
      v.name.trim().toLowerCase() !== "padrão";
    items.push({
      id: `${line.productId}:${line.variantId}`,
      name: p.name,
      variant_name: showVariant ? v.name : null,
      quantity: line.quantity,
      unit_price: v.unit_price,
      line_total: Math.round(v.unit_price * line.quantity * 100) / 100,
      image: p.image_url,
      fulfillment_type: "kit_pickup",
      fulfillment_note: "junto à entrega do kit, antes da prova",
    });
  }
  return items;
}
