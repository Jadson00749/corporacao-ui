import { isMainOrg } from "@/hooks/useOrganizerStats";

/** Nome público da plataforma (sempre fixo na UI de inscrição/parceiro). */
export const CORP_PLATFORM_NAME = "Corporação Assessoria Esportiva";

export type EventOrganizerRef = {
  id: string;
  name: string;
};

/** Normaliza o embed Supabase `organizers (id, name)` (objeto ou array). */
export const parseEventOrganizerEmbed = (raw: unknown): EventOrganizerRef | null => {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const id = String((row as { id?: unknown }).id ?? "").trim();
  const name = String((row as { name?: unknown }).name ?? "").trim();
  if (!id || !name) return null;
  return { id, name };
};

/**
 * Nome do organizador parceiro para exibição pública.
 * - Sem organizer_id → Corporação (omite bloco).
 * - Nome da Corporação (isMainOrg) → omite.
 * - organizer_id sem name → omite + warning em DEV.
 */
export const partnerOrganizerPublicName = (
  organizerId?: string | null,
  organizer?: EventOrganizerRef | null
): string | null => {
  if (!organizerId) return null;
  const name = organizer?.name?.trim();
  if (!name) {
    if (import.meta.env.DEV) {
      console.warn(
        "[eventOrganizer] organizer_id presente sem organizers.name",
        organizerId
      );
    }
    return null;
  }
  if (isMainOrg(name)) return null;
  return name;
};
