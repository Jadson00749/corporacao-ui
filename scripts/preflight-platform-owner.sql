-- ============================================================
-- PRE-FLIGHT produção — migration 17 (platform owner)
--
-- SOMENTE LEITURA. Não altera dados.
-- NÃO aplicar a migration 17 aqui.
--
-- Objetivo: ver o que o backfill faria ANTES de rodar a migration.
-- ============================================================

-- 1) Totais
select
  (select count(*) from public.organizers) as organizers_total,
  (select count(*) from public.organizers
   where name ~* 'corpora[çc][ãa]o') as backfill_name_matches,
  (select count(*) from public.events
   where organizer_id is null) as events_organizer_null;

-- 2) Quem bateriam no backfill (regex legado — só identificação inicial)
select
  o.id,
  o.name,
  o.status,
  o.commission_percentage,
  (o.name ~* 'corpora[çc][ãa]o') as matches_backfill_regex
from public.organizers o
order by matches_backfill_regex desc, o.name;

-- 3) Qual organizer SERIA marcado (mesma regra da migration: 1º por id)
select x.id, x.name, x.commission_percentage
from public.organizers x
where x.name ~* 'corpora[çc][ãa]o'
order by x.id
limit 1;

-- Esperado em produção atual: exatamente 1 match → 1 platform owner após backfill.
-- Se matches = 0 e organizers_total > 0 → migration ABORTARIA com
--   PLATFORM_OWNER_NOT_IDENTIFIED
-- Se matches > 1 → backfill marca só o 1º (order by id); revise nomes.

-- 4) Eventos do organizer identificado como Corporação (candidato ao backfill)
with corp as (
  select x.id, x.name
  from public.organizers x
  where x.name ~* 'corpora[çc][ãa]o'
  order by x.id
  limit 1
)
select
  e.id,
  e.name,
  e.active,
  e.organizer_id,
  c.name as identified_corp_name
from public.events e
join corp c on c.id = e.organizer_id
order by e.name;

-- 5) Eventos sem organizer_id (já tratados como platform na RPC)
select e.id, e.name, e.active
from public.events e
where e.organizer_id is null
order by e.name;

-- 6) Resumo de risco
select
  case
    when (select count(*) from public.organizers) = 0
      then 'OK_EMPTY — migration pode aplicar (branch vazia)'
    when (select count(*) from public.organizers
          where name ~* 'corpora[çc][ãa]o') = 0
      then 'ABORT — PLATFORM_OWNER_NOT_IDENTIFIED (organizers existem, sem match)'
    when (select count(*) from public.organizers
          where name ~* 'corpora[çc][ãa]o') = 1
      then 'OK_READY — 1 match; backfill deve marcar exatamente 1 platform owner'
    else 'REVIEW — múltiplos matches; backfill marca só o 1º por id'
  end as preflight_verdict;
