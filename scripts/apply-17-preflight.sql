-- ============================================================
-- PASSO A — PRE-FLIGHT READ-ONLY (migration 17)
--
-- Executar no SQL Editor do projeto REAL antes do apply.
-- NÃO altera dados. NÃO aplica a migration 17.
-- ============================================================

-- A1) Platform owner — o que o backfill faria
select
  (select count(*) from public.organizers) as organizers_total,
  (select count(*) from public.organizers
   where name ~* 'corpora[çc][ãa]o') as backfill_name_matches,
  (select count(*) from public.events where organizer_id is null) as events_organizer_null;

select o.id, o.name, o.status, o.commission_percentage,
       (o.name ~* 'corpora[çc][ãa]o') as matches_backfill_regex
from public.organizers o
order by matches_backfill_regex desc, o.name;

-- Candidato único ao backfill (order by id limit 1)
select x.id, x.name, x.commission_percentage as would_be_platform_owner
from public.organizers x
where x.name ~* 'corpora[çc][ãa]o'
order by x.id
limit 1;

select
  case
    when (select count(*) from public.organizers) = 0
      then 'ABORT_UNEXPECTED — produção sem organizers?'
    when (select count(*) from public.organizers
          where name ~* 'corpora[çc][ãa]o') = 0
      then 'ABORT — PLATFORM_OWNER_NOT_IDENTIFIED (migration vai falhar)'
    when (select count(*) from public.organizers
          where name ~* 'corpora[çc][ãa]o') = 1
      then 'OK_READY — 1 match; backfill seguro'
    else 'REVIEW — múltiplos matches; backfill marca só o 1º por id'
  end as preflight_verdict;

-- A2) Colunas financeiras já existem? (re-apply idempotente)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'event_signups'
  and column_name in (
    'registration_base_amount','kit_adjustment_amount','discount_amount',
    'registration_amount','products_amount','total_amount',
    'commission_percentage_snapshot','commission_base_amount',
    'commission_amount','organizer_net_amount','pricing_snapshot','kits_amount'
  )
order by column_name;

-- A3) Tabelas da loja já existem?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'event_store_%'
order by table_name;

-- A4) Funções críticas atuais intactas (devem existir ANTES)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_event_payment_info',
    'list_event_signups_public',
    'organizers_guard_non_payment_update'
  )
order by 1;

-- A5) Triggers atuais em event_signups (baseline)
select tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'event_signups' and not t.tgisinternal
order by 1;

-- A6) Contagens de não-regressão (baseline)
select
  (select count(*) from public.event_signups) as signups_total,
  (select count(*) from public.event_signups where status = 'pendente') as pendente,
  (select count(*) from public.event_signups where status = 'confirmada') as confirmada,
  (select count(*) from public.event_signups where status = 'cancelada') as cancelada,
  (select count(*) from public.events where coalesce(active,false)) as events_active;
