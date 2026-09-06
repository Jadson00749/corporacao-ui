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

export const useEventPayment = (eventId?: string | null) =>
  useQuery({
    queryKey: ["event_payment_info", eventId],
    enabled: !!eventId,
    retry: false,
    queryFn: async (): Promise<EventPaymentInfo | null> => {
      const { data, error } = await db.rpc("get_event_payment_info", { _event_id: eventId });
      if (error) return null;
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
};

export const ORGANIZER_PAYMENT_COLUMNS =
  "id,name,pix_key,pix_recipient,payment_whatsapp,payment_email,payment_contact_name";

export type OrganizerPaymentInput = {
  pix_key: string;
  pix_recipient: string;
  payment_whatsapp: string;
  payment_email: string;
  payment_contact_name: string;
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
      if (!organizerId) throw new Error("Organização não encontrada.");
      const payload = {
        pix_key: input.pix_key.trim(),
        pix_recipient: input.pix_recipient.trim(),
        payment_whatsapp: input.payment_whatsapp.replace(/\D/g, ""),
        payment_email: input.payment_email.trim(),
        payment_contact_name: input.payment_contact_name.trim(),
      };
      const { error } = await db.from("organizers").update(payload).eq("id", organizerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizer_payment", organizerId] });
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
