/**
 * Loja por prova — catálogo, checkout RPC (DEV) e pedidos admin.
 * Sem seed automático. Preços/totais: autoridade no banco.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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

// ─── Checkout RPC (DEV / localhost) ─────────────────────────────────────────

export type EventStoreCheckoutResult = {
  signup_id: string;
  order_id: string | null;
  registration_amount: number;
  products_amount: number;
  total_amount: number;
  commission_amount: number;
  organizer_net_amount: number;
  pricing_snapshot: unknown;
};

export function mapEventStoreCheckoutError(err: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string | null {
  const blob = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`;
  const isCpfActiveDup =
    /event_signups_event_participant_cpf_uidx/i.test(blob) ||
    (String(err.code ?? "") === "23505" &&
      /participant_cpf|event_signups_event_participant/i.test(blob));
  if (isCpfActiveDup) {
    return [
      "Este participante já possui uma inscrição ativa nesta prova.",
      "Se precisar fazer uma nova inscrição, cancele a inscrição anterior primeiro.",
    ].join(" ");
  }
  if (/STORE_OUT_OF_STOCK/i.test(blob)) {
    return "Um dos produtos selecionados acabou de esgotar. Atualize sua seleção.";
  }
  if (/STORE_PRODUCT_NOT_STARTED/i.test(blob)) {
    return "Este produto ainda não está disponível para compra.";
  }
  if (/STORE_PRODUCT_SALES_ENDED/i.test(blob)) {
    return "As vendas deste produto já foram encerradas.";
  }
  if (/STORE_VARIANT_INACTIVE/i.test(blob)) {
    return "Esta opção não está mais disponível.";
  }
  if (/STORE_PRODUCT_WRONG_EVENT/i.test(blob)) {
    return "Não foi possível concluir a compra destes produtos. Tente novamente.";
  }
  if (/STORE_CLIENT_PRICE_FORBIDDEN/i.test(blob)) {
    return "Não foi possível validar os preços. Atualize a página e tente novamente.";
  }
  if (/STORE_INVALID_ITEM/i.test(blob)) {
    return "Há um item inválido no carrinho. Remova e adicione novamente.";
  }
  if (/PICKUP_TERMS_REQUIRED/i.test(blob)) {
    return "Aceite as condições de retirada para concluir a compra.";
  }
  if (/BUYER_NAME_REQUIRED|BUYER_EMAIL_REQUIRED|BUYER_PHONE_REQUIRED/i.test(blob)) {
    return "Preencha nome, e-mail e telefone para concluir a compra.";
  }
  if (/STORE_ITEMS_REQUIRED/i.test(blob)) {
    return "Adicione pelo menos um produto ao pedido.";
  }
  if (/NOT_AUTHENTICATED/i.test(blob)) {
    return "Faça login para finalizar a compra.";
  }
  return null;
}

export async function createEventSignupWithStore(args: {
  eventId: string;
  distance: string;
  category: string;
  kitNames: string[];
  shirtSize: string | null;
  couponCode: string | null;
  teamName: string;
  notes: string;
  participantFullName: string;
  participantCpf: string | null;
  participantBirthDate: string | null;
  participantGender: string | null;
  participantPhone: string | null;
  acceptedEventTermsAt: string;
  storeItems: { variant_id: string; quantity: number }[];
}): Promise<EventStoreCheckoutResult> {
  const { data, error } = await supabase.rpc("create_event_signup_with_store", {
    _event_id: args.eventId,
    _distance: args.distance,
    _category: args.category,
    _kit_names: args.kitNames as unknown as Json,
    _shirt_size: args.shirtSize,
    _coupon_code: args.couponCode,
    _team_name: args.teamName,
    _notes: args.notes,
    _participant_full_name: args.participantFullName,
    _participant_cpf: args.participantCpf,
    _participant_birth_date: args.participantBirthDate,
    _participant_gender: args.participantGender,
    _participant_phone: args.participantPhone,
    _accepted_event_terms_at: args.acceptedEventTermsAt,
    _store_items: args.storeItems as unknown as Json,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.signup_id) {
    throw new Error("Resposta inválida do checkout da loja.");
  }

  return {
    signup_id: row.signup_id,
    order_id: row.order_id ?? null,
    registration_amount: Number(row.registration_amount) || 0,
    products_amount: Number(row.products_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    commission_amount: Number(row.commission_amount) || 0,
    organizer_net_amount: Number(row.organizer_net_amount) || 0,
    pricing_snapshot: row.pricing_snapshot,
  };
}

// ─── Compra avulsa (standalone) ─────────────────────────────────────────────

export const EVENT_STORE_PICKUP_TERMS_VERSION = "event-store-pickup-v1";

export const EVENT_STORE_PICKUP_TERMS_TEXT =
  "Retirada exclusivamente no período e local de entrega dos kits da prova. " +
  "Não há envio ou entrega posterior pela plataforma. " +
  "Produtos não retirados dentro do período informado ficarão sujeitos " +
  "às regras previstas no regulamento do evento.";

export type EventStoreOrderType = "signup_bundle" | "standalone";
export type EventStoreFulfillmentStatus =
  | "aguardando_retirada"
  | "retirado"
  | "nao_retirado";

export type EventStoreStandaloneCheckoutResult = {
  order_id: string;
  products_amount: number;
  total_amount: number;
  commission_percentage_snapshot: number;
  commission_base_amount: number;
  commission_amount: number;
  organizer_net_amount: number;
  status: string;
  fulfillment_status: string;
};

const standaloneCartKey = (eventId: string) =>
  `event-store-standalone-cart:${eventId}`;

export function loadStandaloneStoreCart(eventId: string): EventStoreCartLine[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(standaloneCartKey(eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EventStoreCartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) =>
        l &&
        typeof l.productId === "string" &&
        typeof l.variantId === "string" &&
        Number(l.quantity) > 0,
    );
  } catch {
    return [];
  }
}

export function saveStandaloneStoreCart(
  eventId: string,
  cart: EventStoreCartLine[],
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (cart.length === 0) {
      sessionStorage.removeItem(standaloneCartKey(eventId));
      return;
    }
    sessionStorage.setItem(standaloneCartKey(eventId), JSON.stringify(cart));
  } catch {
    /* ignore quota */
  }
}

