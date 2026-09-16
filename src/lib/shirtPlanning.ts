import type { ShirtSizeAvailability } from "@/lib/shirtSizeStock";
import { normalizeShirtSize, setShirtSizeStockLimit, type ShirtSizeStock } from "@/lib/shirtSizeStock";

export { formatKitExtraPriceLabel } from "@/lib/eventKits";

export type ShirtSizeShare = {
  size: string;
  used: number;
  share: number; // 0..1
};

export type ShirtPlanRow = {
  size: string;
  reserved: number;
  stockTotal: number | null; // null = ilimitado
  available: number | null;
  projectedFuture: number;
  additionalToProduce: number;
  /** Novo max sugerido ao aplicar (used + projected, ou max+additional). */
  suggestedMax: number;
};

export type ShirtPlanResult = {
  totalActive: number;
  totalWithShirt: number;
  shirtRate: number;
  estimatedNewShirts: number;
  forecast: number;
  rows: ShirtPlanRow[];
  canSuggest: boolean;
  noHistoryMessage?: string;
};

/** Largest remainder: aloca exatamente `total` unidades conforme shares. */
export const allocateByLargestRemainder = (
  shares: { key: string; share: number }[],
  total: number
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (total <= 0 || shares.length === 0) {
    for (const s of shares) out[s.key] = 0;
    return out;
  }
  const weightSum = shares.reduce((a, s) => a + Math.max(0, s.share), 0);
  if (weightSum <= 0) {
    for (const s of shares) out[s.key] = 0;
    return out;
  }

  const exact = shares.map((s) => {
    const raw = (Math.max(0, s.share) / weightSum) * total;
    const floor = Math.floor(raw);
    return { key: s.key, floor, frac: raw - floor };
  });
  let allocated = exact.reduce((a, x) => a + x.floor, 0);
  let rem = total - allocated;
  exact.sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key));
  for (const x of exact) out[x.key] = x.floor;
  for (let i = 0; i < exact.length && rem > 0; i++) {
    out[exact[i].key] += 1;
    rem -= 1;
  }
  return out;
};

/**
 * Planejamento de camisetas a partir de capacidade + disponibilidade.
 * projected_future por tamanho; additional = max(projected - remaining, 0).
 * Ilimitado: additional = projected; suggestedMax = used + projected.
 */
export const buildShirtPlan = (opts: {
  totalActive: number;
  availability: ShirtSizeAvailability[];
  forecast: number;
}): ShirtPlanResult => {
  const totalActive = Math.max(0, Math.floor(opts.totalActive) || 0);
  const forecast = Math.max(0, Math.floor(opts.forecast) || 0);
  const avail = (opts.availability ?? []).filter((r) => normalizeShirtSize(r.size));

  const totalWithShirt = avail.reduce((s, r) => s + Math.max(0, Math.floor(r.used) || 0), 0);
  const shirtRate = totalActive > 0 ? totalWithShirt / totalActive : 0;
  const estimatedNewShirts =
    totalActive > 0 && totalWithShirt > 0
      ? Math.round(forecast * shirtRate)
      : 0;

  if (totalWithShirt <= 0) {
    return {
      totalActive,
      totalWithShirt: 0,
      shirtRate: 0,
      estimatedNewShirts: 0,
      forecast,
      rows: [],
      canSuggest: false,
      noHistoryMessage:
        "Ainda não há inscrições com camiseta suficientes para sugerir uma distribuição por tamanho.",
    };
  }

  const shares = avail
    .filter((r) => (r.used || 0) > 0)
    .map((r) => ({
      key: normalizeShirtSize(r.size),
      share: Math.max(0, r.used) / totalWithShirt,
      used: Math.max(0, Math.floor(r.used) || 0),
      remaining: r.unlimited ? null : r.remaining,
      max_quantity: r.unlimited ? null : r.max_quantity,
      unlimited: r.unlimited,
    }));

  // Inclui tamanhos com used=0 mas presentes na disponibilidade? Spec usa distribuição atual.
  // Só tamanhos com histórico (used > 0).
  const allocated = allocateByLargestRemainder(
    shares.map((s) => ({ key: s.key, share: s.share })),
    estimatedNewShirts
  );

  const rows: ShirtPlanRow[] = shares.map((s) => {
    const projected = allocated[s.key] ?? 0;
    const stockTotal = s.unlimited ? null : s.max_quantity;
    const available = s.unlimited ? null : Math.max(0, s.remaining ?? 0);
    const additionalToProduce =
      available == null ? projected : Math.max(projected - available, 0);
    const suggestedMax =
      stockTotal == null
        ? s.used + projected
        : stockTotal + additionalToProduce;
    return {
      size: s.key,
      reserved: s.used,
      stockTotal,
      available,
      projectedFuture: projected,
      additionalToProduce,
      suggestedMax,
    };
  });

  return {
    totalActive,
    totalWithShirt,
    shirtRate,
    estimatedNewShirts,
    forecast,
    rows,
  canSuggest: totalWithShirt > 0,
};
};

/** Aplica sugestão ao objeto local shirt_size_stock (não persiste). */
export const applyShirtPlanToStock = (
  stock: ShirtSizeStock,
  rows: ShirtPlanRow[]
): ShirtSizeStock => {
  let next = { ...stock };
  for (const row of rows) {
    if (row.suggestedMax < 1) continue;
    // Só aplica se houver produção adicional OU estoque ainda ilimitado com projeção
    if (row.additionalToProduce <= 0 && row.stockTotal != null) continue;
    next = setShirtSizeStockLimit(next, row.size, row.suggestedMax);
  }
  return next;
};
