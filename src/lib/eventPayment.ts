// Resolução dos dados de pagamento de uma prova / organizador.
//
// A regra vive na função get_event_payment_info: prova de parceiro usa o PIX e
// o WhatsApp do organizador, prova da Corporação mantém o que está na prova.
// Contato financeiro fica em organizers, nunca em profiles.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type EventPaymentInfo = {
  pix_key: string;
  pix_recipient: string;
  payment_instructions: string;
  payment_whatsapp: string;
  payment_email?: string;
  payment_contact_name?: string;
  organizer_name: string;
  is_partner: boolean;
};

/**
 * Resolve o que exibir ao atleta.
 * - Sem organizer_id: Corporação (fallback de site + PIX do evento).
 * - Com organizer_id + RPC ok + parceiro com PIX completo: dados do organizer.
 * - Com organizer_id + RPC ok + parceiro com PIX vazio: unavailable (NUNCA events/site).
 * - Com organizer_id + RPC falhou/ausente: unavailable (NUNCA Corporação).
 */
export type AthletePaymentView = {
  unavailable: boolean;
  loading: boolean;
  pix_key: string;
  pix_recipient: string;
  payment_instructions: string;
  proofWhatsapp: string;
  is_partner: boolean;
  organizer_name: string;
};

const emptyUnavailable = (partial?: Partial<AthletePaymentView>): AthletePaymentView => ({
  unavailable: true,
  loading: false,
  pix_key: "",
  pix_recipient: "",
  payment_instructions: "",
  proofWhatsapp: "",
  is_partner: true,
  organizer_name: "",
  ...partial,
});

export const resolveAthletePaymentView = (opts: {
  eventPayment?: EventPaymentInfo | null;
  isLoading: boolean;
  isError: boolean;
  isFetched: boolean;
  eventOrganizerId?: string | null;
  eventPixKey?: string | null;
  eventPixRecipient?: string | null;
  eventPaymentInstructions?: string | null;
  siteWhatsapp?: string | null;
}): AthletePaymentView => {
  const linked = !!String(opts.eventOrganizerId ?? "").trim();

  if (linked) {
    if (opts.isLoading || !opts.isFetched) {
      return {
        unavailable: false,
        loading: true,
        pix_key: "",
        pix_recipient: "",
        payment_instructions: "",
        proofWhatsapp: "",
        is_partner: true,
        organizer_name: "",
      };
    }
    if (opts.isError || !opts.eventPayment) {
      return emptyUnavailable();
    }

    const ep = opts.eventPayment;
    const pixKey = (ep.pix_key || "").trim();
    const pixRecipient = (ep.pix_recipient || "").trim();

    // Terceiro: PIX incompleto → indisponível (nunca events.pix_* / Corporação)
    if (ep.is_partner && (!pixKey || !pixRecipient)) {
      return emptyUnavailable({
        is_partner: true,
        organizer_name: ep.organizer_name || "",
      });
    }

    return {
      unavailable: false,
      loading: false,
      pix_key: pixKey,
      pix_recipient: pixRecipient,
      payment_instructions: ep.payment_instructions || "",
      // Parceiro: nunca site Corporação. Org Corporação vinculada: WA do site se vazio.
      proofWhatsapp: ep.payment_whatsapp || (ep.is_partner ? "" : opts.siteWhatsapp || ""),
      is_partner: !!ep.is_partner,
      organizer_name: ep.organizer_name || "",
    };
  }

  // Prova sem organizer_id → Corporação (comportamento atual)
  const ep = opts.eventPayment;
  return {
    unavailable: false,
    loading: !!opts.isLoading && !opts.isFetched,
    pix_key: ep?.pix_key || opts.eventPixKey || "",
    pix_recipient: ep?.pix_recipient || opts.eventPixRecipient || "",
    payment_instructions: ep?.payment_instructions || opts.eventPaymentInstructions || "",
    proofWhatsapp: ep?.payment_whatsapp || opts.siteWhatsapp || "",
    is_partner: false,
    organizer_name: ep?.organizer_name || "",
  };
};

export const PAYMENT_UNAVAILABLE_MESSAGE =
  "Os dados de pagamento desta prova estão temporariamente indisponíveis. Tente novamente em instantes.";

