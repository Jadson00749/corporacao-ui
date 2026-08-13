// Helpers de preço por lote para distâncias de provas.
// Cada distância pode ter: price (lote 1), price_lote2 e lote2_starts_at (YYYY-MM-DD).
// Quando hoje >= lote2_starts_at e price_lote2 > 0, o preço corrente é o do 2º lote.

export type DistancePricing = {
  distance: string;
  price?: number;
  price_lote2?: number;
  lote2_starts_at?: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export const isLote2Active = (d: DistancePricing, today: string = todayISO()) =>
  !!(d.price_lote2 && d.price_lote2 > 0 && d.lote2_starts_at && today >= d.lote2_starts_at);

export const currentPrice = (d: DistancePricing, today?: string): number => {
  if (isLote2Active(d, today)) return d.price_lote2 ?? 0;
  return d.price ?? 0;
};

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDateBR = (iso: string) => {
  const [y, m, dd] = iso.split("-");
  return `${dd}/${m}/${y}`;
};
