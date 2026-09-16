-- ============================================================
-- 14 — Estoque opcional por tamanho de camiseta (evento)
--
-- events.shirt_size_stock jsonb: { "P": 40, "G": 50 }
--   chave AUSENTE → ILIMITADO
--   chave PRESENTE → inteiro positivo >= 1 (senão rejeita no save)
--
-- Consumo: event_signups com status IS DISTINCT FROM 'cancelada'
-- Contagem por (event_id, upper(trim(shirt_size))).
--
-- 1) Coluna shirt_size_stock
-- 2) Índice auxiliar em event_signups
-- 3) RPC get_event_shirt_size_availability (pública, só contagens)
-- 4) Trigger anti-overselling em event_signups
-- 5) Trigger valida JSON + impede reduzir limite abaixo do já usado
-- 6) notify pgrst reload schema
--
-- Idempotente. NÃO aplicar automaticamente — revise no SQL Editor.
-- ============================================================

alter table public.events
  add column if not exists shirt_size_stock jsonb not null default '{}'::jsonb;

comment on column public.events.shirt_size_stock is
  'Limites opcionais por tamanho de camiseta. Ex: {"P":40,"G":50}. Chave ausente = ilimitado. Valor presente deve ser inteiro >= 1.';

-- Índice para contagem rápida evento + tamanho (não canceladas)
create index if not exists event_signups_event_shirt_size_active_idx
  on public.event_signups (event_id, (upper(trim(shirt_size))))
  where nullif(trim(shirt_size), '') is not null
    and status is distinct from 'cancelada';

-- ------------------------------------------------------------
-- Helper interno: lê limite de um tamanho no JSON
-- Chave ausente → null (ilimitado).
-- Após validação no save, valores presentes são inteiros >= 1.
-- ------------------------------------------------------------
create or replace function public.shirt_size_stock_limit(_stock jsonb, _size text)
returns integer
language plpgsql
immutable
set search_path = public
as $fn$
declare
  raw text;
  lim integer;
  normalized_size text := upper(trim(coalesce(_size, '')));
begin
  if normalized_size = '' or _stock is null or jsonb_typeof(_stock) <> 'object' then
    return null;
  end if;

  -- Chave ausente (qualquer casing) → ilimitado
  if not exists (
    select 1
    from jsonb_each(_stock) e
    where upper(trim(e.key)) = normalized_size
  ) then
    return null;
  end if;

  raw := nullif(trim(coalesce(
    _stock ->> normalized_size,
    _stock ->> lower(normalized_size),
    (
      select e.value
      from jsonb_each_text(_stock) e
      where upper(trim(e.key)) = normalized_size
      limit 1
    )
  )), '');

  if raw is null then
    return null;
  end if;

  begin
    lim := raw::integer;
  exception when others then
    return null;
  end;

  if lim is null or lim < 1 then
    return null;
  end if;
  return lim;
end;
$fn$;

-- ------------------------------------------------------------
-- RPC: disponibilidade por tamanho (sem dados pessoais)
-- ------------------------------------------------------------
drop function if exists public.get_event_shirt_size_availability(uuid);

create function public.get_event_shirt_size_availability(_event_id uuid)
returns table(
  size text,
  max_quantity integer,
  used integer,
  remaining integer,
  unlimited boolean,
  available boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  stock jsonb;
  sz text;
  lim integer;
  u integer;
  size_list text[];
begin
  select coalesce(e.shirt_size_stock, '{}'::jsonb)
    into stock
  from public.events e
  where e.id = _event_id;

  if not found then
    return;
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::text[])
    into size_list
  from (
    select upper(trim(jsonb_array_elements_text(coalesce(opt->'sizes', '[]'::jsonb)))) as x
    from public.events e
    cross join lateral jsonb_array_elements(coalesce(e.kit_options, '[]'::jsonb)) opt
    where e.id = _event_id
    union
    select upper(trim(k))
    from public.events e
    cross join lateral jsonb_object_keys(coalesce(e.shirt_size_stock, '{}'::jsonb)) k
    where e.id = _event_id
  ) u
  where nullif(x, '') is not null;

  foreach sz in array coalesce(size_list, '{}'::text[])
  loop
    lim := public.shirt_size_stock_limit(stock, sz);

    select count(*)::integer into u
    from public.event_signups es
    where es.event_id = _event_id
      and upper(trim(es.shirt_size)) = sz
      and es.status is distinct from 'cancelada';

    size := sz;
    max_quantity := lim;
    used := coalesce(u, 0);
    unlimited := lim is null;
    remaining := case when lim is null then null else greatest(lim - coalesce(u, 0), 0) end;
    available := case when lim is null then true else (lim - coalesce(u, 0)) > 0 end;
    return next;
  end loop;
