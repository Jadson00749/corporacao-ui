-- ============================================================
-- 23 — Pedidos avulsos da Loja (standalone, sem inscrição)
--
-- Evolui event_store_orders de forma retrocompatível:
--   • signup_id nullable (NULL = compra avulsa)
--   • order_type: signup_bundle | standalone
--   • snapshots do comprador (standalone)
--   • aceite de condições de retirada
--   • fulfillment_status (retirada ≠ pagamento)
--   • comissão snapshotada no pedido (só standalone)
--
-- RPC: create_event_store_standalone_order
-- RPC: update_event_store_order_fulfillment
-- RPC: update_event_store_standalone_payment_status
-- Cron: mark_overdue_standalone_store_orders (job separado da 22)
--
-- Estoque: continua via event_store_variant_reserved_qty
--   (status IS DISTINCT FROM 'cancelada') — sem segundo mecanismo.
--
-- Pedidos existentes: order_type default 'signup_bundle' preserva
-- signup_id e dados históricos (nenhum UPDATE em massa).
--
-- NÃO criar UPDATE RLS genérico em event_store_orders.
-- Mutações admin/organizer só via RPCs SECURITY DEFINER.
--
-- NÃO aplicar automaticamente — revise no SQL Editor.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Colunas / constraints em event_store_orders
-- ------------------------------------------------------------

-- signup_id passa a aceitar NULL (compra avulsa)
alter table public.event_store_orders
  alter column signup_id drop not null;

-- Unique parcial: um pedido por inscrição quando signup_id preenchido.
-- (UNIQUE antigo com NULLs já permite vários NULL; reforçamos com índice parcial.)
alter table public.event_store_orders
  drop constraint if exists event_store_orders_signup_uidx;

drop index if exists public.event_store_orders_signup_uidx;

create unique index if not exists event_store_orders_signup_uidx
  on public.event_store_orders (signup_id)
  where signup_id is not null;

alter table public.event_store_orders
  add column if not exists order_type text not null default 'signup_bundle';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_store_orders_order_type_check'
      and conrelid = 'public.event_store_orders'::regclass
  ) then
    alter table public.event_store_orders
      add constraint event_store_orders_order_type_check
      check (order_type in ('signup_bundle', 'standalone'));
  end if;
end $$;

-- Consistência: standalone ⇒ signup_id null; signup_bundle ⇒ signup_id not null
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_store_orders_order_type_signup_ck'
      and conrelid = 'public.event_store_orders'::regclass
  ) then
    alter table public.event_store_orders
      add constraint event_store_orders_order_type_signup_ck
      check (
        (order_type = 'signup_bundle' and signup_id is not null)
        or (order_type = 'standalone' and signup_id is null)
      );
  end if;
end $$;

alter table public.event_store_orders
  add column if not exists buyer_name_snapshot text,
  add column if not exists buyer_email_snapshot text,
  add column if not exists buyer_phone_snapshot text;

alter table public.event_store_orders
  add column if not exists pickup_terms_accepted_at timestamptz,
  add column if not exists pickup_terms_snapshot text,
  add column if not exists pickup_terms_version text;

alter table public.event_store_orders
  add column if not exists fulfillment_status text not null default 'aguardando_retirada';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_store_orders_fulfillment_status_check'
      and conrelid = 'public.event_store_orders'::regclass
  ) then
    alter table public.event_store_orders
      add constraint event_store_orders_fulfillment_status_check
      check (fulfillment_status in ('aguardando_retirada', 'retirado', 'nao_retirado'));
  end if;
end $$;

alter table public.event_store_orders
  add column if not exists fulfilled_at timestamptz;

-- Comissão no pedido: autoridade para standalone.
-- signup_bundle pode permanecer NULL (comissão global em event_signups).
alter table public.event_store_orders
  add column if not exists commission_percentage_snapshot numeric(8,4),
  add column if not exists commission_base_amount numeric(12,2),
  add column if not exists commission_amount numeric(12,2),
  add column if not exists organizer_net_amount numeric(12,2);

comment on column public.event_store_orders.order_type is
  'signup_bundle = junto da inscrição; standalone = compra avulsa (sem event_signup).';
