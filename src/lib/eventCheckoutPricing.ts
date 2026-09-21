/**
 * Cálculo autoritativo do checkout (inscrição + loja) — espelho da RPC SQL.
 *
 * Fórmula MVP:
 *   registration_base = preço modalidade (lote / 60+)
 *   kit_adjustment    = soma extra_price (pode ser NEGATIVO)
 *   discount          = cupom sobre max(0, base + kit)  — NUNCA sobre produtos
 *   registration      = max(0, base + kit - discount)
 *   products          = soma unit_price*qty do banco
 *   total             = registration + products
 *   commission_base   = total
 *   commission        = total * pct/100  (parceiro; platform = 0)
 *   organizer_net     = total - commission
 *
 * Arredondamento: espelha PostgreSQL round(numeric, 2) — half away from zero.
 * Identificação financeira no banco: organizers.is_platform_owner (não o nome).
 */

import {
  activeLote,
  effectivePrice,
  hasSeniorPrice,
  isKidsDistance,
  isSeniorAtEvent,
  type DistancePricing,
  type SeniorPricing,
} from "@/lib/eventPricing";
import {
  applyCouponToTotal,
  normalizeCoupon,
  type EventCoupon,
} from "@/lib/eventCoupons";
import {
  getKitAvailability,
  isKitAvailableForDistance,
  lastLoteNumber,
  type EventKitOption,
} from "@/lib/eventKits";

export const CHECKOUT_PRICING_VERSION = 2 as const;

export type DistanceRow = DistancePricing & SeniorPricing & { distance: string };

export type StoreLineInput = {
  variantId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
  variantName?: string;
  productId?: string;
  eventId?: string;
  active?: boolean;
  variantActive?: boolean;
  /** Espelho de event_store_products.sale_starts_at (ISO). */
  saleStartsAt?: string | null;
  /** Espelho de event_store_products.sale_ends_at (ISO). */
  saleEndsAt?: string | null;
  /** Estoque da variante (null = ilimitado). */
  stockQuantity?: number | null;
  /** Quantidade já reservada (pedidos não cancelados). */
  reservedQuantity?: number;
};

export type CheckoutPricingInput = {
  distance: DistanceRow;
  eventDate?: string | null;
  participantBirth?: string | null;
  today?: string;
  selectedKits: EventKitOption[];
  allKitsForEvent: EventKitOption[];
  coupon?: EventCoupon | null;
  storeLines?: StoreLineInput[];
  eventId?: string;
  /**
   * Platform/main: isPlatformOwned=true → pct = 0
   * (espelha organizers.is_platform_owner / organizer_id null).
   * Parceiro: commissionPercentage do cadastro no momento da venda (congelado).
   */
  isPlatformOwned?: boolean;
  commissionPercentage?: number | null;
  /** Instantâneo da compra (ISO). Espelha now() da RPC na janela de venda. */
  pricedAt?: string | Date;
};

export type CommissionSnapshot = {
  commission_percentage_snapshot: number;
  commission_base_amount: number;
  commission_amount: number;
  organizer_net_amount: number;
};

export type CheckoutPricingResult = {
  registration_base_amount: number;
  kit_adjustment_amount: number;
  discount_amount: number;
  registration_amount: number;
  products_amount: number;
  total_amount: number;
  commission_percentage_snapshot: number;
  commission_base_amount: number;
  commission_amount: number;
  organizer_net_amount: number;
  lote: 1 | 2 | 3;
  senior: boolean;
  senior_fixed: boolean;
  coupon_code: string | null;
  coupon_type: string | null;
  coupon_value: number | null;
  kit_names: string[];
  pricing_snapshot: Record<string, unknown>;
};

/**
 * Espelho de `round(numeric, scale)` no PostgreSQL:
 * arredonda half away from zero (ex.: 1.005 → 1.01, 2.675 → 2.68).
 * Aceita string para evitar float binário do JS nos edges.
 */
