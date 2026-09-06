-- ============================================================
-- Dados de pagamento por organizador (seguro / idempotente)
--
-- Antes: o PIX era digitado prova a prova em events.pix_key e o botão
-- "Enviar comprovante" usava sempre site_settings.contact_whatsapp, ou
-- seja, todo comprovante caía no WhatsApp da Corporação, inclusive o de
-- provas de parceiros.
--
-- Agora: cada organizador guarda os próprios dados financeiros e a prova
-- resolve o pagamento pelo organizer_id no momento do pagamento. Nada de
-- snapshot: se o organizador trocar a chave, as provas acompanham.
-- ============================================================

alter table public.organizers
  add column if not exists pix_key text not null default '',
  add column if not exists pix_recipient text not null default '',
  add column if not exists payment_whatsapp text not null default '';

comment on column public.organizers.payment_whatsapp is
  'WhatsApp que recebe os comprovantes PIX. Pode ser comercial, diferente do telefone pessoal do perfil. Formato com DDI, ex: 5516999999999.';

-- ------------------------------------------------------------
-- Resolução dos dados de pagamento de uma prova.
--
-- SECURITY DEFINER porque o atleta na tela de inscrição precisa ler a chave
-- PIX e o WhatsApp do organizador, e organizers não é legível publicamente.
-- A função devolve só campos de pagamento: commission_percentage, status e
-- user_id não saem por aqui, então a RLS da tabela continua intacta.
--
-- Precedência, conforme decidido:
--   prova de parceiro  -> dado do organizador vence, o da prova é reserva
--   prova da Corporação -> dado da prova vence, mantendo o comportamento atual
--
-- Em prova de parceiro o WhatsApp nunca cai para o número da Corporação:
-- se o organizador não configurou, tenta o telefone do responsável e, na
-- falta dele, devolve vazio para o frontend desabilitar o botão.
-- ------------------------------------------------------------
create or replace function public.get_event_payment_info(_event_id uuid)
returns table(
  pix_key text,
  pix_recipient text,
  payment_instructions text,
  payment_whatsapp text,
  organizer_name text,
  is_partner boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with base as (
    select
      e.pix_key              as e_key,
      e.pix_recipient        as e_recipient,
      e.payment_instructions as e_instructions,
      o.pix_key              as o_key,
      o.pix_recipient        as o_recipient,
      o.payment_whatsapp     as o_whatsapp,
      o.name                 as o_name,
      p.whatsapp             as owner_whatsapp,
      -- Mesma regra do frontend (isMainOrg): a organização principal é
      -- reconhecida pelo nome, e prova sem organizer_id é da Corporação.
      (o.id is not null and o.name !~* 'corpora[çc][ãa]o') as partner
    from public.events e
    left join public.organizers o on o.id = e.organizer_id
    left join public.profiles p on p.user_id = o.user_id
    where e.id = _event_id
  )
  select
    case when b.partner
      then coalesce(nullif(b.o_key, ''), nullif(b.e_key, ''), '')
      else coalesce(nullif(b.e_key, ''), nullif(b.o_key, ''), '')
    end,
    case when b.partner
      then coalesce(nullif(b.o_recipient, ''), nullif(b.e_recipient, ''), '')
      else coalesce(nullif(b.e_recipient, ''), nullif(b.o_recipient, ''), '')
    end,
    -- Instruções são texto editorial da prova, seguem sempre do evento.
    coalesce(b.e_instructions, ''),
    case when b.partner
      then coalesce(nullif(b.o_whatsapp, ''), nullif(b.owner_whatsapp, ''), '')
      else coalesce(nullif(b.o_whatsapp, ''), '')
    end,
    coalesce(b.o_name, ''),
    coalesce(b.partner, false)
  from base b;
$function$;

grant execute on function public.get_event_payment_info(uuid) to anon, authenticated;
