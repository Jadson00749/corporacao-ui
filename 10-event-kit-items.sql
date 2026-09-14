-- ============================================================
-- Itens do kit da prova (exibição pública)
--
-- NÃO confundir com events.kit_options (opções/adicionais da inscrição).
-- event_kit_items descreve o que JÁ FAZ PARTE do kit da prova
-- (camiseta, medalha, troféu etc.) com foto opcional.
--
-- Idempotente. NÃO aplicar automaticamente em produção —
-- rode manualmente no SQL Editor do Supabase quando for o momento.
-- ============================================================

create table if not exists public.event_kit_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_kit_items_event_id_idx
  on public.event_kit_items (event_id);

create index if not exists event_kit_items_event_id_sort_idx
  on public.event_kit_items (event_id, sort_order);

comment on table public.event_kit_items is
  'Itens visuais do kit incluso na inscrição da prova. Não é adicional pago.';

-- updated_at
create or replace function public.set_event_kit_items_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists event_kit_items_set_updated_at on public.event_kit_items;
create trigger event_kit_items_set_updated_at
  before update on public.event_kit_items
  for each row
  execute function public.set_event_kit_items_updated_at();

alter table public.event_kit_items enable row level security;

-- Público (e autenticado): lê apenas itens ativos
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_select_active'
  ) then
    create policy event_kit_items_select_active
      on public.event_kit_items
      for select
      to anon, authenticated
      using (active = true);
  end if;
end $$;

-- Super Admin: lê todos (inclui inativos) — usa helper has_role
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_select_admin'
  ) then
    create policy event_kit_items_select_admin
      on public.event_kit_items
      for select
      to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- Organizer: lê itens das próprias provas (inclui inativos)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_select_organizer'
  ) then
    create policy event_kit_items_select_organizer
      on public.event_kit_items
      for select
      to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_kit_items.event_id
            and o.user_id = auth.uid()
            and o.status = 'active'
        )
      );
  end if;
end $$;

-- Super Admin: insert
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_insert_admin'
  ) then
    create policy event_kit_items_insert_admin
      on public.event_kit_items
      for insert
      to authenticated
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- Organizer: insert somente em provas próprias
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_insert_organizer'
  ) then
    create policy event_kit_items_insert_organizer
      on public.event_kit_items
      for insert
      to authenticated
      with check (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_kit_items.event_id
            and o.user_id = auth.uid()
            and o.status = 'active'
        )
      );
  end if;
end $$;

-- Super Admin: update
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_update_admin'
  ) then
    create policy event_kit_items_update_admin
      on public.event_kit_items
      for update
      to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- Organizer: update somente itens de provas próprias
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_update_organizer'
  ) then
    create policy event_kit_items_update_organizer
      on public.event_kit_items
      for update
      to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_kit_items.event_id
            and o.user_id = auth.uid()
            and o.status = 'active'
        )
      )
      with check (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_kit_items.event_id
            and o.user_id = auth.uid()
            and o.status = 'active'
        )
      );
  end if;
end $$;

-- Super Admin: delete
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_delete_admin'
  ) then
    create policy event_kit_items_delete_admin
      on public.event_kit_items
      for delete
      to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- Organizer: delete somente itens de provas próprias
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_kit_items'
      and policyname = 'event_kit_items_delete_organizer'
  ) then
    create policy event_kit_items_delete_organizer
      on public.event_kit_items
      for delete
      to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.events e
          join public.organizers o on o.id = e.organizer_id
          where e.id = event_kit_items.event_id
            and o.user_id = auth.uid()
            and o.status = 'active'
        )
      );
  end if;
end $$;
