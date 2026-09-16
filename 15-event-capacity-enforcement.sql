-- ============================================================
-- 15 — Capacidade real da prova (events.max_slots)
--
-- Regra:
--   pendente + confirmada ocupam vaga
--   cancelada libera vaga
--   max_slots null / <= 0 → ilimitado
--
-- 1) Índice auxiliar em event_signups (não canceladas)
-- 2) RPC get_event_capacity_status (pública, só contagens)
-- 3) Trigger anti-overbooking em event_signups
-- 4) Trigger impede reduzir max_slots abaixo do já usado
-- 5) notify pgrst reload schema
--
-- Idempotente. NÃO aplicar automaticamente — revise no SQL Editor.
-- ============================================================

create index if not exists event_signups_event_active_capacity_idx
  on public.event_signups (event_id)
  where status is distinct from 'cancelada';

-- ------------------------------------------------------------
-- RPC: status de capacidade (sem dados pessoais)
-- ------------------------------------------------------------
drop function if exists public.get_event_capacity_status(uuid);

create function public.get_event_capacity_status(_event_id uuid)
returns table(
  max_slots integer,
  used integer,
  remaining integer,
  unlimited boolean,
  is_full boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  lim integer;
  u integer;
begin
  select e.max_slots into lim
  from public.events e
  where e.id = _event_id;

  if not found then
    return;
  end if;

  if lim is not null and lim <= 0 then
    lim := null;
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = _event_id
    and es.status is distinct from 'cancelada';

  u := coalesce(u, 0);

  max_slots := lim;
  used := u;
  unlimited := lim is null;
  remaining := case when lim is null then null else greatest(lim - u, 0) end;
  is_full := case when lim is null then false else u >= lim end;
  return next;
end;
$fn$;

revoke all on function public.get_event_capacity_status(uuid) from public;
grant execute on function public.get_event_capacity_status(uuid) to anon, authenticated;

comment on function public.get_event_capacity_status(uuid) is
  'Capacidade da prova: max_slots vs inscrições não canceladas. Sem dados pessoais.';

-- ------------------------------------------------------------
-- Trigger: impede overbooking de vagas
-- ------------------------------------------------------------
create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lim integer;
  u integer;
begin
  -- Cancelada não ocupa vaga
  if NEW.status = 'cancelada' then
    return NEW;
  end if;

  select e.max_slots into lim
  from public.events e
  where e.id = NEW.event_id
  for update;

  if lim is null or lim <= 0 then
    return NEW; -- ilimitado
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = NEW.event_id
    and es.status is distinct from 'cancelada'
    and es.id is distinct from NEW.id;

  if coalesce(u, 0) >= lim then
    raise exception 'Limite de inscrições desta prova atingido.'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$fn$;

drop trigger if exists event_signups_enforce_capacity on public.event_signups;
create trigger event_signups_enforce_capacity
  before insert or update of status, event_id
  on public.event_signups
  for each row
  execute function public.enforce_event_capacity();

-- ------------------------------------------------------------
-- Trigger: não reduzir max_slots abaixo do já utilizado
-- ------------------------------------------------------------
create or replace function public.enforce_event_max_slots_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  u integer;
  lim integer;
begin
  lim := NEW.max_slots;

  -- null / <= 0 = ilimitado → ok
  if lim is null or lim <= 0 then
    return NEW;
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = NEW.id
    and es.status is distinct from 'cancelada';

  if coalesce(u, 0) > lim then
    raise exception
      'Já existem % inscrições ativas. O limite da prova não pode ser menor que %.',
      u, u
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$fn$;

drop trigger if exists events_enforce_max_slots_floor on public.events;
create trigger events_enforce_max_slots_floor
  before insert or update of max_slots
  on public.events
  for each row
  execute function public.enforce_event_max_slots_floor();

notify pgrst, 'reload schema';