comment on column public.event_store_orders.commission_percentage_snapshot is
  'Preenchido em standalone. signup_bundle: comissão fica no snapshot de event_signups.';
comment on column public.event_store_orders.fulfillment_status is
  'Retirada operacional (independente do status financeiro pendente/confirmada/cancelada).';

create index if not exists event_store_orders_order_type_idx
  on public.event_store_orders (order_type);
create index if not exists event_store_orders_fulfillment_status_idx
  on public.event_store_orders (fulfillment_status);

-- ------------------------------------------------------------
-- 2) Atraso 48h — pedidos standalone (job separado da migration 22)
-- ------------------------------------------------------------
create or replace function public.mark_overdue_standalone_store_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  with updated as (
    update public.event_store_orders o
    set status = 'pagamento_atrasado',
        updated_at = now()
    where o.order_type = 'standalone'
      and o.status = 'pendente'
      and o.created_at <= (now() - interval '48 hours')
    returning o.id
  )
  select count(*)::integer into v_count from updated;

  return coalesce(v_count, 0);
end;
$fn$;

comment on function public.mark_overdue_standalone_store_orders() is
  'Marca event_store_orders standalone pendentes (>48h) como pagamento_atrasado. Continua reservando estoque.';

revoke all on function public.mark_overdue_standalone_store_orders() from public;
revoke all on function public.mark_overdue_standalone_store_orders() from anon, authenticated;

select public.mark_overdue_standalone_store_orders();

create extension if not exists pg_cron with schema extensions;

do $$
declare
  jid bigint;
begin
  for jid in
    select jobid from cron.job where jobname = 'mark-overdue-standalone-store-orders'
  loop
    perform cron.unschedule(jid);
  end loop;
exception
  when undefined_table then
    raise notice 'cron.job indisponível — agende mark_overdue_standalone_store_orders manualmente.';
  when undefined_function then
    raise notice 'cron.unschedule indisponível.';
end $$;

do $$
begin
  perform cron.schedule(
    'mark-overdue-standalone-store-orders',
    '0 * * * *',
    $cron$select public.mark_overdue_standalone_store_orders();$cron$
  );
exception
  when undefined_function then
    raise notice 'cron.schedule indisponível — função criada; agende no painel.';
  when others then
    raise notice 'Falha ao agendar cron mark-overdue-standalone-store-orders: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 3) RPC: create_event_store_standalone_order
