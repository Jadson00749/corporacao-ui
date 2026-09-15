-- ============================================================
-- 12 — Garante a RPC get_event_payment_info
--
-- Causa raiz confirmada em produção: a função
-- public.get_event_payment_info(uuid) NÃO EXISTIA no banco.
-- O frontend (useEventPayment) falhava e caía no fallback da
-- Corporação (PIX/WhatsApp incorretos em provas de terceiros).
--
-- Esta migration é idempotente e mínima:
-- 1) Garante colunas de pagamento em organizers (ADD IF NOT EXISTS)
-- 2) Recria apenas a RPC com o contrato atual do frontend
-- 3) REVOKE ALL FROM public + GRANT EXECUTE a anon/authenticated
--
-- NÃO altera dados.
-- NÃO abre SELECT público em organizers (SECURITY DEFINER).
-- NÃO reaplica policies/triggers das migrations 06/08.
--
-- Parceiro (terceiro): SOMENTE dados de organizers — sem fallback
-- para events.pix_* (evita PIX antigo da Corporação).
--
-- NÃO aplicar automaticamente — revise e rode no SQL Editor.
-- ============================================================

-- Colunas usadas pela RPC (já podem existir; no-op se presentes)
alter table public.organizers
  add column if not exists pix_key text not null default '',
  add column if not exists pix_recipient text not null default '',
  add column if not exists payment_whatsapp text not null default '',
  add column if not exists payment_email text not null default '',
  add column if not exists payment_contact_name text not null default '';

comment on column public.organizers.payment_whatsapp is
  'WhatsApp que recebe os comprovantes PIX. Formato com DDI, ex: 5516999999999.';
comment on column public.organizers.payment_email is
  'E-mail financeiro da organização. Independente de profiles.email.';
comment on column public.organizers.payment_contact_name is
  'Nome do responsável financeiro. Independente de profiles.full_name.';

-- ------------------------------------------------------------
-- Resolução pública do pagamento da prova
--
-- SECURITY DEFINER: o atleta precisa de PIX/WhatsApp do organizer
-- sem SELECT direto em organizers (RLS permanece intacta).
--
-- Parceiro (terceiro):
--   organizer_id preenchido E nome NÃO casa "corporação"
--   → SOMENTE organizers (pix_key, pix_recipient, payment_whatsapp,
--     payment_email, payment_contact_name). Sem fallback para events.
--   → campos vazios = '' (frontend trata como indisponível)
--
-- Corporação:
--   sem organizer_id OU organizer com nome de Corporação
--   → PIX/recebedor priorizam o evento; organizer é reserva
--   → WhatsApp/e-mail/contato só de organizers (vazio = frontend
--     usa site_settings.contact_whatsapp para WA)
-- ------------------------------------------------------------
drop function if exists public.get_event_payment_info(uuid);

create function public.get_event_payment_info(_event_id uuid)
returns table(
  pix_key text,
  pix_recipient text,
  payment_instructions text,
  payment_whatsapp text,
  payment_email text,
  payment_contact_name text,
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
      o.payment_email        as o_email,
      o.payment_contact_name as o_contact,
      o.name                 as o_name,
      (o.id is not null and o.name !~* 'corpora[çc][ãa]o') as partner
    from public.events e
    left join public.organizers o on o.id = e.organizer_id
    where e.id = _event_id
  )
  select
    case when b.partner
      then coalesce(nullif(b.o_key, ''), '')
      else coalesce(nullif(b.e_key, ''), nullif(b.o_key, ''), '')
    end,
    case when b.partner
      then coalesce(nullif(b.o_recipient, ''), '')
      else coalesce(nullif(b.e_recipient, ''), nullif(b.o_recipient, ''), '')
    end,
    coalesce(b.e_instructions, ''),
    coalesce(nullif(b.o_whatsapp, ''), ''),
    coalesce(b.o_email, ''),
    coalesce(b.o_contact, ''),
    coalesce(b.o_name, ''),
    coalesce(b.partner, false)
  from base b;
$function$;

revoke all on function public.get_event_payment_info(uuid) from public;
grant execute on function public.get_event_payment_info(uuid) to anon, authenticated;

comment on function public.get_event_payment_info(uuid) is
  'Resolve PIX/WhatsApp da prova para inscrição pública. Parceiro = somente organizers; Corporação = evento + fallback de site no frontend.';
