-- ============================================================
-- ROLLBACK / EMERGÊNCIA — migration 17 (FASE 1)
--
-- NÃO executar de rotina.
-- Usar só se o smoke do site atual falhar após o apply.
--
-- Ordem: do mais específico ao mais amplo.
-- Snapshots nullable em event_signups podem ficar (inofensivos).
-- ============================================================

-- E1) Desativar sync (volta UPDATE de status ao comportamento pré-17
--     quanto a pedidos — sem pedidos, já era no-op)
-- drop trigger if exists event_signups_sync_store_order_status on public.event_signups;

-- E2) Remover RPC / helpers da loja (opcional)
-- drop function if exists public.create_event_signup_with_store(
--   uuid, text, text, jsonb, text, text, text, text, text, text, text, text, text, timestamptz, jsonb
-- );
-- drop function if exists public.get_event_store_availability(uuid);
-- drop function if exists public.event_store_variant_reserved_qty(uuid);
-- drop function if exists public.enforce_event_store_stock();
-- drop function if exists public.event_store_assert_order_stock_for_reactivation(uuid);
-- drop function if exists public.sync_event_store_order_status_from_signup();
-- (helpers de preço event_store_* também podem ser dropados se desejado)

-- E3) Dropar tabelas da loja (CASCADE remove items/policies)
-- drop table if exists public.event_store_order_items cascade;
-- drop table if exists public.event_store_orders cascade;
-- drop table if exists public.event_store_product_variants cascade;
-- drop table if exists public.event_store_products cascade;

-- E4) Colunas financeiras (OPCIONAL — legado já usa NULL)
-- alter table public.event_signups
--   drop column if exists registration_base_amount,
--   drop column if exists kit_adjustment_amount,
--   drop column if exists discount_amount,
--   drop column if exists registration_amount,
--   drop column if exists products_amount,
--   drop column if exists total_amount,
--   drop column if exists commission_percentage_snapshot,
--   drop column if exists commission_base_amount,
--   drop column if exists commission_amount,
--   drop column if exists organizer_net_amount,
--   drop column if exists pricing_snapshot;

-- E5) is_platform_owner (OPCIONAL — frontend atual não usa)
-- drop index if exists public.organizers_one_platform_owner_uidx;
-- alter table public.organizers drop column if exists is_platform_owner;
-- Recriar organizers_guard a partir de 08-organizer-payment-contact.sql
--   (sem a linha is_platform_owner) se necessário.

-- E6) notify pgrst, 'reload schema';

-- NOTA: não há “undo” automático de CREATE OR REPLACE do guard.
-- Se precisar restaurar o guard exato da migration 08, reexecute
-- o bloco da função em 08-organizer-payment-contact.sql.
