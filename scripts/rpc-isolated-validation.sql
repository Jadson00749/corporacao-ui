-- ============================================================
-- ROTEIRO — validação isolada da migration 17 + RPC
--
-- NÃO rodar em produção.
-- Destino: Supabase branch / projeto de desenvolvimento
--          (dados de produção NÃO são copiados).
--
-- Ordem:
--   1) Aplicar 17-event-store-per-event.sql (banco vazio → OK)
--   2) Seed: Corporação + parceiro + eventos + produto
--   3) Conferir pré-checks
--   4) Executar cenários A–S (usuário autenticado)
-- ============================================================

-- ------------------------------------------------------------
-- 1) APLICAR MIGRATION (branch vazia)
-- ------------------------------------------------------------
-- Cole/rode 17-event-store-per-event.sql no SQL Editor do branch.
-- Esperado com 0 organizers: conclui sem PLATFORM_OWNER_NOT_IDENTIFIED.

-- ------------------------------------------------------------
-- 2) SEED (obrigatório em branch sem dados de produção)
-- ------------------------------------------------------------
-- Ajuste user_id para um auth.users existente no branch (admin/teste).
-- Substitua :seed_user_id.

-- 2a) Corporação fictícia
insert into public.organizers (
  user_id, name, status, commission_percentage, is_platform_owner
) values (
  ':seed_user_id'::uuid,
  'Corporação Teste',
  'aprovado',
  0,
  true
)
on conflict do nothing; -- se houver unique em user_id, ajuste manualmente

-- Se o insert acima não existir (ex.: constraint), use:
-- insert ... returning id;
-- e guarde :corp_organizer_id

-- 2b) Garantir flag (idempotente)
update public.organizers
set is_platform_owner = true
where name = 'Corporação Teste'
  and not exists (
    select 1 from public.organizers where is_platform_owner = true
  );

-- 2c) Parceiro fictício @5%
insert into public.organizers (
  user_id, name, status, commission_percentage, is_platform_owner
) values (
  ':seed_partner_user_id'::uuid,  -- outro user OU mesmo se schema permitir
  'Parceiro Teste',
  'aprovado',
  5,
  false
);

-- 2d) Eventos de teste (estrutura mínima — ajuste colunas NOT NULL do schema)
-- Platform (liga ao corp OU organizer_id null):
-- insert into public.events (..., organizer_id, active, distances, ...)
-- values (..., :corp_organizer_id, true, '[{"distance":"5Km","price":89.9}]'::jsonb, ...);
--
-- Partner:
-- insert into public.events (..., organizer_id, ...)
-- values (..., :partner_organizer_id, ...);
--
-- Depois: produto/variante na prova parceira (stock>=2 e um com stock=1).

-- Guarde:
--   :event_platform_id
--   :event_partner_id
--   :variant_id        (stock >= 2)
--   :variant_last_id   (stock = 1)

-- ------------------------------------------------------------
-- 3) PRÉ-CHECKS
-- ------------------------------------------------------------
select id, name, is_platform_owner, commission_percentage
from public.organizers
order by is_platform_owner desc, name;
-- Esperado: exatamente 1 is_platform_owner=true (Corporação Teste)
--           1 parceiro @5%

select indexname, indexdef
from pg_indexes
where tablename = 'organizers' and indexname = 'organizers_one_platform_owner_uidx';

select
  round(0.005::numeric, 2)  as r_0005,   -- 0.01
  round(1.005::numeric, 2)  as r_1005,   -- 1.01
  round(2.675::numeric, 2)  as r_2675,   -- 2.68
  round(10.125::numeric, 2) as r_10125;  -- 10.13

-- Fail-fast smoke (deve falhar se apagar o único platform owner):
-- begin;
--   update public.organizers set is_platform_owner = false where is_platform_owner;
--   -- reexecutar o bloco do$$ FAIL-FAST da migration → PLATFORM_OWNER_NOT_IDENTIFIED
-- rollback;

-- ------------------------------------------------------------
-- 4) RPC — exemplo autenticado
-- ------------------------------------------------------------
-- select * from public.create_event_signup_with_store(
--   _event_id := ':event_partner_id',
--   _distance := '5Km',
--   _category := 'Geral',
--   _kit_names := '[]'::jsonb,
--   _shirt_size := null,
--   _coupon_code := null,
--   _team_name := '',
--   _notes := '',
--   _participant_full_name := 'Teste Isolado',
--   _participant_cpf := '00000000191',
--   _participant_birth_date := '1990-01-01',
--   _participant_gender := 'outro',
--   _participant_phone := '11999999999',
--   _accepted_event_terms_at := now(),
--   _store_items := '[]'::jsonb
-- );

-- ------------------------------------------------------------
-- 5) CENÁRIOS A–S (checklist)
-- ------------------------------------------------------------
-- A. inscrição simples (sem produto) — partner
-- B. kit + preço (extra_price > 0)
-- C. kit econômico negativo (last_lot)
-- D. cupom percentual
-- E. cupom 100% sem produto
-- F. cupom 100% + produto
-- G. produto qty > 1
-- H. estoque última unidade
-- I. duas compras concorrentes (última unidade)
-- J. cancelamento libera estoque (snapshot permanece)
-- K. reativação revalida estoque
-- L. parceiro 5% — commission_percentage_snapshot=5
-- M. Corporação/platform 0% — is_platform_owner OU organizer_id null
-- N. mudar commission_percentage do parceiro NÃO altera snapshot antigo
-- O. _store_items com unit_price → STORE_CLIENT_PRICE_FORBIDDEN
-- P. produto de outra prova → STORE_PRODUCT_WRONG_EVENT
-- Q. variante inativa → STORE_VARIANT_INACTIVE
-- R. CPF duplicado ativo → erro trigger existente
-- S. inscrição cancelada → nova com mesmo CPF OK

-- ------------------------------------------------------------
-- 6) NÃO REGRESSÃO (smoke)
-- ------------------------------------------------------------
-- [ ] Snapshots NULL em rows legadas (se houver)
-- [ ] Signup sem produto: order_id null
-- [ ] Capacidade / camiseta / cupom / CPF / PIX (get_event_payment_info)
-- [ ] AdminEventSignups: status sync signup ↔ order
-- [ ] Sem commission em event_store_orders

-- ------------------------------------------------------------
-- QUERIES PÓS-CENÁRIO
-- ------------------------------------------------------------
-- select id, status,
--   registration_amount, products_amount, total_amount,
--   commission_percentage_snapshot, commission_amount, organizer_net_amount,
--   pricing_snapshot->>'version' as snap_ver,
--   pricing_snapshot->>'is_platform_owned' as platform
-- from public.event_signups
-- where created_at > now() - interval '2 hours'
-- order by created_at desc;