export async function createEventStoreStandaloneOrder(args: {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  pickupTermsAcceptedAt: string;
  storeItems: { variant_id: string; quantity: number }[];
}): Promise<EventStoreStandaloneCheckoutResult> {
  const { data, error } = await supabase.rpc(
    "create_event_store_standalone_order",
    {
      _event_id: args.eventId,
      _buyer_name: args.buyerName,
      _buyer_email: args.buyerEmail,
      _buyer_phone: args.buyerPhone,
      _pickup_terms_accepted_at: args.pickupTermsAcceptedAt,
      _store_items: args.storeItems as unknown as Json,
    },
  );

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) {
    throw new Error("Resposta inválida do checkout avulso.");
  }

  return {
    order_id: row.order_id,
    products_amount: Number(row.products_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    commission_percentage_snapshot:
      Number(row.commission_percentage_snapshot) || 0,
    commission_base_amount: Number(row.commission_base_amount) || 0,
    commission_amount: Number(row.commission_amount) || 0,
    organizer_net_amount: Number(row.organizer_net_amount) || 0,
    status: String(row.status || "pendente"),
    fulfillment_status: String(
      row.fulfillment_status || "aguardando_retirada",
    ),
  };
}

export function eventStoreOrderOriginLabel(
  orderType: string | null | undefined,
): "Inscrição" | "Compra avulsa" {
  return orderType === "standalone" ? "Compra avulsa" : "Inscrição";
}

export function eventStoreFulfillmentLabel(
  status: string | null | undefined,
): string {
  switch (status) {
    case "retirado":
      return "Retirado";
    case "nao_retirado":
      return "Não retirado";
    default:
      return "Aguardando retirada";
  }
}

export async function updateEventStoreOrderFulfillment(args: {
  orderId: string;
  fulfillmentStatus: EventStoreFulfillmentStatus;
}): Promise<void> {
  const { error } = await supabase.rpc("update_event_store_order_fulfillment", {
    _order_id: args.orderId,
    _fulfillment_status: args.fulfillmentStatus,
  });
  if (error) throw error;
}

export async function updateEventStoreStandalonePaymentStatus(args: {
  orderId: string;
  status: "confirmada" | "cancelada";
}): Promise<void> {
  const { error } = await supabase.rpc(
    "update_event_store_standalone_payment_status",
    {
      _order_id: args.orderId,
      _status: args.status,
    },
  );
  if (error) throw error;
}

