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
  /**
   * Limite de utilizações (inscrições não canceladas com este código).
   * null / undefined / omitido → ilimitado.
   */
  max_uses?: number | null;
};

export type CouponAvailability = {
  ok: boolean;
  code: string | null;
  max_uses: number | null;
  used: number;
  remaining: number | null;
  reason: string;
};

/** Formato legado encontrado: { code, description? } sem type/value/active. */
export const isLegacyCouponShape = (c: Partial<EventCoupon> | null | undefined) =>
  !!c &&
  typeof c.code === "string" &&
  c.type == null &&
  (c.value == null || Number.isNaN(Number(c.value)));

const parseMaxUses = (raw: any): number | null | undefined => {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
};

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
  const max_uses = parseMaxUses(raw?.max_uses);

  // Legado / incompleto: mantém code+description; type/value só se válidos
  if (!type || value == null) {
    return {
      code,
      ...(description ? { description } : {}),
      active,
      ...(max_uses != null ? { max_uses } : {}),
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
    ...(max_uses != null ? { max_uses } : {}),
  };
};

export const normalizeCoupons = (raw: unknown): EventCoupon[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCoupon).filter((c) => c.code);
};

/** Cupons que podem ser digitados na inscrição (ativos e com código). */
export const listApplicableCoupons = (raw: unknown): EventCoupon[] =>
  normalizeCoupons(raw).filter((c) => c.active !== false && c.code.trim());

export const couponHasDiscountConfig = (c: EventCoupon | null | undefined) =>
  !!c &&
  (c.type === "percentage" || c.type === "fixed") &&
  typeof c.value === "number" &&
  c.value > 0;

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
  if (!couponHasDiscountConfig(coupon)) return 0;

  let discount = 0;
  if (coupon!.type === "percentage") {
    const pct = Math.min(Math.max(coupon!.value!, 0), 100);
    discount = (base * pct) / 100;
  } else if (coupon!.type === "fixed") {
    discount = coupon!.value!;
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
  if (c.max_uses != null && String(c.max_uses) !== "") {
    const lim = Number(c.max_uses);
    if (!Number.isFinite(lim) || lim <= 0 || !Number.isInteger(lim)) {
      return `Cupom "${c.code}": limite de utilizações deve ser um inteiro maior que zero, ou vazio (ilimitado).`;
    }
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
    max_uses: n.max_uses ?? null,
  };
};

/** Cupom novo no Admin já nasce no formato completo. */
export const newAdminCoupon = (): EventCoupon => ({
  code: "",
  type: "percentage",
  value: 10,
  description: "",
  active: true,
  max_uses: null,
});

export const formatCouponUsesLabel = (used: number, maxUses: number | null | undefined) => {
  if (maxUses == null || !(maxUses > 0)) return `${used} / Ilimitado`;
  return `${used} / ${maxUses}`;
};

export const couponAvailabilityMessage = (reason: string | null | undefined) => {
  switch (reason) {
    case "exhausted":
      return "Este cupom atingiu o limite de utilizações.";
    case "inactive":
      return "Este cupom está inativo.";
    case "not_found":
    case "empty_code":
      return "Cupom não encontrado.";
    default:
      return "Não foi possível validar este cupom.";
  }
};
