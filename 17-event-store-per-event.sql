-- ============================================================
-- 17 — LOJA POR PROVA (MVP endurecido)
--
-- FASE 1 (este arquivo): estrutura ADITIVA / retrocompatível.
--   • Frontend atual NÃO chama create_event_signup_with_store
--   • Inscrições atuais (insert/update em event_signups) seguem iguais
--   • Snapshots financeiros ficam NULL no fluxo legado
--   • Triggers da loja são NO-OP sem event_store_order
-- FASE 2 (depois): UI da Loja passa a usar a nova RPC
--
-- CHECKOUT ATÔMICO + VALORES AUTORITATIVOS NO BANCO
--
-- • Uma única RPC: create_event_signup_with_store(...)
-- • Frontend envia IDs/quantidades — NÃO preços/totais/organizer_id
-- • Cupom desconta SOMENTE inscrição+kit (nunca produtos)
-- • Snapshot financeiro em event_signups (numeric(12,2))
-- • Comissão da plataforma: % de total_amount, congelada no checkout
--   (parceiro = organizers.commission_percentage;
--    platform = is_platform_owner OU organizer_id NULL → 0%)
-- • Identificação financeira NÃO usa regex de nome
-- • Comissão NÃO duplicada em event_store_orders
-- • Estoque atômico na variante (pendente+confirmada consomem)
-- • Janela de venda: sale_starts_at / sale_ends_at (null = sem limite)
--   RPC rejeita STORE_PRODUCT_NOT_STARTED / STORE_PRODUCT_SALES_ENDED
-- • Cancelamento libera; reativação revalida estoque (snapshots permanecem)
-- • 1 PIX via get_event_payment_info (sem PIX no produto)
--
-- NÃO aplica frete, compra avulsa, split, webhook.
-- NÃO usa a tabela global `products`.
-- NÃO altera get_event_payment_info / cupom / camiseta / capacidade / CPF.
--
-- IDEMPOTENTE. NÃO APLICAR AUTOMATICAMENTE.
-- Revisar no SQL Editor do Supabase antes de rodar.
--
-- TRANSAÇÃO ÚNICA: se qualquer passo falhar (incl. PLATFORM_OWNER_*),
-- nada permanece aplicado.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) updated_at helper (somente tabelas event_store_*)
--    Nome dedicado — não substitui helpers genéricos existentes.
-- ------------------------------------------------------------
create or replace function public.set_event_store_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ------------------------------------------------------------
-- 0.5) Platform owner — identificação ESTRUTURAL da Corporação
--
-- Regra financeira (RPC):
--   event.organizer_id IS NULL              → platform (comissão 0)
--   organizer.is_platform_owner = true      → platform (comissão 0)
--   demais organizers                       → partner (% do cadastro)
--
-- Regex de nome só no BACKFILL abaixo — a RPC nunca usa nome.
-- ------------------------------------------------------------
alter table public.organizers
  add column if not exists is_platform_owner boolean not null default false;

comment on column public.organizers.is_platform_owner is
  'true = Corporação / dona da plataforma. No máx. 1. Comissão financeira usa esta flag (não o nome).';

-- Backfill único (somente migration): nome legado → flag.
-- Se já houver um platform owner, não altera.
update public.organizers o
set is_platform_owner = true
where o.id = (
  select x.id
  from public.organizers x
  where x.name ~* 'corpora[çc][ãa]o'
  order by x.id
  limit 1
)
and not exists (
  select 1 from public.organizers y where y.is_platform_owner = true
);

-- FAIL-FAST: se já existem organizers e nenhum é platform owner,
-- abortar — evita prova da Corporação ser cobrada como parceiro.
do $$
declare
  v_org_count integer;
  v_platform_count integer;
begin
  select count(*) into v_org_count from public.organizers;
  select count(*) into v_platform_count
  from public.organizers
  where is_platform_owner = true;

  if v_org_count > 0 and v_platform_count = 0 then
    raise exception 'PLATFORM_OWNER_NOT_IDENTIFIED'
      using errcode = 'P0001',
            hint = 'Existem organizers, mas nenhum is_platform_owner=true após o backfill. '
                || 'Marque manualmente a Corporação (update organizers set is_platform_owner=true where id=...) '
                || 'e reaplique, ou corrija o nome para o backfill legado. Banco vazio (0 organizers) é permitido.';
  end if;

  if v_platform_count > 1 then
    raise exception 'PLATFORM_OWNER_AMBIGUOUS'
      using errcode = 'P0001',
            hint = 'Mais de um is_platform_owner=true. Deve existir no máximo 1.';
  end if;
end $$;

-- Garante no máximo um platform owner (também em inserts futuros)
create unique index if not exists organizers_one_platform_owner_uidx
  on public.organizers ((true))
  where is_platform_owner;

-- Organizer não-admin não pode flipar is_platform_owner
create or replace function public.organizers_guard_non_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    return new;
  end if;

  if old.user_id is distinct from auth.uid() then
    raise exception 'Sem permissão para alterar este organizador.';
  end if;

  if new.user_id is distinct from old.user_id
     or new.commission_percentage is distinct from old.commission_percentage
     or new.status is distinct from old.status
     or new.name is distinct from old.name
     or new.is_platform_owner is distinct from old.is_platform_owner
  then
    raise exception 'Organizadores só podem alterar os dados de pagamento.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists organizers_guard_non_payment_update on public.organizers;
create trigger organizers_guard_non_payment_update
  before update on public.organizers
  for each row
  execute function public.organizers_guard_non_payment_update();