-- ------------------------------------------------------------
create or replace function public.create_event_store_standalone_order(
  _event_id uuid,
  _buyer_name text,
  _buyer_email text,
  _buyer_phone text,
  _pickup_terms_accepted_at timestamptz,
  _store_items jsonb default '[]'::jsonb
)
returns table (
  order_id uuid,
  products_amount numeric,
  total_amount numeric,
  commission_percentage_snapshot numeric,
  commission_base_amount numeric,
  commission_amount numeric,
  organizer_net_amount numeric,
  status text,
  fulfillment_status text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_order_id uuid;
  v_products numeric(12,2) := 0;
  v_sorted_items jsonb := '[]'::jsonb;
  v_variant_ids uuid[];
  r jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_product public.event_store_products%rowtype;
  v_variant public.event_store_product_variants%rowtype;
  v_unit numeric(12,2);
  v_line numeric(12,2);
  v_reserved integer;
  v_org_pct numeric := 0;
  v_org_is_platform boolean := false;
  v_commission_pct numeric(8,4) := 0;
  v_commission_base numeric(12,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_organizer_net numeric(12,2) := 0;
  v_buyer_name text;
  v_buyer_email text;
  v_buyer_phone text;
  v_terms_text text :=
    'Retirada exclusivamente no período e local de entrega dos kits da prova. '
    || 'Não há envio ou entrega posterior pela plataforma. '
    || 'Produtos não retirados dentro do período informado ficarão sujeitos '
    || 'às regras previstas no regulamento do evento.';
  v_terms_version text := 'event-store-pickup-v1';
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if _event_id is null then
    raise exception 'EVENT_REQUIRED' using errcode = 'P0001';
  end if;

  v_buyer_name := nullif(trim(coalesce(_buyer_name, '')), '');
  v_buyer_email := nullif(trim(coalesce(_buyer_email, '')), '');
  v_buyer_phone := nullif(trim(coalesce(_buyer_phone, '')), '');

  if v_buyer_name is null then
    raise exception 'BUYER_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if v_buyer_email is null then
    raise exception 'BUYER_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;
  if v_buyer_phone is null then
    raise exception 'BUYER_PHONE_REQUIRED' using errcode = 'P0001';
  end if;

  if _pickup_terms_accepted_at is null then
    raise exception 'PICKUP_TERMS_REQUIRED' using errcode = 'P0001';
  end if;

  if _store_items is null
     or jsonb_typeof(_store_items) <> 'array'
     or jsonb_array_length(_store_items) < 1 then
    raise exception 'STORE_ITEMS_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_event
  from public.events e
  where e.id = _event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if coalesce(v_event.active, false) is not true then
    raise exception 'EVENT_INACTIVE' using errcode = 'P0001';
  end if;

  -- Comissão: mesma regra estrutural da inscrição com loja
  v_commission_pct := 0;
  if v_event.organizer_id is not null then
    select coalesce(o.commission_percentage, 0),
           coalesce(o.is_platform_owner, false)
      into v_org_pct, v_org_is_platform
    from public.organizers o
    where o.id = v_event.organizer_id;

    if found and v_org_is_platform is not true then
      v_commission_pct := greatest(coalesce(v_org_pct, 0), 0);
    end if;
  end if;

  -- Valida itens + ordena (locks determinísticos)
  select coalesce(jsonb_agg(elem order by (elem->>'variant_id')), '[]'::jsonb)
    into v_sorted_items
  from jsonb_array_elements(_store_items) elem;

  for r in select * from jsonb_array_elements(v_sorted_items)
  loop
    begin
      v_variant_id := nullif(trim(coalesce(r->>'variant_id', '')), '')::uuid;
    exception when others then
      raise exception 'STORE_INVALID_ITEM' using errcode = 'P0001';
    end;
    v_qty := coalesce((r->>'quantity')::integer, 0);
    if v_variant_id is null or v_qty < 1 then
      raise exception 'STORE_INVALID_ITEM' using errcode = 'P0001';
    end if;
    if r ? 'unit_price' or r ? 'line_total' or r ? 'price' or r ? 'total' then
      raise exception 'STORE_CLIENT_PRICE_FORBIDDEN' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.event_store_orders (
    event_id, organizer_id, user_id, signup_id, status,
    products_amount, total_amount, fulfillment_type,
    order_type,
    buyer_name_snapshot, buyer_email_snapshot, buyer_phone_snapshot,
    pickup_terms_accepted_at, pickup_terms_snapshot, pickup_terms_version,
    fulfillment_status
  ) values (
    v_event.id,
    v_event.organizer_id,
    v_uid,
    null,
    'pendente',
    0, 0,
    'kit_pickup',
    'standalone',
    v_buyer_name, v_buyer_email, v_buyer_phone,
    -- Aceite: cliente só sinaliza; horário oficial = now() do servidor
    now(), v_terms_text, v_terms_version,
    'aguardando_retirada'
  )
  returning id into v_order_id;

  select array_agg((elem->>'variant_id')::uuid order by (elem->>'variant_id'))
    into v_variant_ids
  from jsonb_array_elements(v_sorted_items) elem;

  perform 1
  from public.event_store_product_variants v
  where v.id = any (v_variant_ids)
  order by v.id
  for update;

  for r in select * from jsonb_array_elements(v_sorted_items)
  loop
    v_variant_id := (r->>'variant_id')::uuid;
    v_qty := (r->>'quantity')::integer;

    select * into v_variant
    from public.event_store_product_variants
    where id = v_variant_id;

    if not found or v_variant.active is not true then
      raise exception 'STORE_VARIANT_INACTIVE' using errcode = 'P0001';
    end if;

    select * into v_product
    from public.event_store_products
    where id = v_variant.product_id;

    if not found
       or v_product.event_id <> v_event.id
       or v_product.active is not true then
      raise exception 'STORE_PRODUCT_WRONG_EVENT' using errcode = 'P0001';
    end if;

    if v_product.sale_starts_at is not null
       and now() < v_product.sale_starts_at then
      raise exception 'STORE_PRODUCT_NOT_STARTED' using errcode = 'P0001';
    end if;
    if v_product.sale_ends_at is not null
       and now() > v_product.sale_ends_at then
      raise exception 'STORE_PRODUCT_SALES_ENDED' using errcode = 'P0001';
    end if;

    -- Estoque: reserved inclui este pedido após insert do item (trigger);
    -- checamos disponibilidade antes do insert.
    if v_variant.stock_quantity is not null then
      v_reserved := public.event_store_variant_reserved_qty(v_variant.id);
      if v_reserved + v_qty > v_variant.stock_quantity then
        raise exception 'STORE_OUT_OF_STOCK' using errcode = 'P0001';
      end if;
    end if;

    v_unit := coalesce(v_variant.price_override, v_product.price);
    v_line := round(v_unit * v_qty, 2);
    v_products := v_products + v_line;

    insert into public.event_store_order_items (
      order_id, product_id, variant_id,
      product_name_snapshot, variant_name_snapshot, image_url_snapshot,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id,
      v_product.name, v_variant.name, v_product.image_url,
      v_unit, v_qty, v_line
    );
  end loop;

  v_commission_base := v_products;
  v_commission_amount := round(v_products * v_commission_pct / 100.0, 2);
  v_organizer_net := greatest(v_products - v_commission_amount, 0);

  update public.event_store_orders
  set products_amount = v_products,
      total_amount = v_products,
      commission_percentage_snapshot = v_commission_pct,
      commission_base_amount = v_commission_base,
      commission_amount = v_commission_amount,
      organizer_net_amount = v_organizer_net,
      updated_at = now()
  where id = v_order_id;

  return query select
    v_order_id,
    v_products,
    v_products,
    v_commission_pct,
    v_commission_base,
    v_commission_amount,
    v_organizer_net,
    'pendente'::text,
    'aguardando_retirada'::text;
end;
$fn$;

revoke all on function public.create_event_store_standalone_order(
  uuid, text, text, text, timestamptz, jsonb
) from public;
revoke all on function public.create_event_store_standalone_order(
  uuid, text, text, text, timestamptz, jsonb
) from anon;

grant execute on function public.create_event_store_standalone_order(
  uuid, text, text, text, timestamptz, jsonb
) to authenticated;

comment on function public.create_event_store_standalone_order(
  uuid, text, text, text, timestamptz, jsonb
) is
  'Checkout avulso da Loja da prova. Sem event_signup. Preços/comissão no servidor. Requer auth + aceite de retirada. pickup_terms_accepted_at = now() do servidor.';

-- ------------------------------------------------------------
-- 4) Remover UPDATE RLS genérico (se existir de revisão anterior)
-- Mutações: somente RPCs SECURITY DEFINER abaixo.
-- ------------------------------------------------------------
drop policy if exists event_store_orders_update_fulfillment_admin
  on public.event_store_orders;
drop policy if exists event_store_orders_update_fulfillment_organizer
  on public.event_store_orders;

-- ------------------------------------------------------------
-- 5) RPC: update_event_store_order_fulfillment
-- ------------------------------------------------------------
create or replace function public.update_event_store_order_fulfillment(
  _order_id uuid,
  _fulfillment_status text
)
returns table (
  order_id uuid,
  fulfillment_status text,
  fulfilled_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_order public.event_store_orders%rowtype;
  v_is_admin boolean := false;
  v_is_org boolean := false;
  v_new_status text;
  v_fulfilled_at timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if _order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = 'P0001';
  end if;

  v_new_status := nullif(trim(coalesce(_fulfillment_status, '')), '');
  if v_new_status is null
     or v_new_status not in ('aguardando_retirada', 'retirado', 'nao_retirado') then
    raise exception 'FULFILLMENT_STATUS_INVALID' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.event_store_orders o
  where o.id = _order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  if not v_is_admin then
    v_is_org :=
      public.has_role(v_uid, 'organizer'::public.app_role)
      and exists (
        select 1 from public.organizers org
        where org.id = v_order.organizer_id
          and org.user_id = v_uid
      );
  end if;

  if not v_is_admin and not v_is_org then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- Comprador nunca chega aqui (FORBIDDEN acima se não for admin/org).

  if v_order.status = 'cancelada' then
    raise exception 'ORDER_CANCELLED_FULFILLMENT_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_new_status in ('retirado', 'nao_retirado', 'aguardando_retirada')
     and v_order.status is distinct from 'confirmada' then
    raise exception 'FULFILLMENT_REQUIRES_CONFIRMED' using errcode = 'P0001';
  end if;

  if v_new_status = 'aguardando_retirada' then
    v_fulfilled_at := null;
  else
    -- retirado e nao_retirado: timestamp do servidor
    v_fulfilled_at := now();
  end if;

  update public.event_store_orders o
  set fulfillment_status = v_new_status,
      fulfilled_at = v_fulfilled_at,
      updated_at = now()
  where o.id = v_order.id;

  return query select
    v_order.id,
    v_new_status,
    v_fulfilled_at,
    v_order.status;
end;
$fn$;

revoke all on function public.update_event_store_order_fulfillment(uuid, text) from public;
revoke all on function public.update_event_store_order_fulfillment(uuid, text) from anon;
grant execute on function public.update_event_store_order_fulfillment(uuid, text) to authenticated;

comment on function public.update_event_store_order_fulfillment(uuid, text) is
  'Admin/organizer: atualiza só fulfillment_status/fulfilled_at. Sem UPDATE RLS genérico.';

-- ------------------------------------------------------------
-- 6) RPC: update_event_store_standalone_payment_status
-- ------------------------------------------------------------
create or replace function public.update_event_store_standalone_payment_status(
  _order_id uuid,
  _status text
)
returns table (
  order_id uuid,
  status text,
  fulfillment_status text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_order public.event_store_orders%rowtype;
  v_is_admin boolean := false;
  v_is_org boolean := false;
  v_new_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if _order_id is null then
    raise exception 'ORDER_REQUIRED' using errcode = 'P0001';
  end if;

  v_new_status := nullif(trim(coalesce(_status, '')), '');
  if v_new_status is null or v_new_status not in ('confirmada', 'cancelada') then
    raise exception 'PAYMENT_STATUS_INVALID' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.event_store_orders o
  where o.id = _order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_order.order_type is distinct from 'standalone' then
    raise exception 'STANDALONE_ONLY' using errcode = 'P0001';
  end if;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  if not v_is_admin then
    v_is_org :=
      public.has_role(v_uid, 'organizer'::public.app_role)
      and exists (
        select 1 from public.organizers org
        where org.id = v_order.organizer_id
          and org.user_id = v_uid
      );
  end if;

  if not v_is_admin and not v_is_org then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- V1: não reativar cancelada (evita estoque sem revalidação)
  if v_order.status = 'cancelada' then
    raise exception 'CANCELLED_ORDER_IMMUTABLE' using errcode = 'P0001';
  end if;

  if v_new_status = 'confirmada' then
    if v_order.status not in ('pendente', 'pagamento_atrasado') then
      raise exception 'PAYMENT_TRANSITION_FORBIDDEN' using errcode = 'P0001';
    end if;
  elsif v_new_status = 'cancelada' then
    if v_order.status not in ('pendente', 'pagamento_atrasado', 'confirmada') then
      raise exception 'PAYMENT_TRANSITION_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  update public.event_store_orders o
  set status = v_new_status,
      updated_at = now()
  where o.id = v_order.id;

  -- cancelada → reserved_qty ignora naturalmente (libera estoque)

  return query select
    v_order.id,
    v_new_status,
    v_order.fulfillment_status;
end;
$fn$;

revoke all on function public.update_event_store_standalone_payment_status(uuid, text) from public;
revoke all on function public.update_event_store_standalone_payment_status(uuid, text) from anon;
grant execute on function public.update_event_store_standalone_payment_status(uuid, text) to authenticated;

comment on function public.update_event_store_standalone_payment_status(uuid, text) is
  'Admin/organizer: confirma ou cancela pagamento de pedido standalone. signup_bundle continua via event_signup.';

-- SELECT próprio do comprador já existe (event_store_orders_select_own).
-- Itens: event_store_order_items_select_own.
-- Sem UPDATE RLS de pedidos — mutações só via RPCs acima.

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- FIM — NÃO APLICAR sem revisão humana.
-- ============================================================
