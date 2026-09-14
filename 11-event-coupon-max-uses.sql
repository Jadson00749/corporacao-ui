-- ============================================================
-- Cupom: limite de utilizações (max_uses) em events.coupons
--
-- Coupons continuam no JSONB events.coupons.
-- Usos = event_signups com coupon_code (case-insensitive) e
-- status IS DISTINCT FROM 'cancelada'.
--
-- 1) RPC check_event_coupon_availability — leitura segura sob RLS
--    (SECURITY DEFINER). Serve ao Admin (contagem) e à inscrição
--    (validar antes de aplicar / antes de criar).
-- 2) Trigger BEFORE INSERT/UPDATE — trava a linha do evento,
--    reconta e impede ultrapassar max_uses sob concorrência.
--
-- Idempotente. NÃO aplicar automaticamente em produção —
-- rode manualmente no SQL Editor do Supabase.
-- ============================================================

-- Índice auxiliar para contagem por prova + cupom
create index if not exists event_signups_event_coupon_active_idx
  on public.event_signups (event_id, (upper(trim(coupon_code))))
  where nullif(trim(coupon_code), '') is not null
    and status is distinct from 'cancelada';

-- ------------------------------------------------------------
-- RPC: disponibilidade do cupom
-- ------------------------------------------------------------
create or replace function public.check_event_coupon_availability(
  _event_id uuid,
  _code text
)
returns table (
  ok boolean,
  code text,
  max_uses integer,
  used integer,
  remaining integer,
  reason text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  c jsonb;
  lim integer;
  u integer;
  raw text := upper(trim(coalesce(_code, '')));
begin
  if raw = '' then
    return query select false, null::text, null::integer, 0, null::integer, 'empty_code'::text;
    return;
  end if;

  select elem into c
  from public.events e,
       lateral jsonb_array_elements(coalesce(e.coupons, '[]'::jsonb)) elem
  where e.id = _event_id
    and upper(trim(elem->>'code')) = raw
  limit 1;

  if c is null then
    return query select false, raw, null::integer, 0, null::integer, 'not_found'::text;
    return;
  end if;

  if coalesce((c->>'active')::boolean, true) = false then
    return query select false, raw, null::integer, 0, null::integer, 'inactive'::text;
    return;
  end if;

  -- max_uses ausente / vazio / <= 0 → ilimitado
  begin
    lim := nullif(trim(coalesce(c->>'max_uses', '')), '')::integer;
  exception when others then
    lim := null;
  end;
  if lim is not null and lim <= 0 then
    lim := null;
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = _event_id
    and upper(trim(coalesce(es.coupon_code, ''))) = raw
    and es.status is distinct from 'cancelada';

  if lim is not null and u >= lim then
    return query select false, raw, lim, u, 0, 'exhausted'::text;
    return;
  end if;

  return query select
    true,
    raw,
    lim,
    u,
    case when lim is null then null else greatest(lim - u, 0) end,
    'ok'::text;
end;
$fn$;

grant execute on function public.check_event_coupon_availability(uuid, text)
  to authenticated;

-- ------------------------------------------------------------
-- Trigger: impede ultrapassar max_uses (concorrência)
-- ------------------------------------------------------------
create or replace function public.enforce_event_coupon_max_uses()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  raw text;
  c jsonb;
  lim integer;
  u integer;
begin
  raw := upper(trim(coalesce(NEW.coupon_code, '')));

  -- Sem cupom ou inscrição cancelada: não consome limite
  if raw = '' or NEW.status = 'cancelada' then
    return NEW;
  end if;

  -- Trava a prova para serializar contagens concorrentes
  perform 1 from public.events e where e.id = NEW.event_id for update;

  select elem into c
  from public.events e,
       lateral jsonb_array_elements(coalesce(e.coupons, '[]'::jsonb)) elem
  where e.id = NEW.event_id
    and upper(trim(elem->>'code')) = raw
  limit 1;

  -- Cupom desconhecido no JSON: não bloqueia (compat / tipagem manual)
  if c is null then
    return NEW;
  end if;

  begin
    lim := nullif(trim(coalesce(c->>'max_uses', '')), '')::integer;
  exception when others then
    lim := null;
  end;
  if lim is null or lim <= 0 then
    return NEW; -- ilimitado
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = NEW.event_id
    and upper(trim(coalesce(es.coupon_code, ''))) = raw
    and es.status is distinct from 'cancelada'
    and es.id is distinct from NEW.id;

  if u >= lim then
    raise exception 'Este cupom atingiu o limite de utilizações.'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$fn$;

drop trigger if exists event_signups_enforce_coupon_max_uses on public.event_signups;
create trigger event_signups_enforce_coupon_max_uses
  before insert or update of coupon_code, status
  on public.event_signups
  for each row
  execute function public.enforce_event_coupon_max_uses();
