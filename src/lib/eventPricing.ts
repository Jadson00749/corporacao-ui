// Helpers de preço por lote para distâncias de provas.
// Cada distância pode ter até 3 lotes, todos armazenados no JSONB events.distances:
//   price            -> preço do 1º lote
//   price_lote2      -> preço do 2º lote (opcional)
//   lote2_starts_at  -> data (YYYY-MM-DD) em que o 2º lote passa a valer
//   price_lote3      -> preço do 3º lote (opcional)
//   lote3_starts_at  -> data (YYYY-MM-DD) em que o 3º lote passa a valer
// Provas antigas com 1 ou 2 lotes continuam funcionando sem alteração.

import { parseBirthDateInput } from "@/lib/birthDate";

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
  const parsed = parseBirthDateInput(birth);
  if (!parsed.ok) return null;
  const d = new Date(`${parsed.iso}T12:00:00`);
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
  const parsed = parseBirthDateInput(birth);
  if (!parsed.ok) return null;
  const b = new Date(`${parsed.iso}T12:00:00`);
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

/**
 * Idade esportiva: ano da prova menos ano de nascimento.
 * É a regra usada para gravar a categoria na inscrição, então a lista pública
 * precisa usar a mesma para não divergir do que já está no banco.
 */
export const sportAgeAtEvent = (birth?: string | null, eventDate?: string | null): number | null => {
  if (!birth || !eventDate) return null;
  const parsed = parseBirthDateInput(birth);
  if (!parsed.ok) return null;
  const by = Number(parsed.iso.slice(0, 4));
  const ey = Number(String(eventDate).slice(0, 4));
  if (!Number.isFinite(by) || !Number.isFinite(ey)) return null;
  return ey - by;
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

/** Alias semântico para category / textos históricos (KIDS · Feminino, Kids - Ligeirinhos, etc.). */
export const isKidsCategory = (category?: string | null) => isKidsDistance(category);

/** Caminhada é participativa: lista única, sem divisão por idade ou sexo. */
const WALK_RE = /caminhada/i;

export const isWalkDistance = (name?: string | null) =>
  !!name && WALK_RE.test(name);

/**
 * Categorias oficiais da Corridinha Kids (mista — sem masculino/feminino).
 * Fonte única: formulário, lista pública, complemento e exportação.
 */
export type KidsBracket = {
  id: "ligeirinhos" | "papaleguas" | "turma-do-flash";
  /** Título da bateria na lista / UI */
  title: string;
  /** Subtítulo: faixa etária · distância */
  subtitle: string;
  /** Texto gravado em event_signups.category */
  category: string;
  ageLabel: string;
  raceDistance: string;
  min: number;
  max: number;
};

export const KIDS_BRACKETS: KidsBracket[] = [
  {
    id: "ligeirinhos",
    title: "Kids - Ligeirinhos",
    subtitle: "2 a 5 anos · 50m",
    category: "Kids - Ligeirinhos (2 a 5 anos)",
    ageLabel: "2 a 5 anos",
    raceDistance: "50m",
    min: 2,
    max: 5,
  },
  {
    id: "papaleguas",
    title: "Kids - Papaléguas",
    subtitle: "6 a 9 anos · 150m",
    category: "Kids - Papaléguas (6 a 9 anos)",
    ageLabel: "6 a 9 anos",
    raceDistance: "150m",
    min: 6,
    max: 9,
  },
  {
    id: "turma-do-flash",
    title: "Kids - Turma do Flash",
    subtitle: "10 a 13 anos · 400m",
    category: "Kids - Turma do Flash (10 a 13 anos)",
    ageLabel: "10 a 13 anos",
    raceDistance: "400m",
    min: 10,
    max: 13,
  },
];

/** Compat: lista pública antiga usava `{ label, min, max }`. */
export const kidsBracketFor = (age: number | null) =>
  age == null ? null : KIDS_BRACKETS.find((b) => age >= b.min && age <= b.max) ?? null;

export const kidsCategoryForAge = (age: number | null) => kidsBracketFor(age)?.category ?? null;

/** Resolve bateria Kids a partir da idade ou do texto já gravado em category. */
export const resolveKidsBracket = (opts: {
  age?: number | null;
  category?: string | null;
}): KidsBracket | null => {
  const byAge = kidsBracketFor(opts.age ?? null);
  if (byAge) return byAge;
  const cat = (opts.category || "").toLowerCase();
  if (!cat) return null;
  if (/ligeirinho/.test(cat) || /\b2\s*a\s*5\b/.test(cat) || /\bat[eé]\s*5\b/.test(cat)) {
    return KIDS_BRACKETS[0];
  }
  if (/papal[eé]gua/.test(cat) || /\b6\s*a\s*9\b/.test(cat) || /\b6\s*a\s*10\b/.test(cat)) {
    return KIDS_BRACKETS[1];
  }
  if (/turma do flash|flash/.test(cat) || /\b10\s*a\s*13\b/.test(cat) || /\b11\s*(anos|ou)/.test(cat)) {
    return KIDS_BRACKETS[2];
  }
  return null;
};

export const isSeniorApplicableDistance = (name?: string | null) =>
  !!name && !isSeniorOnlyDistance(name) && !isKidsDistance(name);

export const visibleDistances = <T extends { distance?: string }>(list: T[]): T[] =>
  (list ?? []).filter((d) => !isSeniorOnlyDistance(d?.distance));


