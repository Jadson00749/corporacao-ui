-- ============================================================
-- 24 — Admin: exclusão segura de pedidos de locação (rental)
-- ============================================================
-- Escopo:
--   RPC delete_rental_order(_order_id) — SECURITY DEFINER
--   Somente role admin; status permitidos: draft, requested,
--   under_review, cancelled.
--
-- NÃO aplica em produção automaticamente — revisão humana.
-- ============================================================

begin;

create or replace function public.delete_rental_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if _order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = 'P0001';
  end if;

  if not public.has_role(v_uid, 'admin'::public.app_role) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select o.status into v_status
  from public.rental_orders o
  where o.id = _order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if coalesce(v_status, '') not in (
    'draft',
    'requested',
    'under_review',
    'cancelled'
  ) then
    raise exception 'ORDER_STATUS_NOT_DELETABLE' using errcode = 'P0001';
  end if;

  -- Itens primeiro (seguro com ou sem ON DELETE CASCADE na FK).
  delete from public.rental_order_items i
  where i.order_id = _order_id;

  delete from public.rental_orders o
  where o.id = _order_id;
end;
$fn$;

revoke all on function public.delete_rental_order(uuid) from public;
revoke all on function public.delete_rental_order(uuid) from anon;
grant execute on function public.delete_rental_order(uuid) to authenticated;

comment on function public.delete_rental_order(uuid) is
  'Admin only: hard-delete rental order + items when status is draft/requested/under_review/cancelled.';

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- FIM — NÃO APLICAR sem revisão humana.
-- ============================================================
