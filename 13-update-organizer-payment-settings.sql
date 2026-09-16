-- ============================================================
-- 13 — RPC para o organizer atualizar só dados financeiros
--
-- Causa raiz: organizer tem SELECT da própria linha em organizers,
-- mas NÃO tem policy de UPDATE. O frontend fazia UPDATE direto,
-- afetava 0 linhas e mostrava toast de sucesso (só checava error).
--
-- Solução: SECURITY DEFINER RPC que:
--   - identifica o organizer por auth.uid() + status = 'active'
--   - atualiza SOMENTE os 5 campos financeiros
--   - retorna a linha gravada (prova de persistência)
--
-- NÃO cria policy genérica de UPDATE em organizers.
-- NÃO altera events / get_event_payment_info / payment_instructions.
--
-- NÃO aplicar automaticamente — revise e rode no SQL Editor.
-- ============================================================

create or replace function public.update_organizer_payment_settings(
  _pix_key text,
  _pix_recipient text,
  _payment_whatsapp text,
  _payment_email text,
  _payment_contact_name text
)
returns table(
  id uuid,
  pix_key text,
  pix_recipient text,
  payment_whatsapp text,
  payment_email text,
  payment_contact_name text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  org_id uuid;
begin
  if uid is null then
    raise exception 'Não autenticado.';
  end if;

  select o.id
    into org_id
  from public.organizers o
  where o.user_id = uid
    and coalesce(o.status, 'active') = 'active'
  limit 1;

  if org_id is null then
    raise exception 'Organização ativa não encontrada para este usuário.';
  end if;

  return query
  update public.organizers o
  set
    pix_key = coalesce(trim(_pix_key), ''),
    pix_recipient = coalesce(trim(_pix_recipient), ''),
    payment_whatsapp = coalesce(regexp_replace(coalesce(_payment_whatsapp, ''), '\D', '', 'g'), ''),
    payment_email = coalesce(trim(_payment_email), ''),
    payment_contact_name = coalesce(trim(_payment_contact_name), '')
  where o.id = org_id
  returning
    o.id,
    o.pix_key,
    o.pix_recipient,
    o.payment_whatsapp,
    o.payment_email,
    o.payment_contact_name,
    o.updated_at;
end;
$function$;

revoke all on function public.update_organizer_payment_settings(text, text, text, text, text) from public;
grant execute on function public.update_organizer_payment_settings(text, text, text, text, text) to authenticated;

comment on function public.update_organizer_payment_settings(text, text, text, text, text) is
  'Organizer autenticado atualiza somente dados financeiros da própria organização ativa. Sem policy UPDATE genérica.';
