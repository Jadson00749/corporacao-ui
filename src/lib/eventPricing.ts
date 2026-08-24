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

export type SeniorPricing = {
  /** Valor fixo para participantes 60+ (opcional, definido no admin). */
  price_60_plus?: number;
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

// ---------- Benefício 60+ ----------
// O organizador define manualmente, por distância, o campo opcional
// price_60_plus (JSONB). Se preenchido, participantes com 60+ pagam
// exatamente esse valor, independentemente do lote vigente.

export const SENIOR_MIN_AGE = 60;

export const calcAgeFromBirth = (birth?: string | null): number | null => {
  if (!birth) return null;
  const d = new Date(birth.length <= 10 ? `${birth}T12:00:00` : birth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

export const isSenior = (birth?: string | null) => {
  const age = calcAgeFromBirth(birth);
  return age !== null && age >= SENIOR_MIN_AGE;
};

/** Idade do participante na data da prova (fallback: idade atual). */
export const ageAtEvent = (birth?: string | null, eventDate?: string | null): number | null => {
  if (!birth) return null;
  if (!eventDate) return calcAgeFromBirth(birth);
  const b = new Date(birth.length <= 10 ? `${birth}T12:00:00` : birth);
  const e = new Date(eventDate.length <= 10 ? `${eventDate}T12:00:00` : eventDate);
  if (Number.isNaN(b.getTime()) || Number.isNaN(e.getTime())) return null;
  let age = e.getFullYear() - b.getFullYear();
  const m = e.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && e.getDate() < b.getDate())) age--;
  return age;
};

/** 60+ considerando a idade na data da prova. */
export const isSeniorAtEvent = (birth?: string | null, eventDate?: string | null) => {
  const age = ageAtEvent(birth, eventDate);
  return age !== null && age >= SENIOR_MIN_AGE;
};

/** Valor fixo 60+ definido pelo admin, se houver. */
export const seniorPrice = (d?: SeniorPricing | null): number | null => {
  const v = d?.price_60_plus;
  return typeof v === "number" && v > 0 ? v : null;
};

export const hasSeniorPrice = (d?: SeniorPricing | null) => seniorPrice(d) !== null;

/**
 * Preço efetivo: valor fixo 60+ definido pelo admin quando houver;
 * senão, 60+ paga 50% do valor integral do lote vigente.
 */
export const effectivePrice = (
  d: DistancePricing & SeniorPricing,
  senior: boolean,
  today?: string,
): number => {
  if (senior) {
    const sp = seniorPrice(d);
    if (sp !== null) return sp;
    return Math.round((currentPrice(d, today) / 2) * 100) / 100;
  }
  return currentPrice(d, today);
};



/** Modalidades legadas criadas como "(60 anos ou mais)" não são mais exibidas. */
const SENIOR_LABEL_RE = /(60\s*anos\s*ou\s*mais|\b60\s*\+|melhor\s*idade)/i;

export const isSeniorOnlyDistance = (name?: string | null) =>
  !!name && SENIOR_LABEL_RE.test(name);

/** Identifica modalidades KIDS/Infantil para não aplicar o benefício 60+. */
const KIDS_RE = /(kids|infantil|kid|mirim)/i;

export const isKidsDistance = (name?: string | null) =>
  !!name && KIDS_RE.test(name);

export const isSeniorApplicableDistance = (name?: string | null) =>
  !!name && !isSeniorOnlyDistance(name) && !isKidsDistance(name);

export const visibleDistances = <T extends { distance?: string }>(list: T[]): T[] =>
  (list ?? []).filter((d) => !isSeniorOnlyDistance(d?.distance));