export const roundPgNumeric = (value: number | string, scale = 2): number => {
  const raw = typeof value === "number"
    ? (Number.isFinite(value) ? String(value) : "0")
    : String(value ?? "0").trim();
  if (!raw || raw === "NaN") return 0;
  const neg = raw.startsWith("-");
  const abs = neg ? raw.slice(1) : raw.replace(/^\+/, "");
  if (!/^\d+(\.\d+)?$/.test(abs)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return roundPgNumeric(n.toFixed(Math.max(scale + 8, 12)), scale);
  }
  const [ip, fp = ""] = abs.split(".");
  const digits = (fp + "0".repeat(scale + 1)).slice(0, scale + 1);
  const head = digits.slice(0, scale);
  const next = Number(digits[scale] || "0");
  let intPart = BigInt(ip || "0");
  let frac = BigInt(head || "0");
  const base = 10n ** BigInt(scale);
  if (next >= 5) {
    frac += 1n;
    if (frac >= base) {
      frac -= base;
      intPart += 1n;
    }
  }
  const out = Number(intPart) + Number(frac) / Number(base);
  return neg ? -out : out;
};

const round2 = (n: number | string) => roundPgNumeric(n, 2);

/**
 * Espelho de `round(a * b / divisor, scale)` com numeric (sem float binário).
 */
export const roundPgMulDiv = (
  a: number | string,
  b: number | string,
  divisor: number | string,
  scale = 2,
): number => {
  const parse = (v: number | string) => {
    const s = typeof v === "number"
      ? (Number.isFinite(v) ? String(v) : "0")
      : String(v ?? "0").trim();
    const neg = s.startsWith("-");
    const abs = neg ? s.slice(1) : s.replace(/^\+/, "");
    const safe = /^\d+(\.\d+)?$/.test(abs) ? abs : "0";
    const [ip, fp = ""] = safe.split(".");
    return { coef: BigInt((neg ? "-" : "") + (ip || "0") + fp), scale: fp.length };
  };
  const A = parse(a);
  const B = parse(b);
  const D = parse(divisor);
  if (D.coef === 0n) return 0;
  // (A/10^As)*(B/10^Bs)/(D/10^Ds) = A*B*10^Ds / (D * 10^(As+Bs))
  const num = A.coef * B.coef * (10n ** BigInt(D.scale));
  const den = D.coef * (10n ** BigInt(A.scale + B.scale));
  const neg = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const target = 10n ** BigInt(scale);
  const q = (absNum * target) / absDen;
  const r = (absNum * target) % absDen;
  let rounded = q;
  if (r * 2n >= absDen) rounded = q + 1n;
  const out = Number(rounded) / Number(target);
  return neg ? -out : out;
};

/** Fallback visual legado — NÃO usar em regra financeira. */
export const isPlatformOwnedOrganizerName = (name?: string | null) =>
  /corpora[çc][ãa]o/i.test(name || "");

/**
 * Comissão sobre o total efetivo (inscrição + produtos).
 * pct congelado no checkout — não recalcular com cadastro futuro.
 * isPlatformOwned espelha is_platform_owner / organizer_id null.
 */
export const computeCommissionSnapshot = (
  totalAmount: number | string,
  opts: { isPlatformOwned?: boolean; commissionPercentage?: number | null },
): CommissionSnapshot => {
  const totalClamped = (() => {
    const t = round2(totalAmount);
    return t < 0 ? 0 : t;
  })();
  const pct = opts.isPlatformOwned
    ? 0
    : Math.max(0, Number(opts.commissionPercentage ?? 0) || 0);
  const commission_amount = roundPgMulDiv(totalClamped, pct, 100, 2);
  const organizer_net_amount = round2(Math.max(0, totalClamped - commission_amount));
  return {
    commission_percentage_snapshot: pct,
    commission_base_amount: totalClamped,
    commission_amount,
    organizer_net_amount,
  };
};

export const todaySaoPauloISO = (d = new Date()) => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
};