-- ------------------------------------------------------------
-- 1) Snapshot financeiro em event_signups
--    NULL = inscrição LEGADO (não inventar R$0).
--    Novas via RPC preenchem todos os campos.
--    kit_adjustment_amount é ASSINADO (Kit Econômico = -20).
-- ------------------------------------------------------------
alter table public.event_signups
  add column if not exists registration_base_amount numeric(12,2),
  add column if not exists kit_adjustment_amount numeric(12,2),
  add column if not exists discount_amount numeric(12,2),
  add column if not exists registration_amount numeric(12,2),
  add column if not exists products_amount numeric(12,2),
  add column if not exists total_amount numeric(12,2),
  add column if not exists commission_percentage_snapshot numeric(8,4),
  add column if not exists commission_base_amount numeric(12,2),
  add column if not exists commission_amount numeric(12,2),
  add column if not exists organizer_net_amount numeric(12,2),
  add column if not exists pricing_snapshot jsonb;

-- Compat: rascunhos da revisão anterior
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_signups' and column_name = 'kits_amount'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_signups' and column_name = 'kit_adjustment_amount'
  ) then
    alter table public.event_signups rename column kits_amount to kit_adjustment_amount;
  end if;
end $$;

alter table public.event_signups drop column if exists kits_amount;

-- pricing_snapshot: remover NOT NULL/default '{}' se veio de rascunho anterior
do $$
begin
  begin
    alter table public.event_signups alter column pricing_snapshot drop not null;
  exception when others then null;
  end;
  begin
    alter table public.event_signups alter column pricing_snapshot drop default;
  exception when others then null;
  end;
end $$;