end;
$fn$;

revoke all on function public.get_event_shirt_size_availability(uuid) from public;
grant execute on function public.get_event_shirt_size_availability(uuid) to anon, authenticated;

comment on function public.get_event_shirt_size_availability(uuid) is
  'Disponibilidade de tamanhos de camiseta da prova (contagens apenas). Sem dados pessoais.';

-- ------------------------------------------------------------
-- Trigger: impede overselling na inscrição
-- ------------------------------------------------------------
create or replace function public.enforce_event_shirt_size_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  sz text;
  stock jsonb;
  lim integer;
  u integer;
begin
  sz := upper(trim(coalesce(NEW.shirt_size, '')));

  -- Sem tamanho ou cancelada: não consome
  if sz = '' or NEW.status = 'cancelada' then
    return NEW;
  end if;

  -- Serializa contagens concorrentes na prova
  select coalesce(e.shirt_size_stock, '{}'::jsonb)
    into stock
  from public.events e
  where e.id = NEW.event_id
  for update;

  if stock is null then
    return NEW;
  end if;

  lim := public.shirt_size_stock_limit(stock, sz);
  if lim is null then
    return NEW; -- ilimitado (chave ausente)
  end if;

  select count(*)::integer into u
  from public.event_signups es
  where es.event_id = NEW.event_id
    and upper(trim(es.shirt_size)) = sz
    and es.status is distinct from 'cancelada'
    and es.id is distinct from NEW.id;

  if u >= lim then
    raise exception 'O tamanho % está esgotado.', sz
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$fn$;

drop trigger if exists event_signups_enforce_shirt_size_stock on public.event_signups;
create trigger event_signups_enforce_shirt_size_stock
  before insert or update of shirt_size, status, event_id
  on public.event_signups
  for each row
  execute function public.enforce_event_shirt_size_stock();

-- ------------------------------------------------------------
-- Trigger: valida shirt_size_stock + não reduzir abaixo do usado
-- ------------------------------------------------------------
create or replace function public.enforce_shirt_size_stock_not_below_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  k text;
  elem jsonb;
  lim integer;
  u integer;
  n numeric;
  size_label text;
begin
  if NEW.shirt_size_stock is null then
    NEW.shirt_size_stock := '{}'::jsonb;
  end if;

  if jsonb_typeof(NEW.shirt_size_stock) <> 'object' then
    raise exception 'shirt_size_stock inválido.';
  end if;

  -- Cada chave presente deve ser inteiro positivo >= 1
  for k, elem in
    select e.key, e.value from jsonb_each(NEW.shirt_size_stock) e
  loop
    size_label := upper(trim(k));
    if size_label = '' then
      raise exception
        'Quantidade inválida para o tamanho %. Informe um número inteiro maior que zero ou deixe em branco para ilimitado.',
        coalesce(nullif(trim(k), ''), '?')
        using errcode = 'P0001';
    end if;

    if jsonb_typeof(elem) <> 'number' then
      raise exception
        'Quantidade inválida para o tamanho %. Informe um número inteiro maior que zero ou deixe em branco para ilimitado.',
        size_label
        using errcode = 'P0001';
    end if;

    begin
      n := elem::text::numeric;
    exception when others then
      raise exception
        'Quantidade inválida para o tamanho %. Informe um número inteiro maior que zero ou deixe em branco para ilimitado.',
        size_label
        using errcode = 'P0001';
    end;

    if n is null or n <> trunc(n) or n < 1 then
      raise exception
        'Quantidade inválida para o tamanho %. Informe um número inteiro maior que zero ou deixe em branco para ilimitado.',
        size_label
        using errcode = 'P0001';
    end if;
  end loop;

  for k in
    select e.key from jsonb_each_text(NEW.shirt_size_stock) e
  loop
    lim := public.shirt_size_stock_limit(NEW.shirt_size_stock, k);
    if lim is null then
      continue;
    end if;

    select count(*)::integer into u
    from public.event_signups es
    where es.event_id = NEW.id
      and upper(trim(es.shirt_size)) = upper(trim(k))
      and es.status is distinct from 'cancelada';

    if u > lim then
      raise exception
        'Já existem % inscrições reservando o tamanho %. O limite não pode ser menor que %.',
        u, upper(trim(k)), u
        using errcode = 'P0001';
    end if;
  end loop;

  return NEW;
end;
$fn$;

drop trigger if exists events_enforce_shirt_size_stock_floor on public.events;
create trigger events_enforce_shirt_size_stock_floor
  before insert or update of shirt_size_stock
  on public.events
  for each row
  execute function public.enforce_shirt_size_stock_not_below_used();

-- PostgREST: expõe coluna nova + RPC sem exigir restart manual
notify pgrst, 'reload schema';
