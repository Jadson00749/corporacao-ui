// Helpers de preço por lote para distâncias de provas.
// Cada distância pode ter até 3 lotes, todos armazenados no JSONB events.distances:
//   price            -> preço do 1º lote
//   price_lote2      -> preço do 2º lote (opcional)
//   lote2_starts_at  -> data (YYYY-MM-DD) em que o 2º lote passa a valer
//   price_lote3      -> preço do 3º lote (opcional)
//   lote3_starts_at  -> data (YYYY-MM-DD) em que o 3º lote passa a valer
// Provas antigas com 1 ou 2 lotes continuam funcionando sem alteração.

export type DistancePricing = {
  distance: string;
  price?: number;
  price_lote2?: number;
  lote2_starts_at?: string | null;
  price_lote3?: number;
  lote3_starts_at?: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export const hasLote2 = (d: DistancePricing) =>
  !!(d && d.price_lote2 && d.price_lote2 > 0 && d.lote2_starts_at);

export const hasLote3 = (d: DistancePricing) =>
  !!(d && d.price_lote3 && d.price_lote3 > 0 && d.lote3_starts_at);

/** Retorna o número do lote vigente: 1, 2 ou 3. */
export const activeLote = (d: DistancePricing, today: string = todayISO()): 1 | 2 | 3 => {
  if (!d) return 1;
  if (hasLote3(d) && today >= (d.lote3_starts_at as string)) return 3;
  if (hasLote2(d) && today >= (d.lote2_starts_at as string)) return 2;
  return 1;
};

/** Compatibilidade: continua indicando se o 2º lote (ou posterior) está vigente. */
export const isLote2Active = (d: DistancePricing, today?: string) => activeLote(d, today) >= 2;

export const currentPrice = (d: DistancePricing, today?: string): number => {
  const lote = activeLote(d, today);
  if (lote === 3) return d.price_lote3 ?? 0;
  if (lote === 2) return d.price_lote2 ?? 0;
  return d?.price ?? 0;
};

export const loteLabel = (n: number) => `${n}º lote`;

export type LoteInfo = {
  n: 1 | 2 | 3;
  price: number;
  startsAt: string | null;
  state: "past" | "current" | "future";
};

/** Lista dos lotes existentes com o estado de cada um (encerrado / atual / futuro). */
export const loteList = (d: DistancePricing, today: string = todayISO()): LoteInfo[] => {
  if (!d) return [];
  const current = activeLote(d, today);
  const list: LoteInfo[] = [];
  if ((d.price ?? 0) > 0 || hasLote2(d)) {
    list.push({ n: 1, price: d.price ?? 0, startsAt: null, state: current === 1 ? "current" : "past" });
  }
  if (hasLote2(d)) {
    list.push({
      n: 2,
      price: d.price_lote2 ?? 0,
      startsAt: d.lote2_starts_at ?? null,
      state: current === 2 ? "current" : current > 2 ? "past" : "future",
    });
  }
  if (hasLote3(d)) {
    list.push({
      n: 3,
      price: d.price_lote3 ?? 0,
      startsAt: d.lote3_starts_at ?? null,
      state: current === 3 ? "current" : "future",
    });
  }
  return list;
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDateBR = (iso: string) => {
  const [y, m, dd] = iso.split("-");
  return `${dd}/${m}/${y}`;
};