do $$
begin
  -- Remover check incorreto se existir (kit pode ser negativo)
  if exists (select 1 from pg_constraint where conname = 'event_signups_kit_adjustment_amount_nonneg') then
    alter table public.event_signups drop constraint event_signups_kit_adjustment_amount_nonneg;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'event_signups_registration_base_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_registration_base_amount_nonneg
      check (registration_base_amount is null or registration_base_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_discount_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_discount_amount_nonneg
      check (discount_amount is null or discount_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_registration_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_registration_amount_nonneg
      check (registration_amount is null or registration_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_products_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_products_amount_nonneg
      check (products_amount is null or products_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_total_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_total_amount_nonneg
      check (total_amount is null or total_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_commission_pct_nonneg') then
    alter table public.event_signups
      add constraint event_signups_commission_pct_nonneg
      check (commission_percentage_snapshot is null or commission_percentage_snapshot >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_commission_base_nonneg') then
    alter table public.event_signups
      add constraint event_signups_commission_base_nonneg
      check (commission_base_amount is null or commission_base_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_commission_amount_nonneg') then
    alter table public.event_signups
      add constraint event_signups_commission_amount_nonneg
      check (commission_amount is null or commission_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_signups_organizer_net_nonneg') then
    alter table public.event_signups
      add constraint event_signups_organizer_net_nonneg
      check (organizer_net_amount is null or organizer_net_amount >= 0);
  end if;
end $$;

comment on column public.event_signups.registration_base_amount is
  'Snapshot NULL=legado. Preço modalidade (lote/60+) antes de kit/cupom. >=0.';
comment on column public.event_signups.kit_adjustment_amount is
  'Snapshot NULL=legado. Soma extra_price dos kits — ASSINADO (ex.: Kit Econômico -20).';
comment on column public.event_signups.discount_amount is
  'Snapshot NULL=legado. Desconto do cupom sobre max(0,base+kit). Nunca sobre produtos.';
comment on column public.event_signups.registration_amount is
  'Snapshot NULL=legado. max(0, base + kit_adjustment - discount).';
comment on column public.event_signups.products_amount is
  'Snapshot NULL=legado. Total produtos da loja (cupom não aplica).';
comment on column public.event_signups.total_amount is
  'Snapshot NULL=legado. registration_amount + products_amount (valor do PIX / base da comissão).';
comment on column public.event_signups.commission_percentage_snapshot is
  'Snapshot NULL=legado. % congelada no checkout (0 se platform/is_platform_owner). Não recalcular.';
comment on column public.event_signups.commission_base_amount is
  'Snapshot NULL=legado. = total_amount no checkout.';
comment on column public.event_signups.commission_amount is
  'Snapshot NULL=legado. round(total * pct/100, 2). Cancelada: histórico permanece.';
comment on column public.event_signups.organizer_net_amount is
  'Snapshot NULL=legado. total_amount - commission_amount.';
comment on column public.event_signups.pricing_snapshot is
  'NULL=legado. Novos: { version:2, ..., commission_* }.';

-- ------------------------------------------------------------
-- 2) Catálogo por prova
-- ------------------------------------------------------------
create table if not exists public.event_store_products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text not null default '',
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  has_variants boolean not null default false,
  -- Janela de venda (null starts = já disponível; null ends = sem prazo)
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_store_products_name_len check (char_length(trim(name)) between 1 and 160),
  constraint event_store_products_sale_window_chk
    check (
      sale_starts_at is null
      or sale_ends_at is null
      or sale_ends_at > sale_starts_at
    )
);

-- Idempotente se a tabela já existia sem a janela (ambientes parciais)
alter table public.event_store_products
  add column if not exists sale_starts_at timestamptz;
alter table public.event_store_products
  add column if not exists sale_ends_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_store_products_sale_window_chk'
  ) then
    alter table public.event_store_products
      add constraint event_store_products_sale_window_chk
      check (
        sale_starts_at is null
        or sale_ends_at is null
        or sale_ends_at > sale_starts_at
      );
  end if;
end $$;

create index if not exists event_store_products_event_id_idx
  on public.event_store_products (event_id);
create index if not exists event_store_products_event_sort_idx
  on public.event_store_products (event_id, sort_order);

comment on table public.event_store_products is
  'Produtos da loja POR PROVA. Não misturar com catálogo global products.';
comment on column public.event_store_products.sale_starts_at is
  'NULL = disponível imediatamente. Antes disso a RPC rejeita STORE_PRODUCT_NOT_STARTED.';
comment on column public.event_store_products.sale_ends_at is
  'NULL = sem data limite. Depois disso a RPC rejeita STORE_PRODUCT_SALES_ENDED.';

drop trigger if exists event_store_products_set_updated_at on public.event_store_products;
create trigger event_store_products_set_updated_at
  before update on public.event_store_products
  for each row execute function public.set_event_store_updated_at();

-- ------------------------------------------------------------
-- 3) Variantes + estoque (sempre na variante)
-- ------------------------------------------------------------
create table if not exists public.event_store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.event_store_products (id) on delete cascade,
  name text not null default 'Padrão',
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_store_product_variants_name_len check (char_length(trim(name)) between 1 and 80)
);

create index if not exists event_store_product_variants_product_id_idx
  on public.event_store_product_variants (product_id);

create unique index if not exists event_store_product_variants_product_name_uidx
  on public.event_store_product_variants (product_id, lower(trim(name)));

comment on table public.event_store_product_variants is
  'Variantes/opções. Estoque SEMPRE aqui. Produto sem opção → 1 variante Padrão.';
comment on column public.event_store_product_variants.stock_quantity is
  'NULL = ilimitado. Inteiro = teto de unidades em pedidos não cancelados.';

drop trigger if exists event_store_product_variants_set_updated_at on public.event_store_product_variants;
create trigger event_store_product_variants_set_updated_at
  before update on public.event_store_product_variants
  for each row execute function public.set_event_store_updated_at();

-- ------------------------------------------------------------
-- 4) Pedido (1:1 com inscrição; só se houver produtos)
-- ------------------------------------------------------------
create table if not exists public.event_store_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organizer_id uuid references public.organizers (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  signup_id uuid not null references public.event_signups (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmada', 'cancelada')),
  products_amount numeric(12,2) not null default 0 check (products_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  fulfillment_type text not null default 'kit_pickup'
    check (fulfillment_type in ('kit_pickup')),
  fulfillment_note text not null default 'Retirada junto à entrega do kit da prova.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_store_orders_signup_uidx unique (signup_id)
);

create index if not exists event_store_orders_event_id_idx on public.event_store_orders (event_id);
create index if not exists event_store_orders_organizer_id_idx on public.event_store_orders (organizer_id);
create index if not exists event_store_orders_user_id_idx on public.event_store_orders (user_id);
create index if not exists event_store_orders_status_idx on public.event_store_orders (status);

comment on table public.event_store_orders is
  'Pedido da loja da prova, no máximo 1 por inscrição. organizer_id derivado de events.';

drop trigger if exists event_store_orders_set_updated_at on public.event_store_orders;
create trigger event_store_orders_set_updated_at
  before update on public.event_store_orders
  for each row execute function public.set_event_store_updated_at();

-- ------------------------------------------------------------
-- 5) Itens (snapshot)
-- ------------------------------------------------------------
create table if not exists public.event_store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.event_store_orders (id) on delete cascade,
  -- FKs nullable + SET NULL: hard delete de catálogo NÃO apaga histórico
  product_id uuid references public.event_store_products (id) on delete set null,
  variant_id uuid references public.event_store_product_variants (id) on delete set null,
  product_name_snapshot text not null,
  variant_name_snapshot text not null default '',
  image_url_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

-- Idempotente se a tabela já existia sem o snapshot de imagem
alter table public.event_store_order_items
  add column if not exists image_url_snapshot text;

create index if not exists event_store_order_items_order_id_idx
  on public.event_store_order_items (order_id);
create index if not exists event_store_order_items_variant_id_idx
  on public.event_store_order_items (variant_id)
  where variant_id is not null;

comment on table public.event_store_order_items is
  'Linhas com snapshot histórico (nome/variante/imagem/preço). '
  'Fonte de verdade para Minha Conta — não recalcular pelo catálogo. '
  'product_id/variant_id ON DELETE SET NULL.';
comment on column public.event_store_order_items.image_url_snapshot is
  'Cópia de event_store_products.image_url no checkout. NULL se o produto não tinha foto.';

-- ------------------------------------------------------------
-- 6) Helpers de preço (espelho do frontend — autoritativo no banco)
-- ------------------------------------------------------------
create or replace function public.event_store_is_kids_distance(_name text)
returns boolean
language sql
immutable
as $fn$
  select coalesce(_name, '') ~* '(kids|infantil|kid|mirim)';
$fn$;

create or replace function public.event_store_age_at_event(_birth date, _event_date date)
returns integer
language plpgsql
immutable
as $fn$
declare
  a integer;
begin
  if _birth is null or _event_date is null then
    return null;
  end if;
  a := extract(year from age(_event_date, _birth))::integer;
  return a;
end;
$fn$;

create or replace function public.event_store_current_lote_price(_dist jsonb, _today date)
returns numeric
language plpgsql
immutable
as $fn$
declare
  p1 numeric;
  p2 numeric;
  p3 numeric;
  d2 date;
  d3 date;
begin
  if _dist is null then
    return 0;
  end if;
  p1 := coalesce(nullif(_dist->>'price', '')::numeric, 0);
  begin
    p2 := nullif(_dist->>'price_lote2', '')::numeric;
    d2 := nullif(_dist->>'lote2_starts_at', '')::date;
  exception when others then
    p2 := null; d2 := null;
  end;
  begin
    p3 := nullif(_dist->>'price_lote3', '')::numeric;
    d3 := nullif(_dist->>'lote3_starts_at', '')::date;
  exception when others then
    p3 := null; d3 := null;
  end;

  if p3 is not null and p3 > 0 and d3 is not null and _today >= d3 then
    return round(p3, 2);
  end if;
  if p2 is not null and p2 > 0 and d2 is not null and _today >= d2 then
    return round(p2, 2);
  end if;
  return round(greatest(p1, 0), 2);
end;
$fn$;

create or replace function public.event_store_effective_distance_price(
  _dist jsonb,
  _senior boolean,
  _today date
)
returns numeric
language plpgsql
immutable
as $fn$
declare
  base numeric;
  senior_fixed numeric;
begin
  base := public.event_store_current_lote_price(_dist, _today);
  if not coalesce(_senior, false) then
    return base;
  end if;
  begin
    senior_fixed := nullif(_dist->>'price_60_plus', '')::numeric;
  exception when others then
    senior_fixed := null;
  end;
  if senior_fixed is not null and senior_fixed > 0 then
    return round(senior_fixed, 2);
  end if;
  return round(base / 2.0, 2);
end;
$fn$;

create or replace function public.event_store_find_distance(_distances jsonb, _distance text)
returns jsonb
language plpgsql
stable
as $fn$
declare
  elem jsonb;
  want text := trim(coalesce(_distance, ''));
begin
  if want = '' or _distances is null or jsonb_typeof(_distances) <> 'array' then
    return null;
  end if;
  for elem in select * from jsonb_array_elements(_distances)
  loop
    if trim(coalesce(elem->>'distance', '')) = want then
      return elem;
    end if;
  end loop;
  -- Kids: fallback primeira distância kids
  if public.event_store_is_kids_distance(want) then
    for elem in select * from jsonb_array_elements(_distances)
    loop
      if public.event_store_is_kids_distance(elem->>'distance') then
        return elem;
      end if;
    end loop;
  end if;
  return null;
end;
$fn$;

create or replace function public.event_store_active_lote(_dist jsonb, _today date)
returns integer
language plpgsql
immutable
as $fn$
declare
  p2 numeric; p3 numeric; d2 date; d3 date;
begin
  begin
    p2 := nullif(_dist->>'price_lote2', '')::numeric;
    d2 := nullif(_dist->>'lote2_starts_at', '')::date;
  exception when others then p2 := null; d2 := null;
  end;
  begin
    p3 := nullif(_dist->>'price_lote3', '')::numeric;
    d3 := nullif(_dist->>'lote3_starts_at', '')::date;
  exception when others then p3 := null; d3 := null;
  end;
  if p3 is not null and p3 > 0 and d3 is not null and _today >= d3 then
    return 3;
  end if;
  if p2 is not null and p2 > 0 and d2 is not null and _today >= d2 then
    return 2;
  end if;
  return 1;
end;
$fn$;

create or replace function public.event_store_last_lote(_dist jsonb)
returns integer
language plpgsql
immutable
as $fn$
declare
  p2 numeric; p3 numeric; d2 date; d3 date;
begin
  begin
    p2 := nullif(_dist->>'price_lote2', '')::numeric;
    d2 := nullif(_dist->>'lote2_starts_at', '')::date;
  exception when others then p2 := null; d2 := null;
  end;
  begin
    p3 := nullif(_dist->>'price_lote3', '')::numeric;
    d3 := nullif(_dist->>'lote3_starts_at', '')::date;
  exception when others then p3 := null; d3 := null;
  end;
  if p3 is not null and p3 > 0 and d3 is not null then return 3; end if;
  if p2 is not null and p2 > 0 and d2 is not null then return 2; end if;
  return 1;
end;
$fn$;

create or replace function public.event_store_kit_is_available(
  _kit jsonb,
  _dist jsonb,
  _today date
)
returns boolean
language plpgsql
immutable
as $fn$
declare
  avail text;
begin
  avail := lower(trim(coalesce(_kit->>'availability', '')));
  if avail = 'last_lot' then
    return public.event_store_active_lote(_dist, _today) = public.event_store_last_lote(_dist);
  end if;
  -- legado only_last_lot
  if coalesce((_kit->>'only_last_lot')::boolean, false) = true then
    return public.event_store_active_lote(_dist, _today) = public.event_store_last_lote(_dist);
  end if;
  -- default all_lots
  return true;
end;
$fn$;

create or replace function public.event_store_kit_adjustment(
  _kit_options jsonb,
  _selected_names jsonb,
  _dist jsonb,
  _today date
)
returns numeric
language plpgsql
stable
as $fn$
declare
  total numeric := 0;
  sel text;
  elem jsonb;
  found boolean;
  extra numeric;
begin
  if _selected_names is null or jsonb_typeof(_selected_names) <> 'array' then
    return 0;
  end if;
  if _kit_options is null or jsonb_typeof(_kit_options) <> 'array' then
    if jsonb_array_length(_selected_names) > 0 then
      raise exception 'STORE_KIT_INVALID' using errcode = 'P0001';
    end if;
    return 0;
  end if;

  for sel in
    select trim(x)
    from jsonb_array_elements_text(_selected_names) as t(x)
  loop
    if sel = '' then
      continue;
    end if;
    found := false;
    for elem in select * from jsonb_array_elements(_kit_options)
    loop
      if trim(coalesce(elem->>'name', '')) = sel then
        found := true;
        if not public.event_store_kit_is_available(elem, _dist, _today) then
          raise exception 'STORE_KIT_NOT_AVAILABLE'
            using errcode = 'P0001', detail = sel;
        end if;
        begin
          -- ASSINADO: Kit Econômico pode ser -20
          extra := coalesce(nullif(elem->>'extra_price', '')::numeric, 0);
        exception when others then
          extra := 0;
        end;
        total := total + extra;
        exit;
      end if;
    end loop;
    if not found then
      raise exception 'STORE_KIT_INVALID'
        using errcode = 'P0001', detail = sel;
    end if;
  end loop;

  return round(total, 2);
end;
$fn$;

create or replace function public.event_store_coupon_discount(
  _coupons jsonb,
  _code text,
  _base numeric
)
returns table (discount numeric, code_out text, coupon_json jsonb)
language plpgsql
stable
as $fn$
declare
  raw text := upper(trim(coalesce(_code, '')));
  elem jsonb;
  ctype text;
  cval numeric;
  d numeric := 0;
  base numeric := greatest(coalesce(_base, 0), 0);
begin
  if raw = '' then
    return query select 0::numeric, null::text, null::jsonb;
    return;
  end if;

  select e into elem
  from jsonb_array_elements(coalesce(_coupons, '[]'::jsonb)) e
  where upper(trim(e->>'code')) = raw
  limit 1;

  if elem is null then
    raise exception 'STORE_COUPON_INVALID' using errcode = 'P0001';
  end if;
  if coalesce((elem->>'active')::boolean, true) = false then
    raise exception 'STORE_COUPON_INACTIVE' using errcode = 'P0001';
  end if;

  ctype := lower(trim(coalesce(elem->>'type', '')));
  begin
    cval := nullif(elem->>'value', '')::numeric;
  exception when others then
    cval := null;
  end;

  -- Legado sem type/value → desconto 0 (mas código válido para tracking)
  if ctype in ('percentage', 'fixed') and cval is not null and cval > 0 then
    if ctype = 'percentage' then
      d := base * (least(greatest(cval, 0), 100) / 100.0);
    else
      d := cval;
    end if;
    d := least(greatest(round(d, 2), 0), base);
  else
    d := 0;
  end if;

  return query select d, raw, elem;
end;
$fn$;

-- ------------------------------------------------------------
-- 7) Estoque: contagem + disponibilidade + enforce
-- ------------------------------------------------------------
create or replace function public.event_store_variant_reserved_qty(_variant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(sum(i.quantity), 0)::integer
  from public.event_store_order_items i
  join public.event_store_orders o on o.id = i.order_id
  where i.variant_id = _variant_id
    and o.status is distinct from 'cancelada';
$fn$;

revoke all on function public.event_store_variant_reserved_qty(uuid) from public;
grant execute on function public.event_store_variant_reserved_qty(uuid) to anon, authenticated;

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
    (p.active and v.active),
    p.sale_starts_at,
    p.sale_ends_at
  from public.event_store_products p
  join public.event_store_product_variants v on v.product_id = p.id
  where p.event_id = _event_id
  order by p.sort_order, p.name, v.sort_order, v.name;
end;
$fn$;

revoke all on function public.get_event_store_availability(uuid) from public;
grant execute on function public.get_event_store_availability(uuid) to anon, authenticated;

create or replace function public.enforce_event_store_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stock integer;
  v_reserved integer;
  v_order_status text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  select o.status into v_order_status
  from public.event_store_orders o
  where o.id = new.order_id;

  if v_order_status is null or v_order_status = 'cancelada' then
    return new;
  end if;

  if new.variant_id is null then
    raise exception 'STORE_VARIANT_REQUIRED' using errcode = 'P0001';
  end if;

  select stock_quantity into v_stock
  from public.event_store_product_variants
  where id = new.variant_id
  for update;

  if not found then
    raise exception 'STORE_VARIANT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_stock is null then
    return new;
  end if;

  -- BEFORE INSERT: reserved ainda não inclui esta linha
  -- BEFORE UPDATE: reserved inclui quantidade antiga
  v_reserved := public.event_store_variant_reserved_qty(new.variant_id);

  if tg_op = 'INSERT' then
    v_reserved := v_reserved + new.quantity;
  elsif tg_op = 'UPDATE' then
    if old.variant_id = new.variant_id then
      v_reserved := v_reserved - old.quantity + new.quantity;
    else
      v_reserved := v_reserved + new.quantity;
    end if;
  end if;

  if v_reserved > v_stock then
    raise exception 'STORE_OUT_OF_STOCK'
      using errcode = 'P0001',
            detail = format('variant=%s need=%s stock=%s', new.variant_id, v_reserved, v_stock);
  end if;

  return new;
end;
$fn$;

drop trigger if exists event_store_order_items_enforce_stock on public.event_store_order_items;
create trigger event_store_order_items_enforce_stock
  before insert or update of quantity, variant_id, order_id
  on public.event_store_order_items
  for each row execute function public.enforce_event_store_stock();

-- ------------------------------------------------------------
-- 8) Sync status inscrição → pedido + reativação com revalidação
-- ------------------------------------------------------------
create or replace function public.event_store_assert_order_stock_for_reactivation(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_stock integer;
  v_reserved integer;
begin
  for r in
    select i.variant_id, sum(i.quantity)::integer as qty
    from public.event_store_order_items i
    where i.order_id = _order_id
      and i.variant_id is not null
    group by i.variant_id
    order by i.variant_id
  loop
    select stock_quantity into v_stock
    from public.event_store_product_variants
    where id = r.variant_id
    for update;

    if not found then
      raise exception 'STORE_VARIANT_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_stock is null then
      continue;
    end if;

    v_reserved := public.event_store_variant_reserved_qty(r.variant_id);

    if v_reserved + r.qty > v_stock then
      raise exception 'STORE_OUT_OF_STOCK'
        using errcode = 'P0001',
              detail = format('reactivate variant=%s reserved=%s need=%s stock=%s',
                r.variant_id, v_reserved, r.qty, v_stock);
    end if;
  end loop;
end;
$fn$;

create or replace function public.sync_event_store_order_status_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_old_status text;
begin
  -- Inerte para o fluxo atual: sem pedido da loja → no-op imediato.
  -- Inscrições legadas / ProvaInscricao atual nunca criam event_store_orders.
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  select id, status into v_order_id, v_old_status
  from public.event_store_orders
  where signup_id = new.id
  for update;

  if v_order_id is null then
    return new;
  end if;

  -- cancelada → pendente/confirmada: revalida estoque ANTES de reativar
  if old.status = 'cancelada' and new.status is distinct from 'cancelada' then
    perform public.event_store_assert_order_stock_for_reactivation(v_order_id);
  end if;

  update public.event_store_orders
  set status = new.status,
      updated_at = now()
  where id = v_order_id
    and status is distinct from new.status;

  return new;
end;
$fn$;

drop trigger if exists event_signups_sync_store_order_status on public.event_signups;
create trigger event_signups_sync_store_order_status
  after update of status on public.event_signups
  for each row execute function public.sync_event_store_order_status_from_signup();

-- ------------------------------------------------------------
-- 9) RPC ÚNICA DE CHECKOUT ATÔMICO
--
-- Frontend envia IDs / textos / quantidades.
-- Servidor calcula preços, totais, organizer_id, comissão e grava tudo
-- na mesma transação (ou falha e reverte).
--
-- Triggers existentes de capacity / shirt / coupon continuam
-- rodando no INSERT/UPDATE de event_signups.
-- ------------------------------------------------------------
drop function if exists public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
);
drop function if exists public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb, uuid
);