export const assertKitsAllowed = (
  selected: EventKitOption[],
  distance: DistanceRow,
  today?: string,
): void => {
  for (const kit of selected) {
    if (!isKitAvailableForDistance(kit, distance, today)) {
      const err = new Error("STORE_KIT_NOT_AVAILABLE");
      (err as Error & { code: string }).code = "STORE_KIT_NOT_AVAILABLE";
      throw err;
    }
  }
};

const throwStoreCode = (code: string): never => {
  const err = new Error(code);
  (err as Error & { code: string }).code = code;
  throw err;
};

/**
 * Espelho dos guards SQL sale_starts_at / sale_ends_at.
 * null starts = já disponível; null ends = sem prazo.
 * now < starts → STORE_PRODUCT_NOT_STARTED
 * now > ends   → STORE_PRODUCT_SALES_ENDED
 */
export const assertStoreProductSaleWindow = (
  window: { saleStartsAt?: string | null; saleEndsAt?: string | null },
  now: string | Date = new Date(),
): void => {
  const t = typeof now === "string" ? new Date(now) : now;
  if (Number.isNaN(t.getTime())) return;
  const start = window.saleStartsAt ? new Date(window.saleStartsAt) : null;
  const end = window.saleEndsAt ? new Date(window.saleEndsAt) : null;
  if (start && !Number.isNaN(start.getTime()) && t < start) {
    throwStoreCode("STORE_PRODUCT_NOT_STARTED");
  }
  if (end && !Number.isNaN(end.getTime()) && t > end) {
    throwStoreCode("STORE_PRODUCT_SALES_ENDED");
  }
};

/**
 * Espelho de get_event_store_availability.available_quantity.
 * null stock → ilimitado (retorna null).
 */
export const computeVariantRemaining = (
  stockQuantity: number | null | undefined,
  reservedQuantity = 0,
): number | null => {
  if (stockQuantity == null) return null;
  const stock = Math.max(0, Math.floor(Number(stockQuantity) || 0));
  const reserved = Math.max(0, Math.floor(Number(reservedQuantity) || 0));
  return Math.max(0, stock - reserved);
};

/** Escassez visual — só a partir de remaining real (sem campo artificial). */
export const scarcityLabelFromRemaining = (remaining: number | null): string | null => {
  if (remaining == null) return null;
  const n = Math.max(0, Math.floor(remaining));
  if (n <= 0) return "Esgotado";
  if (n <= 3) return `Últimas ${n} unidades`;
  if (n <= 10) return `Só ${n} disponíveis`;
  return null;
};

/**
 * Bloqueia compra se estoque limitado e remaining < quantity.
 * Espelha STORE_OUT_OF_STOCK do trigger enforce_event_store_stock.
 */
export const assertVariantInStock = (
  stockQuantity: number | null | undefined,
  reservedQuantity: number,
  quantity: number,
): void => {
  const remaining = computeVariantRemaining(stockQuantity, reservedQuantity);
  if (remaining == null) return;
  if (remaining < 1 || quantity > remaining) {
    throwStoreCode("STORE_OUT_OF_STOCK");
  }
};