export function mapEventStoreAdminOrderError(err: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string | null {
  const blob = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`;
  if (/FORBIDDEN/i.test(blob)) {
    return "Você não tem permissão para alterar este pedido.";
  }
  if (/STANDALONE_ONLY/i.test(blob)) {
    return "Esta ação só vale para compra avulsa. Pedidos da inscrição seguem o status da inscrição.";
  }
  if (/CANCELLED_ORDER_IMMUTABLE/i.test(blob)) {
    return "Pedido cancelado não pode ser reativado.";
  }
  if (/PAYMENT_TRANSITION_FORBIDDEN|PAYMENT_STATUS_INVALID/i.test(blob)) {
    return "Transição de pagamento não permitida para este status.";
  }
  if (/FULFILLMENT_REQUIRES_CONFIRMED/i.test(blob)) {
    return "Retirada só pode ser alterada após o pagamento confirmado.";
  }
  if (/ORDER_CANCELLED_FULFILLMENT_FORBIDDEN/i.test(blob)) {
    return "Pedido cancelado não pode ser marcado como retirado.";
  }
  if (/FULFILLMENT_STATUS_INVALID/i.test(blob)) {
    return "Status de retirada inválido.";
  }
  if (/ORDER_NOT_FOUND/i.test(blob)) {
    return "Pedido não encontrado.";
  }
  return null;
}

// ─── Pedidos admin ──────────────────────────────────────────────────────────

export type EventStoreOrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  image_url_snapshot: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type EventStoreOrderRow = {
  id: string;
  event_id: string;
  signup_id: string | null;
  status: string;
  products_amount: number;
  total_amount: number;
  fulfillment_note: string;
  created_at: string;
  order_type: EventStoreOrderType | string;
  buyer_name_snapshot: string | null;
  buyer_email_snapshot: string | null;
  buyer_phone_snapshot: string | null;
  fulfillment_status: EventStoreFulfillmentStatus | string;
  fulfilled_at: string | null;
  event_store_order_items: EventStoreOrderItemRow[];
  event_signups: {
    participant_full_name: string | null;
    participant_phone: string | null;
    status: string | null;
    category: string | null;
    created_at: string | null;
  } | null;
};

const ORDERS_SELECT_FULL = `
  id, event_id, signup_id, status, products_amount, total_amount,
  fulfillment_note, created_at,
  order_type, buyer_name_snapshot, buyer_email_snapshot, buyer_phone_snapshot,
  fulfillment_status, fulfilled_at,
  event_store_order_items (
    id, order_id, product_id, variant_id,
    product_name_snapshot, variant_name_snapshot, image_url_snapshot,
    unit_price, quantity, line_total, created_at
  ),
  event_signups (
    participant_full_name, participant_phone, status, category, created_at
  )
`;

const ORDERS_SELECT_LEGACY = `
  id, event_id, signup_id, status, products_amount, total_amount,
  fulfillment_note, created_at,
  event_store_order_items (
    id, order_id, product_id, variant_id,
    product_name_snapshot, variant_name_snapshot, image_url_snapshot,
    unit_price, quantity, line_total, created_at
  ),
  event_signups (
    participant_full_name, participant_phone, status, category, created_at
  )
`;

function normalizeOrderRow(row: any): EventStoreOrderRow {
  return {
    id: row.id,
    event_id: row.event_id,
    signup_id: row.signup_id ?? null,
    status: row.status,
    products_amount: Number(row.products_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    fulfillment_note: row.fulfillment_note ?? "",
    created_at: row.created_at,
    order_type: row.order_type ?? "signup_bundle",
    buyer_name_snapshot: row.buyer_name_snapshot ?? null,
    buyer_email_snapshot: row.buyer_email_snapshot ?? null,
    buyer_phone_snapshot: row.buyer_phone_snapshot ?? null,
    fulfillment_status: row.fulfillment_status ?? "aguardando_retirada",
    fulfilled_at: row.fulfilled_at ?? null,
    event_store_order_items: row.event_store_order_items ?? [],
    event_signups: row.event_signups ?? null,
  };
}

export async function fetchEventStoreOrders(
  eventId: string,
): Promise<EventStoreOrderRow[]> {
  return fetchEventStoreOrdersScoped([eventId]);
}

/**
 * Pedidos da loja no escopo do admin/organizer.
 * `eventIds === "all"` → sem filtro de prova (admin; RLS limita).
 */
export async function fetchEventStoreOrdersScoped(
  eventIds: string[] | "all",
): Promise<EventStoreOrderRow[]> {
  if (eventIds !== "all" && eventIds.length === 0) return [];

  const run = (select: string) => {
    let q = supabase
      .from("event_store_orders")
      .select(select)
      .order("created_at", { ascending: false });
    if (eventIds !== "all") q = q.in("event_id", eventIds);
    return q;
  };

  const withNew = await run(ORDERS_SELECT_FULL);
  const needsLegacy =
    !!withNew.error &&
    /order_type|buyer_name_snapshot|fulfillment_status|column/i.test(
      withNew.error.message,
    );

  const result = needsLegacy ? await run(ORDERS_SELECT_LEGACY) : withNew;
  if (result.error) throw result.error;
  return (result.data ?? []).map(normalizeOrderRow);
}

export function useEventStoreOrders(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin_event_store_orders", eventId],
    enabled: !!eventId && isEventStoreAdminEnabled(),
    queryFn: () => fetchEventStoreOrders(eventId!),
  });
}

/** Hub Pedidos: uma query para todas as provas do escopo. */
export function useEventStoreOrdersScoped(
  eventIds: string[] | "all" | null | undefined,
) {
  const key =
    eventIds === "all"
      ? "all"
      : eventIds
        ? [...eventIds].sort().join(",")
        : "";
  return useQuery({
    queryKey: ["admin_event_store_orders_scoped", key],
    enabled:
      isEventStoreAdminEnabled() &&
      eventIds != null &&
      (eventIds === "all" || eventIds.length > 0),
    staleTime: 60_000,
    queryFn: () => fetchEventStoreOrdersScoped(eventIds === null ? [] : eventIds!),
  });
}

export type EventStoreOrderKpis = {
  confirmedOrders: number;
  pendingOrders: number;
  overdueOrders: number;
  confirmedUnits: number;
  confirmedRevenue: number;
};

export function computeEventStoreOrderKpis(
  orders: EventStoreOrderRow[],
): EventStoreOrderKpis {
  let confirmedOrders = 0;
  let pendingOrders = 0;
  let overdueOrders = 0;
  let confirmedUnits = 0;
  let confirmedRevenue = 0;
  for (const o of orders) {
    if (o.status === "confirmada") {
      confirmedOrders += 1;
      for (const i of o.event_store_order_items ?? []) {
        confirmedUnits += i.quantity;
        confirmedRevenue += Number(i.line_total) || 0;
      }
    } else if (o.status === "pagamento_atrasado") {
      overdueOrders += 1;
      pendingOrders += 1; // ainda reserva estoque
    } else if (o.status === "pendente") {
      pendingOrders += 1;
    }
  }
  return {
    confirmedOrders,
    pendingOrders,
    overdueOrders,
    confirmedUnits,
    confirmedRevenue: Math.round(confirmedRevenue * 100) / 100,
  };
}

export type EventStoreSeparationRow = {
  product: string;
  variant: string;
  confirmed: number;
  pending: number;
};

export function computeEventStoreSeparation(
  orders: EventStoreOrderRow[],
): EventStoreSeparationRow[] {
  const map = new Map<string, EventStoreSeparationRow>();
  for (const o of orders) {
    for (const i of o.event_store_order_items ?? []) {
      const product = i.product_name_snapshot || "Produto";
      const variant = i.variant_name_snapshot?.trim() || "Padrão";
      const key = `${product}||${variant}`;
      const row = map.get(key) ?? {
        product,
        variant,
        confirmed: 0,
        pending: 0,
      };
      if (o.status === "confirmada") row.confirmed += i.quantity;
      else if (o.status === "pendente" || o.status === "pagamento_atrasado") {
        row.pending += i.quantity;
      }
      map.set(key, row);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      a.product.localeCompare(b.product, "pt-BR") ||
      a.variant.localeCompare(b.variant, "pt-BR"),
  );
}

/** Comprador exibido (standalone snapshot ou inscrição). */
export function eventStoreOrderBuyerName(order: EventStoreOrderRow): string {
  if (order.order_type === "standalone") {
    return order.buyer_name_snapshot?.trim() || "Comprador";
  }
  return order.event_signups?.participant_full_name?.trim() || "—";
}

export function eventStoreOrderBuyerPhone(order: EventStoreOrderRow): string {
  if (order.order_type === "standalone") {
    return order.buyer_phone_snapshot?.trim() || "";
  }
  return order.event_signups?.participant_phone?.trim() || "";
}

export function eventStoreOrderBuyerEmail(order: EventStoreOrderRow): string {
  if (order.order_type === "standalone") {
    return order.buyer_email_snapshot?.trim() || "";
  }
  return "";
}

export function eventStorePaymentStatusLabel(
  status: string | null | undefined,
): string {
  switch (status) {
    case "confirmada":
      return "Pagamento confirmado";
    case "pagamento_atrasado":
      return "Em atraso";
    case "cancelada":
      return "Cancelado";
    case "pendente":
    default:
      return "Aguardando pagamento";
  }
}

export type MyEventStoreOrderRow = EventStoreOrderRow & {
  events?: {
    id: string;
    name: string;
    date: string;
    city: string;
  } | null;
};

const MY_ORDERS_SELECT = `
  id, event_id, signup_id, status, products_amount, total_amount,
  fulfillment_note, created_at,
  order_type, buyer_name_snapshot, buyer_email_snapshot, buyer_phone_snapshot,
  fulfillment_status, fulfilled_at,
  event_store_order_items (
    id, order_id, product_id, variant_id,
    product_name_snapshot, variant_name_snapshot, image_url_snapshot,
    unit_price, quantity, line_total, created_at
  ),
  events ( id, name, date, city )
`;

export async function fetchMyEventStoreOrders(opts?: {
  eventId?: string;
  standaloneOnly?: boolean;
}): Promise<MyEventStoreOrderRow[]> {
  let q = supabase
    .from("event_store_orders")
    .select(MY_ORDERS_SELECT)
    .order("created_at", { ascending: false });

  if (opts?.eventId) q = q.eq("event_id", opts.eventId);
  if (opts?.standaloneOnly) q = q.eq("order_type", "standalone");

  const { data, error } = await q;
  if (error) {
    // Migration 23 ainda não aplicada → sem order_type
    if (/order_type|column/i.test(error.message)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...normalizeOrderRow(row),
    events: row.events ?? null,
  }));
}

export function useMyEventStoreOrders(opts?: {
  eventId?: string | null;
  standaloneOnly?: boolean;
  enabled?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  return useQuery({
    queryKey: [
      "my_event_store_orders",
      opts?.eventId ?? null,
      opts?.standaloneOnly ?? false,
    ],
    enabled,
    queryFn: () =>
      fetchMyEventStoreOrders({
        eventId: opts?.eventId ?? undefined,
        standaloneOnly: opts?.standaloneOnly,
      }),
  });
}

/** Pedidos standalone não cancelados (já ordenados created_at DESC no fetch). */
export function listStandaloneOrders(
  orders: MyEventStoreOrderRow[],
): MyEventStoreOrderRow[] {
  return orders.filter(
    (o) =>
      (o.order_type === "standalone" || !o.signup_id) &&
      o.status !== "cancelada",
  );
}

/** Mais recente aguardando pagamento (pendente / em atraso). */
export function pickAwaitingPaymentStandaloneOrder(
  orders: MyEventStoreOrderRow[],
): MyEventStoreOrderRow | null {
  return (
    listStandaloneOrders(orders).find(
      (o) => o.status === "pendente" || o.status === "pagamento_atrasado",
    ) ?? null
  );
}

/** Mais recente não cancelado (destaque na prova; não bloqueia nova compra). */
export function pickLatestStandaloneOrder(
  orders: MyEventStoreOrderRow[],
): MyEventStoreOrderRow | null {
  return listStandaloneOrders(orders)[0] ?? null;
}

/** @deprecated Use pickAwaitingPaymentStandaloneOrder / pickLatestStandaloneOrder */
export function pickActiveStandaloneOrder(
  orders: MyEventStoreOrderRow[],
): MyEventStoreOrderRow | null {
  return (
    pickAwaitingPaymentStandaloneOrder(orders) ??
    pickLatestStandaloneOrder(orders)
  );
}

export function orderItemsToAcquired(
  order: EventStoreOrderRow,
): ReturnType<typeof eventStoreCartToAcquiredItems> {
  return (order.event_store_order_items ?? []).map((item) => ({
    id: item.id,
    name: item.product_name_snapshot || "Produto",
    variant_name:
      item.variant_name_snapshot?.trim().toLowerCase() === "padrão"
        ? null
        : item.variant_name_snapshot?.trim() || null,
    quantity: item.quantity,
    unit_price: Number(item.unit_price) || 0,
    line_total: Number(item.line_total) || 0,
    image: item.image_url_snapshot,
    fulfillment_type: "kit_pickup",
    fulfillment_note: "junto à entrega do kit, antes da prova",
  }));
}