create or replace function public.create_event_signup_with_store(
  _event_id uuid,
  _distance text,
  _category text,
  _kit_names jsonb default '[]'::jsonb,      -- ["Kit Completo"]
  _shirt_size text default null,
  _coupon_code text default null,
  _team_name text default '',
  _notes text default '',
  _participant_full_name text default '',
  _participant_cpf text default null,
  _participant_birth_date text default null,
  _participant_gender text default null,
  _participant_phone text default null,
  _accepted_event_terms_at timestamptz default now(),
  _store_items jsonb default '[]'::jsonb     -- [{ "variant_id": "...", "quantity": 1 }]
  -- MVP: SEM _existing_signup_id (superfície insegura). Retomada = nova chamada
  -- ou fluxo separado futuro com regras explícitas.
)
returns table (
  signup_id uuid,
  order_id uuid,
  registration_base_amount numeric,
  kit_adjustment_amount numeric,
  discount_amount numeric,
  registration_amount numeric,
  products_amount numeric,
  total_amount numeric,
  commission_percentage_snapshot numeric,
  commission_base_amount numeric,
  commission_amount numeric,
  organizer_net_amount numeric,
  pricing_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_dist jsonb;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_age integer;
  v_senior boolean := false;
  v_senior_fixed boolean := false;
  v_base numeric(12,2) := 0;
  v_kit_adj numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_reg_amount numeric(12,2) := 0;
  v_products numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon_code text := '';
  v_coupon_json jsonb;
  v_coupon_type text;
  v_coupon_value numeric;
  v_signup_id uuid;
  v_order_id uuid := null;
  v_snapshot jsonb;
  v_kit_option text := '';
  r jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_product public.event_store_products%rowtype;
  v_variant public.event_store_product_variants%rowtype;
  v_unit numeric(12,2);
  v_line numeric(12,2);
  v_item_lines jsonb := '[]'::jsonb;
  v_birth date;
  v_lote integer := 1;
  v_last_lote integer := 1;
  v_variant_ids uuid[];
  v_sorted_items jsonb := '[]'::jsonb;
  v_org_pct numeric := 0;
  v_org_is_platform boolean := false;
  v_is_platform boolean := true;
  v_commission_pct numeric(8,4) := 0;
  v_commission_base numeric(12,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_organizer_net numeric(12,2) := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  begin
    v_birth := nullif(trim(coalesce(_participant_birth_date, '')), '')::date;
  exception when others then
    raise exception 'BIRTH_DATE_INVALID' using errcode = 'P0001';
  end;

  if _event_id is null then
    raise exception 'EVENT_REQUIRED' using errcode = 'P0001';
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

  -- Comissão congelada no checkout — identificação ESTRUTURAL:
  --   organizer_id null OU is_platform_owner → pct 0
  --   parceiro → organizers.commission_percentage
  -- NUNCA derivar comissão pelo nome.
  v_is_platform := true;
  v_commission_pct := 0;
  if v_event.organizer_id is not null then
    select coalesce(o.commission_percentage, 0),
           coalesce(o.is_platform_owner, false)
      into v_org_pct, v_org_is_platform
    from public.organizers o
    where o.id = v_event.organizer_id;

    if found and v_org_is_platform is not true then
      v_is_platform := false;
      v_commission_pct := greatest(coalesce(v_org_pct, 0), 0);
    end if;
  end if;

  if trim(coalesce(_participant_full_name, '')) = '' then
    raise exception 'PARTICIPANT_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if trim(coalesce(_distance, '')) = '' then
    raise exception 'DISTANCE_REQUIRED' using errcode = 'P0001';
  end if;
  if trim(coalesce(_category, '')) = '' then
    raise exception 'CATEGORY_REQUIRED' using errcode = 'P0001';
  end if;
  if _accepted_event_terms_at is null then
    raise exception 'TERMS_REQUIRED' using errcode = 'P0001';
  end if;

  v_dist := public.event_store_find_distance(v_event.distances, _distance);
  if v_dist is null then
    raise exception 'DISTANCE_INVALID' using errcode = 'P0001';
  end if;

  v_age := public.event_store_age_at_event(
    v_birth,
    case when v_event.date is null then null else (v_event.date::text)::date end
  );
  v_senior := (
    not public.event_store_is_kids_distance(_distance)
    and v_age is not null
    and v_age >= 60
  );
  begin
    v_senior_fixed := v_senior
      and coalesce(nullif(v_dist->>'price_60_plus', '')::numeric, 0) > 0;
  exception when others then
    v_senior_fixed := false;
  end;

  v_base := public.event_store_effective_distance_price(v_dist, v_senior, v_today);
  v_lote := public.event_store_active_lote(v_dist, v_today);
  v_last_lote := public.event_store_last_lote(v_dist);

  -- Kits (valida last_lot / all_lots; extra_price ASSINADO)
  v_kit_adj := public.event_store_kit_adjustment(
    coalesce(v_event.kit_options, '[]'::jsonb),
    coalesce(_kit_names, '[]'::jsonb),
    v_dist,
    v_today
  );
  if jsonb_typeof(coalesce(_kit_names, '[]'::jsonb)) = 'array'
     and jsonb_array_length(_kit_names) > 0 then
    v_kit_option := _kit_names::text;
  end if;

  -- Cupom só sobre max(0, base+kit)
  select d.discount, d.code_out, d.coupon_json
    into v_discount, v_coupon_code, v_coupon_json
  from public.event_store_coupon_discount(
    v_event.coupons,
    _coupon_code,
    greatest(v_base + v_kit_adj, 0)
  ) d;

  v_coupon_code := coalesce(v_coupon_code, '');
  v_coupon_type := lower(trim(coalesce(v_coupon_json->>'type', '')));
  begin
    v_coupon_value := nullif(v_coupon_json->>'value', '')::numeric;
  exception when others then
    v_coupon_value := null;
  end;

  v_reg_amount := greatest(v_base + v_kit_adj - coalesce(v_discount, 0), 0);

  -- Ordena itens por variant_id (locks determinísticos)
  if _store_items is not null
     and jsonb_typeof(_store_items) = 'array'
     and jsonb_array_length(_store_items) > 0 then
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
  else
    v_sorted_items := '[]'::jsonb;
  end if;

  insert into public.event_signups (
    user_id, event_id, category, status, notes, kit_option, shirt_size,
    coupon_code, team_name, accepted_event_terms_at,
    participant_full_name, participant_cpf, participant_birth_date,
    participant_gender, participant_phone,
    registration_base_amount, kit_adjustment_amount, discount_amount,
    registration_amount, products_amount, total_amount, pricing_snapshot
  ) values (
    v_uid, _event_id, trim(_category), 'pendente', coalesce(_notes, ''),
    v_kit_option, nullif(trim(coalesce(_shirt_size, '')), ''),
    v_coupon_code, coalesce(_team_name, ''), _accepted_event_terms_at,
    trim(_participant_full_name),
    nullif(trim(coalesce(_participant_cpf, '')), ''),
    case when v_birth is null then null else v_birth::text end,
    nullif(trim(coalesce(_participant_gender, '')), ''),
    nullif(trim(coalesce(_participant_phone, '')), ''),
    v_base, v_kit_adj, v_discount, v_reg_amount, null, null, null
  )
  returning id into v_signup_id;

  if jsonb_array_length(v_sorted_items) > 0 then
    insert into public.event_store_orders (
      event_id, organizer_id, user_id, signup_id, status,
      products_amount, total_amount, fulfillment_type
    ) values (
      v_event.id,
      v_event.organizer_id,
      v_uid,
      v_signup_id,
      'pendente',
      0, 0,
      'kit_pickup'
    )
    returning id into v_order_id;

    -- Pré-lock de todas as variantes em ordem estável
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

      -- Janela de venda: autoridade no servidor (frontend NÃO decide)
      if v_product.sale_starts_at is not null
         and now() < v_product.sale_starts_at then
        raise exception 'STORE_PRODUCT_NOT_STARTED' using errcode = 'P0001';
      end if;
      if v_product.sale_ends_at is not null
         and now() > v_product.sale_ends_at then
        raise exception 'STORE_PRODUCT_SALES_ENDED' using errcode = 'P0001';
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

      -- pricing_snapshot.store_items: IDs + valores (sem image — evita duplicar
      -- image_url_snapshot que já vive no order item histórico)
      v_item_lines := v_item_lines || jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant.id,
        'product_id', v_product.id,
        'product_name', v_product.name,
        'variant_name', v_variant.name,
        'unit_price', v_unit,
        'quantity', v_qty,
        'line_total', v_line
      ));
    end loop;

    update public.event_store_orders
    set products_amount = v_products,
        total_amount = v_products,
        updated_at = now()
    where id = v_order_id;
  end if;

  v_total := v_reg_amount + v_products;

  -- Comissão sobre TODO o valor movimentado (inscrição + produtos).
  -- NÃO gravar comissão separada em event_store_orders.
  v_commission_base := v_total;
  v_commission_amount := round(v_total * v_commission_pct / 100.0, 2);
  v_organizer_net := greatest(v_total - v_commission_amount, 0);

  v_snapshot := jsonb_build_object(
    'version', 2,
    'distance', trim(_distance),
    'category', trim(_category),
    'lote', v_lote,
    'last_lote', v_last_lote,
    'senior', v_senior,
    'senior_fixed', v_senior_fixed,
    'age_at_event', v_age,
    'registration_base_amount', v_base,
    'kit_adjustment_amount', v_kit_adj,
    'discount_amount', v_discount,
    'registration_amount', v_reg_amount,
    'products_amount', v_products,
    'total_amount', v_total,
    'commission_percentage_snapshot', v_commission_pct,
    'commission_base_amount', v_commission_base,
    'commission_amount', v_commission_amount,
    'organizer_net_amount', v_organizer_net,
    'is_platform_owned', v_is_platform,
    'coupon_code', nullif(v_coupon_code, ''),
    'coupon_type', nullif(v_coupon_type, ''),
    'coupon_value', v_coupon_value,
    'kit_names', coalesce(_kit_names, '[]'::jsonb),
    'store_items', v_item_lines,
    'currency', 'BRL',
    'priced_at', now(),
    'priced_on_date', v_today
  );

  update public.event_signups
  set products_amount = v_products,
      total_amount = v_total,
      commission_percentage_snapshot = v_commission_pct,
      commission_base_amount = v_commission_base,
      commission_amount = v_commission_amount,
      organizer_net_amount = v_organizer_net,
      pricing_snapshot = v_snapshot,
      updated_at = now()
  where id = v_signup_id;

  return query select
    v_signup_id,
    v_order_id,
    v_base,
    v_kit_adj,
    v_discount,
    v_reg_amount,
    v_products,
    v_total,
    v_commission_pct,
    v_commission_base,
    v_commission_amount,
    v_organizer_net,
    v_snapshot;
