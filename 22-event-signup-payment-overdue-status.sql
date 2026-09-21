-- ============================================================
-- 22 — Status real "pagamento_atrasado" + cron horário
--
-- event_signups.status e event_store_orders.status passam a aceitar:
--   pendente | pagamento_atrasado | confirmada | cancelada
--
-- Regra automática (48h corridas):
--   pendente + created_at <= now() - 48 hours → pagamento_atrasado
--
-- Sync signup → order (trigger existente) continua; ao marcar atraso
-- no signup, o pedido da loja acompanha.
--
-- Estoque / vaga / cupom / camiseta / CPF:
--   ativo = status IS DISTINCT FROM 'cancelada'
--   (pagamento_atrasado continua reservando; só cancelada libera)
--
-- NÃO aplicar automaticamente — revise no SQL Editor.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) CHECK event_store_orders.status
-- ------------------------------------------------------------
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'event_store_orders'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if cname is not null then
    execute format(
      'alter table public.event_store_orders drop constraint %I',
      cname
    );
  end if;
end $$;

alter table public.event_store_orders
  add constraint event_store_orders_status_check
  check (status in ('pendente', 'pagamento_atrasado', 'confirmada', 'cancelada'));

-- ------------------------------------------------------------
-- 2) CHECK event_signups.status (se existir CHECK antigo, troca)
-- ------------------------------------------------------------
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'event_signups'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if cname is not null then
    execute format(
      'alter table public.event_signups drop constraint %I',
      cname
    );
  end if;
end $$;

alter table public.event_signups
  drop constraint if exists event_signups_status_check;

alter table public.event_signups
  add constraint event_signups_status_check
  check (status in ('pendente', 'pagamento_atrasado', 'confirmada', 'cancelada'));

comment on constraint event_signups_status_check on public.event_signups is
  'pendente | pagamento_atrasado | confirmada | cancelada. Atraso é status real (cron 48h).';

comment on constraint event_store_orders_status_check on public.event_store_orders is
  'Espelha event_signups.status via sync trigger (inclui pagamento_atrasado).';

-- ------------------------------------------------------------
-- 3) Função: marcar atrasos
-- ------------------------------------------------------------
create or replace function public.mark_overdue_event_signups()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  -- Só pendente → pagamento_atrasado.
  -- Não toca confirmada / cancelada / pagamento_atrasado.
  -- Trigger sync_event_store_order_status_from_signup atualiza orders.
  with updated as (
    update public.event_signups es
    set status = 'pagamento_atrasado'
    where es.status = 'pendente'
      and es.created_at <= (now() - interval '48 hours')
    returning es.id
  )
  select count(*)::integer into v_count from updated;

  return coalesce(v_count, 0);
end;
$fn$;

comment on function public.mark_overdue_event_signups() is
  'Marca event_signups pendentes com created_at <= now()-48h como pagamento_atrasado. Retorna linhas atualizadas.';

revoke all on function public.mark_overdue_event_signups() from public;
revoke all on function public.mark_overdue_event_signups() from anon, authenticated;
-- Cron / service role (postgres) executa via security definer.

-- ------------------------------------------------------------
-- 4) Comentário: sync já copia new.status (inclui pagamento_atrasado)
--    Reativação cancelada → qualquer status ativo revalida estoque.
-- ------------------------------------------------------------
comment on function public.sync_event_store_order_status_from_signup() is
  'Espelha event_signups.status em event_store_orders (pendente|pagamento_atrasado|confirmada|cancelada). Reativação a partir de cancelada revalida estoque.';

-- ------------------------------------------------------------
-- 5) Classificação imediata dos registros já vencidos
-- ------------------------------------------------------------
select public.mark_overdue_event_signups();

-- ------------------------------------------------------------
-- 6) pg_cron — a cada 1 hora (idempotente)
-- ------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

do $$
declare
  jid bigint;
begin
  for jid in
    select jobid from cron.job where jobname = 'mark-overdue-event-signups'
  loop
    perform cron.unschedule(jid);
  end loop;
exception
  when undefined_table then
    raise notice 'cron.job indisponível neste ambiente — agende mark_overdue_event_signups manualmente.';
  when undefined_function then
    raise notice 'cron.unschedule indisponível — agende mark_overdue_event_signups manualmente.';
end $$;

do $$
begin
  perform cron.schedule(
    'mark-overdue-event-signups',
    '0 * * * *',
    $cron$select public.mark_overdue_event_signups();$cron$
  );
exception
  when undefined_function then
    raise notice 'cron.schedule indisponível — a função mark_overdue_event_signups foi criada; agende o job no painel Supabase.';
  when others then
    raise notice 'Falha ao agendar cron mark-overdue-event-signups: %', sqlerrm;
end $$;

-- Índice parcial CPF ativo: status IS DISTINCT FROM 'cancelada'
-- → pagamento_atrasado continua bloqueando CPF (esperado).
comment on index public.event_signups_event_participant_cpf_uidx is
  'Um CPF ativo (pendente/pagamento_atrasado/confirmada) por prova. Cancelada libera o CPF.';

notify pgrst, 'reload schema';

commit;
