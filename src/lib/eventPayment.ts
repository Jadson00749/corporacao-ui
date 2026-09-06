// Resolução dos dados de pagamento de uma prova.
//
// A regra vive na função get_event_payment_info: prova de parceiro usa o PIX e
// o WhatsApp do organizador, prova da Corporação mantém o que está na prova.
// O frontend só consome o resultado e completa o último fallback do WhatsApp
// da Corporação, que já vem das configurações do site.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type EventPaymentInfo = {
  pix_key: string;
  pix_recipient: string;
  payment_instructions: string;
  payment_whatsapp: string;
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
      // Tela de pagamento não pode ficar em branco: se a função ainda não
      // existir no banco, devolvemos null e quem chama volta para os campos
      // da própria prova, que é o comportamento anterior.
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
};

export const useOrganizerPayment = (organizerId?: string | null) =>
  useQuery({
    queryKey: ["organizer_payment", organizerId],
    enabled: !!organizerId,
    retry: false,
    queryFn: async (): Promise<OrganizerPayment | null> => {
      const { data } = await db
        .from("organizers")
        .select("id,name,pix_key,pix_recipient,payment_whatsapp")
        .eq("id", organizerId)
        .maybeSingle();
      return (data as OrganizerPayment) ?? null;
    },
  });

/** Link do WhatsApp que recebe o comprovante. Vazio quando não há número. */
export const whatsappLinkFor = (phone?: string | null, message?: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