export const computeCheckoutAmounts = (input: CheckoutPricingInput): CheckoutPricingResult => {
  const today = input.today ?? todaySaoPauloISO();
  const dist = input.distance;

  assertKitsAllowed(input.selectedKits, dist, today);

  const kids = isKidsDistance(dist.distance);
  const senior = !kids && isSeniorAtEvent(input.participantBirth, input.eventDate);
  const registration_base_amount = round2(effectivePrice(dist, senior, today));
  const kit_adjustment_amount = round2(
    input.selectedKits.reduce((s, k) => s + (Number(k.extra_price) || 0), 0),
  );

  const couponBase = Math.max(0, round2(registration_base_amount + kit_adjustment_amount));
  const coupon = input.coupon ? normalizeCoupon(input.coupon) : null;
  const { discount, total: regAfterCoupon } = applyCouponToTotal(couponBase, coupon);
  const discount_amount = round2(discount);
  const registration_amount = round2(Math.max(0, regAfterCoupon));

  let products_amount = 0;
  const store_items: Record<string, unknown>[] = [];
  const pricedAt = input.pricedAt ?? new Date();
  for (const line of input.storeLines ?? []) {
    if (line.quantity < 1) {
      const err = new Error("STORE_INVALID_ITEM");
      (err as Error & { code: string }).code = "STORE_INVALID_ITEM";
      throw err;
    }
    if (line.active === false || line.variantActive === false) {
      const err = new Error("STORE_VARIANT_INACTIVE");
      (err as Error & { code: string }).code = "STORE_VARIANT_INACTIVE";
      throw err;
    }
    if (input.eventId && line.eventId && line.eventId !== input.eventId) {
      const err = new Error("STORE_PRODUCT_WRONG_EVENT");
      (err as Error & { code: string }).code = "STORE_PRODUCT_WRONG_EVENT";
      throw err;
    }
    assertStoreProductSaleWindow(
      { saleStartsAt: line.saleStartsAt, saleEndsAt: line.saleEndsAt },
      pricedAt,
    );
    if (line.stockQuantity !== undefined) {
      assertVariantInStock(
        line.stockQuantity,
        line.reservedQuantity ?? 0,
        line.quantity,
      );
    }
    const unit = round2(line.unitPrice);
    if (unit < 0) {
      const err = new Error("STORE_INVALID_PRICE");
      (err as Error & { code: string }).code = "STORE_INVALID_PRICE";
      throw err;
    }
    const lineTotal = roundPgMulDiv(unit, line.quantity, 1, 2);
    products_amount = round2(products_amount + lineTotal);
    store_items.push({
      variant_id: line.variantId,
      product_id: line.productId ?? null,
      product_name: line.productName ?? null,
      variant_name: line.variantName ?? null,
      unit_price: unit,
      quantity: line.quantity,
      line_total: lineTotal,
    });
  }

  const total_amount = round2(registration_amount + products_amount);
  const commission = computeCommissionSnapshot(total_amount, {
    isPlatformOwned: input.isPlatformOwned === true,
    commissionPercentage: input.commissionPercentage,
  });

  const lote = activeLote(dist, today);
  const kit_names = input.selectedKits.map((k) => k.name);

  const pricing_snapshot = {
    version: CHECKOUT_PRICING_VERSION,
    distance: dist.distance,
    lote,
    last_lote: lastLoteNumber(dist),
    senior,
    senior_fixed: senior && hasSeniorPrice(dist),
    registration_base_amount,
    kit_adjustment_amount,
    discount_amount,
    registration_amount,
    products_amount,
    total_amount,
    ...commission,
    coupon_code: coupon?.code?.trim() || null,
    coupon_type: coupon?.type ?? null,
    coupon_value: coupon?.value ?? null,
    kits: input.selectedKits.map((k) => ({
      name: k.name,
      extra_price: Number(k.extra_price) || 0,
      availability: getKitAvailability(k),
    })),
    store_items,
    currency: "BRL",
    priced_on_date: today,
  };

  return {
    registration_base_amount,
    kit_adjustment_amount,
    discount_amount,
    registration_amount,
    products_amount,
    total_amount,
    ...commission,
    lote,
    senior,
    senior_fixed: senior && hasSeniorPrice(dist),
    coupon_code: coupon?.code?.trim() || null,
    coupon_type: coupon?.type ?? null,
    coupon_value: coupon?.value ?? null,
    kit_names,
    pricing_snapshot,
  };
};

export const computeCheckoutAmountsSqlMirror = (input: CheckoutPricingInput): CheckoutPricingResult =>
  computeCheckoutAmounts(input);

export const rejectClientPricePayload = (item: Record<string, unknown>) => {
  if ("unit_price" in item || "line_total" in item || "price" in item || "total" in item) {
    const err = new Error("STORE_CLIENT_PRICE_FORBIDDEN");
    (err as Error & { code: string }).code = "STORE_CLIENT_PRICE_FORBIDDEN";
    throw err;
  }
};

export {
  activeLote,
  lastLoteNumber,
  isKitAvailableForDistance,
  getKitAvailability,
};
