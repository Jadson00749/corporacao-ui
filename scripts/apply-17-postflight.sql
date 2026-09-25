-- ============================================================
-- PASSO C — POST-FLIGHT READ-ONLY (após apply migration 17)
--
-- NÃO altera dados. Validar estrutura + legado.
-- ============================================================

-- C1) Platform owner
select id, name, is_platform_owner, commission_percentage
from public.organizers
order by is_platform_owner desc, name;

select count(*) as platform_owners
from public.organizers where is_platform_owner = true;
-- Esperado: 1

select indexname from pg_indexes
where tablename = 'organizers' and indexname = 'organizers_one_platform_owner_uidx';

-- C2) Colunas financeiras nullable (sem default inventando 0)
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'event_signups'
  and column_name in (
    'registration_base_amount','kit_adjustment_amount','discount_amount',
    'registration_amount','products_amount','total_amount',
    'commission_percentage_snapshot','commission_base_amount',
    'commission_amount','organizer_net_amount','pricing_snapshot'
  )
order by column_name;
-- Esperado: is_nullable = YES, column_default IS NULL

-- C3) Legado: snapshots NULL
select
  count(*) as signups_total,
  count(*) filter (where total_amount is null) as total_null,
  count(*) filter (where commission_amount is null) as commission_null,
  count(*) filter (where pricing_snapshot is null) as snapshot_null
from public.event_signups;
-- Esperado pós-apply imediato (sem RPC): quase todos NULL

-- C4) Tabelas / RLS
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'event_store_products','event_store_product_variants',
    'event_store_orders','event_store_order_items'
  )
order by 1;
-- Esperado: 4 tabelas, relrowsecurity = true

-- C5) Funções novas + antigas
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_event_signup_with_store',
    'get_event_store_availability',
    'get_event_payment_info',
    'sync_event_store_order_status_from_signup',
    'enforce_event_store_stock',
    'organizers_guard_non_payment_update'
  )
order by 1;

-- C6) Trigger de sync existe e é AFTER UPDATE OF status
select tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'event_signups'
  and tgname = 'event_signups_sync_store_order_status';

-- C7) Triggers legados AINDA presentes
select tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'event_signups' and not t.tgisinternal
  and tgname in (
    'event_signups_enforce_capacity',
    'event_signups_enforce_shirt_size_stock',
    'event_signups_enforce_coupon_max_uses'
  )
order by 1;
-- Esperado: 3 linhas (nomes exatos conforme prod)

-- C8) get_event_payment_info ainda responde (substitua event_id ativo)
-- select * from public.get_event_payment_info('<event_id_ativo>');

-- C9) Pedidos da loja: deve estar vazio na FASE 1
select count(*) as store_orders from public.event_store_orders;
select count(*) as store_products from public.event_store_products;