end;
$fn$;

-- Drop assinatura antiga (com existing_signup_id) se existir
drop function if exists public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb, uuid
);

revoke all on function public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public;

grant execute on function public.create_event_signup_with_store(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
) to authenticated;

-- Helpers internos: sem execute público
revoke all on function public.event_store_variant_reserved_qty(uuid) from public;
revoke all on function public.event_store_kit_adjustment(jsonb, jsonb, jsonb, date) from public;
revoke all on function public.event_store_coupon_discount(jsonb, text, numeric) from public;
revoke all on function public.event_store_assert_order_stock_for_reactivation(uuid) from public;
-- availability continua pública (UI)
grant execute on function public.event_store_variant_reserved_qty(uuid) to authenticated;
grant execute on function public.get_event_store_availability(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 10) RLS
-- ------------------------------------------------------------
alter table public.event_store_products enable row level security;
alter table public.event_store_product_variants enable row level security;
alter table public.event_store_orders enable row level security;
alter table public.event_store_order_items enable row level security;

-- Produtos
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_products_select_active' and tablename = 'event_store_products') then
    create policy event_store_products_select_active
      on public.event_store_products for select to anon, authenticated
      using (
        active = true
        and exists (
          select 1 from public.events e
          where e.id = event_store_products.event_id
            and coalesce(e.active, false) = true
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_products_select_admin' and tablename = 'event_store_products') then
    create policy event_store_products_select_admin
      on public.event_store_products for select to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_products_select_organizer' and tablename = 'event_store_products') then
    create policy event_store_products_select_organizer
      on public.event_store_products for select to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_store_products.event_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_products_write_admin' and tablename = 'event_store_products') then
    create policy event_store_products_write_admin
      on public.event_store_products for all to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_products_write_organizer' and tablename = 'event_store_products') then
    create policy event_store_products_write_organizer
      on public.event_store_products for all to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_store_products.event_id and o.user_id = auth.uid()
        )
      )
      with check (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_store_products.event_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Variantes
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_variants_select_active' and tablename = 'event_store_product_variants') then
    create policy event_store_variants_select_active
      on public.event_store_product_variants for select to anon, authenticated
      using (
        active = true
        and exists (
          select 1 from public.event_store_products p
          join public.events e on e.id = p.event_id
          where p.id = event_store_product_variants.product_id
            and p.active = true
            and coalesce(e.active, false) = true
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_variants_select_admin' and tablename = 'event_store_product_variants') then
    create policy event_store_variants_select_admin
      on public.event_store_product_variants for select to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_variants_select_organizer' and tablename = 'event_store_product_variants') then
    create policy event_store_variants_select_organizer
      on public.event_store_product_variants for select to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_variants.product_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_variants_write_admin' and tablename = 'event_store_product_variants') then
    create policy event_store_variants_write_admin
      on public.event_store_product_variants for all to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_variants_write_organizer' and tablename = 'event_store_product_variants') then
    create policy event_store_variants_write_organizer
      on public.event_store_product_variants for all to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_variants.product_id and o.user_id = auth.uid()
        )
      )
      with check (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_variants.product_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Pedidos / itens: SELECT próprio / admin / organizer. Sem INSERT público.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_orders_select_own' and tablename = 'event_store_orders') then
    create policy event_store_orders_select_own
      on public.event_store_orders for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_orders_select_admin' and tablename = 'event_store_orders') then
    create policy event_store_orders_select_admin
      on public.event_store_orders for select to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_orders_select_organizer' and tablename = 'event_store_orders') then
    create policy event_store_orders_select_organizer
      on public.event_store_orders for select to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.organizers o
          where o.id = event_store_orders.organizer_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_order_items_select_own' and tablename = 'event_store_order_items') then
    create policy event_store_order_items_select_own
      on public.event_store_order_items for select to authenticated
      using (
        exists (
          select 1 from public.event_store_orders o
          where o.id = event_store_order_items.order_id and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_order_items_select_admin' and tablename = 'event_store_order_items') then
    create policy event_store_order_items_select_admin
      on public.event_store_order_items for select to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'event_store_order_items_select_organizer' and tablename = 'event_store_order_items') then
    create policy event_store_order_items_select_organizer
      on public.event_store_order_items for select to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1 from public.event_store_orders o
          join public.organizers org on org.id = o.organizer_id
          where o.id = event_store_order_items.order_id and org.user_id = auth.uid()
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- FIM — NÃO APLICAR sem revisão humana.
--
-- Contrato frontend (próxima fase):
--   supabase.rpc('create_event_signup_with_store', { ... })
--   PixPayment.amount = returned.total_amount
--   PIX key = get_event_payment_info(event_id)
--
-- Comissão (relatórios futuros):
--   pendente    → potencial
--   confirmada  → realizado
--   cancelada   → fora do realizado (snapshot preservado)
--
-- PRÓXIMO PASSO: validar RPC em branch/ambiente isolado — NÃO produção.
-- ============================================================
