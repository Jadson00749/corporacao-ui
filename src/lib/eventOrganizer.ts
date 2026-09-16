import { isMainOrg } from "@/hooks/useOrganizerStats";

/** Nome público da plataforma (sempre fixo na UI de inscrição/parceiro). */
export const CORP_PLATFORM_NAME = "Corporação Assessoria Esportiva";

/**
 * Contexto visual oficial da plataforma.
 * - main    → Corporação (verde)
 * - partner → organizador externo (azul)
 */
export type OrganizationContext = "main" | "partner";

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

/**
 * Resolve o contexto visual a partir do relacionamento real organizer_id.
 * Sem organizer_id ou organizador principal → main (Corporação / verde).
 */
export const resolveOrganizationContext = (
  organizerId?: string | null,
  organizer?: EventOrganizerRef | null
): OrganizationContext =>
  partnerOrganizerPublicName(organizerId, organizer) ? "partner" : "main";

/** True quando o conteúdo é de organizador externo (não Corporação). */
export const isPartnerEvent = (
  organizerId?: string | null,
  organizer?: EventOrganizerRef | null
): boolean => resolveOrganizationContext(organizerId, organizer) === "partner";

/** Variante de CTA animado: brand (verde) | partner (azul).
 * Preferir brand na navegação/ação da plataforma (ex.: inscrição).
 * Partner só quando o CTA representa o organizador externo de forma explícita.
 */
export const organizationCtaVariant = (
  context: OrganizationContext = "main"
): "brand" | "partner" => (context === "partner" ? "partner" : "brand");

/** @deprecated Preferir organizationCtaVariant(resolveOrganizationContext(...)) */
export const eventCtaVariant = (
  organizerId?: string | null,
  organizer?: EventOrganizerRef | null
): "brand" | "partner" =>
  organizationCtaVariant(resolveOrganizationContext(organizerId, organizer));

/**
 * Classes utilitárias de IDENTIFICAÇÃO contextual do organizador.
 * - partner → azul (assinatura do parceiro)
 * - main → verde (Corporação)
 *
 * NÃO usar para: stepper, seleção de opções, CTAs, preços ou sucesso.
 * Esses elementos são sempre identidade da plataforma (verde / success).
 */
export const organizationAccent = (context: OrganizationContext = "main") =>
  context === "partner"
    ? {
        text: "text-partner",
        textMuted: "text-partner/90",
        border: "border-partner/35",
        borderHover: "hover:border-partner/40",
        bgSoft: "bg-partner/10",
        icon: "text-partner",
        groupHoverText: "group-hover:text-partner",
        groupHoverBorder: "group-hover:bg-partner",
      }
    : {
        text: "text-brand",
        textMuted: "text-brand/90",
        border: "border-brand/35",
        borderHover: "hover:border-brand/40",
        bgSoft: "bg-brand/10",
        icon: "text-brand",
        groupHoverText: "group-hover:text-brand",
        groupHoverBorder: "group-hover:bg-brand",
      };
