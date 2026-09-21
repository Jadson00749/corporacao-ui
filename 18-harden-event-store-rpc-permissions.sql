begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'event_store_%'
        or p.proname = 'set_event_store_updated_at'
      )
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      r.fn
    );
  end loop;
end $$;

create or replace function public.get_event_store_availability(_event_id uuid)
returns table (
  product_id uuid,
  variant_id uuid,
  product_name text,
  variant_name text,
  unit_price numeric,
  stock_quantity integer,
  reserved_quantity integer,
  available_quantity integer,
  unlimited boolean,
  active boolean,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  return query
  select
    p.id,
    v.id,
    p.name,
    v.name,
    coalesce(v.price_override, p.price),
    v.stock_quantity,
    public.event_store_variant_reserved_qty(v.id),
    case
      when v.stock_quantity is null then null
      else greatest(v.stock_quantity - public.event_store_variant_reserved_qty(v.id), 0)
    end,
    (v.stock_quantity is null),
    true,
    p.sale_starts_at,
    p.sale_ends_at
  from public.event_store_products p
  join public.event_store_product_variants v on v.product_id = p.id
  join public.events e on e.id = p.event_id
  where p.event_id = _event_id
    and p.active = true
    and v.active = true
    and coalesce(e.active, false) = true
  order by p.sort_order, p.name, v.sort_order, v.name;
end;
$fn$;

revoke all on function public.get_event_store_availability(uuid)
from public, anon, authenticated;

grant execute on function public.get_event_store_availability(uuid)
to anon, authenticated;

revoke all on function public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) to authenticated;

notify pgrst, 'reload schema';

commit;