export const useEventPayment = (eventId?: string | null) =>
  useQuery({
    queryKey: ["event_payment_info", eventId],
    enabled: !!eventId,
    retry: false,
    queryFn: async (): Promise<EventPaymentInfo | null> => {
      const { data, error } = await db.rpc("get_event_payment_info", { _event_id: eventId });
      if (error) throw error;
      return ((data ?? [])[0] as EventPaymentInfo) ?? null;
    },
  });

/** Dados financeiros de um organizador. A leitura é limitada pela RLS da tabela. */
export type OrganizerPayment = {
  id: string;
  name: string | null;
  pix_key: string | null;
  pix_recipient: string | null;
  payment_whatsapp: string | null;
  payment_email: string | null;
  payment_contact_name: string | null;
  asaas_api_key: string | null;
  asaas_wallet_id: string | null;
};

export const ORGANIZER_PAYMENT_COLUMNS =
  "id,name,pix_key,pix_recipient,payment_whatsapp,payment_email,payment_contact_name,asaas_api_key,asaas_wallet_id";

export type OrganizerPaymentInput = {
  pix_key: string;
  pix_recipient: string;
  payment_whatsapp: string;
  payment_email: string;
  payment_contact_name: string;
  asaas_api_key: string;
  asaas_wallet_id: string;
};

export const useOrganizerPayment = (organizerId?: string | null) =>
  useQuery({
    queryKey: ["organizer_payment", organizerId],
    enabled: !!organizerId,
    retry: false,
    queryFn: async (): Promise<OrganizerPayment | null> => {
      let res = await db
        .from("organizers")
        .select(ORGANIZER_PAYMENT_COLUMNS)
        .eq("id", organizerId)
        .maybeSingle();
      // Migration 08 ainda não aplicada: tenta sem as colunas novas.
      if (res.error && /payment_email|payment_contact_name/i.test(res.error.message || "")) {
        res = await db
          .from("organizers")
          .select("id,name,pix_key,pix_recipient,payment_whatsapp")
          .eq("id", organizerId)
          .maybeSingle();
        if (!res.error && res.data) {
          return {
            ...(res.data as OrganizerPayment),
            payment_email: "",
            payment_contact_name: "",
            asaas_api_key: null,
            asaas_wallet_id: null,
          };
        }
      }
      if (res.error) return null;
      return (res.data as OrganizerPayment) ?? null;
    },
  });

/** PIX + WhatsApp essenciais para receber inscrição. */
export const isOrganizerPaymentReady = (
  p?: Pick<OrganizerPayment, "pix_key" | "pix_recipient" | "payment_whatsapp"> | null
) => !!(p?.pix_key?.trim() && p?.pix_recipient?.trim() && p?.payment_whatsapp?.trim());

export const useSaveOrganizerPayment = (organizerId?: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrganizerPaymentInput) => {
      const { data, error } = await db.rpc("update_organizer_payment_settings", {
        _pix_key: input.pix_key.trim(),
        _pix_recipient: input.pix_recipient.trim(),
        _payment_whatsapp: input.payment_whatsapp.replace(/\D/g, ""),
        _payment_email: input.payment_email.trim(),
        _payment_contact_name: input.payment_contact_name.trim(),
        _asaas_wallet_id: input.asaas_wallet_id?.trim() || null,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as OrganizerPayment | null;
      if (!row?.id) {
        throw new Error("Não foi possível confirmar o salvamento dos dados de pagamento.");
      }
      return row;
    },
    onSuccess: (row) => {
      const id = organizerId || row.id;
      qc.setQueryData(["organizer_payment", id], (prev: OrganizerPayment | null | undefined) => ({
        id: row.id,
        name: prev?.name ?? null,
        pix_key: row.pix_key ?? "",
        pix_recipient: row.pix_recipient ?? "",
        payment_whatsapp: row.payment_whatsapp ?? "",
        payment_email: row.payment_email ?? "",
        payment_contact_name: row.payment_contact_name ?? "",
        asaas_api_key: row.asaas_api_key ?? null,
        asaas_wallet_id: row.asaas_wallet_id ?? null,
      }));
      qc.invalidateQueries({ queryKey: ["organizer_payment", id] });
      qc.invalidateQueries({ queryKey: ["event_payment_info"] });
    },
  });
};

/** Mascara chave PIX longa para exibição em resumos (mantém início e fim). */
export const maskPixKey = (key?: string | null) => {
  const k = (key || "").trim();
  if (k.length <= 8) return k || "—";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
};

/** Link do WhatsApp que recebe o comprovante. Vazio quando não há número. */
export const whatsappLinkFor = (phone?: string | null, message?: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
