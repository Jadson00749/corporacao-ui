/**
 * Categoria gravada em event_signups.category — mesma regra da inscrição pública
 * (ProvaInscricao): distância · gênero · faixa etária; Kids = bateria oficial.
 */

import {
  ageAtEvent,
  isKidsDistance,
  isSeniorOnlyDistance,
  kidsCategoryForAge,
  sportAgeAtEvent,
} from "@/lib/eventPricing";

export type EventAgeBracketLike = { min: number; max: number };

export type EventCategoryConfig = {
  distances?: { distance?: string | null }[] | null;
  distance?: string | null;
  genders?: string[] | null;
  age_brackets?: EventAgeBracketLike[] | null;
  date?: string | null;
};

/** Converte gênero do participante para o rótulo configurado na prova. */
export const matchEventGenderLabel = (
  raw?: string | null,
  options: string[] = [],
): string => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  const target = s.startsWith("f") ? "f" : s.startsWith("m") ? "m" : "";
  if (!target) return "";
  const match = options.find((o) => o.trim().toLowerCase().startsWith(target));
  return match || (target === "f" ? "Feminino" : "Masculino");
};

export const eventDistanceNames = (cfg: EventCategoryConfig): string[] => {
  const fromArr = ((cfg.distances as { distance?: string }[]) || [])
    .map((d) => (d?.distance || "").trim())
    .filter((d) => d && !isSeniorOnlyDistance(d));
  if (fromArr.length) return fromArr;
  return String(cfg.distance || "")
    .split(/[•|,/]/)
    .map((s) => s.trim())
    .filter((d) => d && !isSeniorOnlyDistance(d));
};

export const eventGenderOptions = (cfg: EventCategoryConfig): string[] => {
  const arr = ((cfg.genders as string[]) || ["Masculino", "Feminino"]).filter(
    (g) => g && g.trim(),
  );
  return arr.length ? arr : ["Masculino", "Feminino"];
};

export const eventAgeBrackets = (cfg: EventCategoryConfig): EventAgeBracketLike[] =>
  ((cfg.age_brackets as EventAgeBracketLike[]) || []).filter(
    (b) => b && Number.isFinite(b.min) && Number.isFinite(b.max),
  );

/** Mesmo formato de ProvaInscricao.categoryLabel (adulto). */
export const buildAdultSignupCategory = (
  distance: string,
  gender: string,
  bracket: string | null | undefined,
): string => {
  const parts = [distance, gender, bracket ? `${bracket} anos` : ""].filter(Boolean);
  return parts.join(" · ");
};

/**
 * Categorias compatíveis com nascimento + gênero na data da prova.
 * Reutiliza a regra pública (Kids auto / adultos com faixa se configurada).
 */
export const listCompatibleSignupCategories = (opts: {
  config: EventCategoryConfig;
  birthDate?: string | null;
  gender?: string | null;
}): string[] => {
  const distances = eventDistanceNames(opts.config);
  const genders = eventGenderOptions(opts.config);
  const ageBrackets = eventAgeBrackets(opts.config);
  const eventDate = opts.config.date;
  const gender = matchEventGenderLabel(opts.gender, genders);

  const sportAge = sportAgeAtEvent(opts.birthDate || null, eventDate);
  const civilAge = ageAtEvent(opts.birthDate || null, eventDate);

  const kidsDistances = distances.filter((d) => isKidsDistance(d));
  const adultDistances = distances.filter((d) => !isKidsDistance(d));

  const out: string[] = [];

  if (kidsDistances.length) {
    const kidsCat = kidsCategoryForAge(civilAge);
    if (kidsCat) out.push(kidsCat);
  }

  const skipAdults =
    sportAge != null && sportAge <= 12 && kidsDistances.length > 0;
  if (skipAdults || !gender) return Array.from(new Set(out));

  let bracketStr = "";
  if (ageBrackets.length) {
    if (sportAge == null) return Array.from(new Set(out));
    const match = ageBrackets.find((b) => sportAge >= b.min && sportAge <= b.max);
    if (!match) return Array.from(new Set(out));
    bracketStr = `${match.min}-${match.max}`;
  }

  for (const d of adultDistances) {
    out.push(buildAdultSignupCategory(d, gender, bracketStr || null));
  }

  return Array.from(new Set(out));
};

export const isSignupCategoryCompatible = (
  category: string,
  opts: {
    config: EventCategoryConfig;
    birthDate?: string | null;
    gender?: string | null;
  },
): boolean => {
  const cat = (category || "").trim();
  if (!cat) return false;
  return listCompatibleSignupCategories(opts).includes(cat);
};
