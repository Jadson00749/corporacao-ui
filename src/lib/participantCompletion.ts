// Inscrições feitas antes do cadastro de participantes ficaram sem os dados de
// quem realmente corre. Na Corridinha Kids isso é bloqueante: sem a data de
// nascimento não há como calcular a idade na data da prova e a criança acaba
// em "Aguardando classificação" na lista pública.

import { ageAtEvent, isKidsDistance, kidsBracketFor, type KidsBracket } from "@/lib/eventPricing";
import type { EventSignup } from "@/hooks/useProfile";

const filled = (v?: string | null) => !!(v && v.trim());

/** Shape mínimo (Minha Conta, Admin, lista pública). */
export type KidsSignupLike = {
  status?: string | null;
  category?: string | null;
  participant_full_name?: string | null;
  participant_birth_date?: string | null;
  events?: { distance?: string | null; date?: string | null; name?: string | null } | null;
};

/** Kids reconhecida pelo texto da categoria gravada ou pela distância da prova. */
export const isKidsSignup = (s: KidsSignupLike) =>
  isKidsDistance(s.category) || isKidsDistance(s.events?.distance);

/**
 * Só pedimos atualização em Kids, que é onde a falta do dado impede a
 * classificação. Inscrição completa ou cancelada nunca entra aqui.
 */
export const needsParticipantData = (s: KidsSignupLike) =>
  s.status !== "cancelada" &&
  isKidsSignup(s) &&
  (!filled(s.participant_full_name) || !filled(s.participant_birth_date));

export const incompleteKidsSignups = (list: EventSignup[]) => list.filter(needsParticipantData);

/** Rótulo da faixa Kids pela idade na data da prova. */
export const kidsBracketLabel = (age: number | null) => kidsBracketFor(age)?.title ?? "";

export type KidsParticipantFormValues = {
  full_name: string;
  birth_date: string;
  gender?: string | null;
  cpf?: string | null;
  phone?: string | null;
};

/** Monta o patch de event_signups para classificar Kids (não altera user_id). */
export const buildKidsParticipantPatch = (
  values: KidsParticipantFormValues,
  eventDate?: string | null,
):
  | { ok: true; patch: Record<string, string | null>; bracket: KidsBracket; age: number }
  | { ok: false; error: string } => {
  const name = (values.full_name || "").trim();
  const birth = (values.birth_date || "").trim();
  if (!name || !birth) {
    return { ok: false, error: "Informe nome e data de nascimento da criança." };
  }
  const age = ageAtEvent(birth, eventDate);
  const bracket = kidsBracketFor(age);
  if (!bracket || age == null) {
    return {
      ok: false,
      error: "Idade fora das baterias Kids (2 a 13 anos na data da prova).",
    };
  }
  const patch: Record<string, string | null> = {
    participant_full_name: name,
    participant_birth_date: birth,
    participant_gender: (values.gender || "").trim() || null,
    category: bracket.category,
  };
  const cpf = (values.cpf || "").trim();
  const phone = (values.phone || "").trim();
  if (cpf) patch.participant_cpf = cpf;
  if (phone) patch.participant_phone = phone;
  return { ok: true, patch, bracket, age };
};
