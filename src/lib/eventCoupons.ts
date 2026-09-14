/** Cupons em events.coupons (JSONB) — formato novo + legado. */

export type CouponDiscountType = "percentage" | "fixed";

export type EventCoupon = {
  code: string;
  description?: string;
  /** percentage | fixed — ausente no formato legado */
  type?: CouponDiscountType;
  /** % (1–100) ou R$ (> 0) — ausente no formato legado */
  value?: number;
  /** default true quando omitido (legado) */
  active?: boolean;
};

/** Formato legado encontrado: { code, description? } sem type/value/active. */
export const isLegacyCouponShape = (c: Partial<EventCoupon> | null | undefined) =>
  !!c &&
  typeof c.code === "string" &&
  c.type == null &&
  (c.value == null || Number.isNaN(Number(c.value)));

export const normalizeCoupon = (raw: any): EventCoupon => {
  const code = String(raw?.code ?? "").trim();
  const description =
    raw?.description != null && String(raw.description).trim()
      ? String(raw.description).trim()
      : undefined;

  const typeRaw = String(raw?.type ?? "").toLowerCase();
  const type: CouponDiscountType | undefined =
    typeRaw === "percentage" || typeRaw === "fixed" ? typeRaw : undefined;

  const num = raw?.value != null && raw?.value !== "" ? Number(raw.value) : NaN;
  const value = Number.isFinite(num) && num > 0 ? num : undefined;

  const active = raw?.active === false ? false : true;

  // Legado / incompleto: mantém code+description; type/value só se válidos
  if (!type || value == null) {
    return {
      code,
      ...(description ? { description } : {}),
      active,
    };
  }

  // Percentual: limita a 100 na normalização de leitura (admin valida na UI)
  const safeValue = type === "percentage" ? Math.min(value, 100) : value;

  return {
    code,
    type,
    value: safeValue,
    ...(description ? { description } : {}),
    active,
  };
};

export const normalizeCoupons = (raw: unknown): EventCoupon[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCoupon).filter((c) => c.code);
};

/** Cupons que podem ser digitados na inscrição (ativos e com código). */
export const listApplicableCoupons = (raw: unknown): EventCoupon[] =>
  normalizeCoupons(raw).filter((c) => c.active !== false && c.code.trim());

/**
 * Desconto sobre a base já calculada (lote/60+ + kits).
 * Legado sem type/value → 0 (comportamento monetário anterior).
 */
export const computeCouponDiscount = (
  baseAmount: number,
  coupon: EventCoupon | null | undefined
): number => {
  if (!coupon || coupon.active === false) return 0;
  const base = Math.max(0, Number(baseAmount) || 0);
  if (!coupon.type || coupon.value == null || !(coupon.value > 0)) return 0;

  let discount = 0;
  if (coupon.type === "percentage") {
    const pct = Math.min(Math.max(coupon.value, 0), 100);
    discount = (base * pct) / 100;
  } else if (coupon.type === "fixed") {
    discount = coupon.value;
  }

  if (!Number.isFinite(discount) || discount <= 0) return 0;
  return Math.min(discount, base);
};

export const applyCouponToTotal = (
  baseAmount: number,
  coupon: EventCoupon | null | undefined
): { discount: number; total: number } => {
  const discount = computeCouponDiscount(baseAmount, coupon);
  const total = Math.max(0, Math.max(0, Number(baseAmount) || 0) - discount);
  return { discount, total };
};

/** Validação de campos no Admin (retorna mensagem ou null). */
export const validateCouponFields = (c: EventCoupon): string | null => {
  if (!c.code?.trim()) return "Informe o código do cupom.";
  if (c.type !== "percentage" && c.type !== "fixed") {
    return `Cupom "${c.code}": selecione o tipo de desconto.`;
  }
  const v = Number(c.value);
  if (!Number.isFinite(v) || v <= 0) {
    return `Cupom "${c.code}": informe um valor de desconto maior que zero.`;
  }
  if (c.type === "percentage" && v > 100) {
    return `Cupom "${c.code}": porcentagem deve ser no máximo 100.`;
  }
  return null;
};

/** Ao editar no Admin: legados ficam sem type/value até o organizador preencher. */
export const toAdminCouponDraft = (raw: any): EventCoupon => {
  const n = normalizeCoupon(raw);
  return {
    code: n.code,
    description: n.description ?? "",
    type: n.type,
    value: n.value,
    active: n.active !== false,
  };
};

/** Cupom novo no Admin já nasce no formato completo. */
export const newAdminCoupon = (): EventCoupon => ({
  code: "",
  type: "percentage",
  value: 10,
  description: "",
  active: true,
});

