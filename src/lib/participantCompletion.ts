// Inscrições feitas antes do cadastro de participantes ficaram sem os dados de
// quem realmente corre. Na Corridinha Kids isso é bloqueante: sem a data de
// nascimento não há como calcular a idade na data da prova e a criança acaba
// fora das faixas, aparecendo em "Outras categorias" na lista pública.

import { isKidsDistance, kidsBracketFor } from "@/lib/eventPricing";
import type { EventSignup } from "@/hooks/useProfile";

const filled = (v?: string | null) => !!(v && v.trim());

/** Kids reconhecida pelo texto da categoria gravada ou pela distância da prova. */
export const isKidsSignup = (s: EventSignup) =>
  isKidsDistance(s.category) || isKidsDistance(s.events?.distance);

/**
 * Só pedimos atualização em Kids, que é onde a falta do dado impede a
 * classificação. Inscrição completa ou cancelada nunca entra aqui.
 */
export const needsParticipantData = (s: EventSignup) =>
  s.status !== "cancelada" &&
  isKidsSignup(s) &&
  (!filled(s.participant_full_name) || !filled(s.participant_birth_date));

export const incompleteKidsSignups = (list: EventSignup[]) => list.filter(needsParticipantData);

/** Rótulo da faixa Kids pela idade na data da prova. */
export const kidsBracketLabel = (age: number | null) => kidsBracketFor(age)?.label ?? "";
