-- ============================================================
-- Validação pós-migration 23 (NÃO rodar até aplicar 23)
-- Contratos RLS / RPC / atraso standalone.
-- ============================================================

-- 1) Colunas
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='event_store_orders'
--   and column_name in (
--     'order_type','buyer_name_snapshot','fulfillment_status',
--     'commission_percentage_snapshot','pickup_terms_version'
--   );

-- 2) Pedidos históricos preservados como signup_bundle
-- select id, signup_id, order_type from event_store_orders;
-- -- esperado: 2 linhas, order_type='signup_bundle', signup_id NOT NULL

-- 3) RPCs
-- select proname from pg_proc where proname in (
--   'create_event_store_standalone_order',
--   'update_event_store_order_fulfillment',
--   'update_event_store_standalone_payment_status',
--   'mark_overdue_standalone_store_orders'
-- );

-- 4) SEM policies UPDATE genéricas
-- select policyname, cmd from pg_policies
-- where tablename='event_store_orders' and cmd='UPDATE';
-- -- esperado: 0 linhas (ou nenhuma das *update_fulfillment*)

-- 5) Cron job
-- select jobname, schedule from cron.job
-- where jobname = 'mark-overdue-standalone-store-orders';

-- 6) Estoque: reserved inclui standalone (status ≠ cancelada)
-- select public.event_store_variant_reserved_qty('<variant_id>');

-- 7) RLS smoke (como usuário autenticado A):
--   select * from event_store_orders where user_id <> auth.uid(); -- deve 0
-- Como organizer B sem vínculo:
--   select * from event_store_orders where event_id = '<prova de outro>'; -- deve 0
-- Comprador NÃO deve conseguir:
--   select update_event_store_order_fulfillment('<order_id>', 'retirado'); -- FORBIDDEN
