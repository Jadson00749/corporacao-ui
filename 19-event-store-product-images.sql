-- ============================================================
-- 19 — GALERIA DE IMAGENS DO PRODUTO (Loja por prova)
--
-- ADITIVO / retrocompatível.
-- NÃO remove event_store_products.image_url (continua sendo a capa).
-- NÃO altera migration 17/18.
-- NÃO altera RPC de checkout / pedidos / image_url_snapshot.
--
-- event_store_products.image_url  = capa / principal
-- event_store_product_images      = galeria (até 6 no front)
--
-- IDEMPOTENTE. NÃO APLICAR AUTOMATICAMENTE.
-- ============================================================

begin;

create table if not exists public.event_store_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.event_store_products (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint event_store_product_images_url_len
    check (char_length(trim(image_url)) between 1 and 2048)
);

create index if not exists event_store_product_images_product_sort_idx
  on public.event_store_product_images (product_id, sort_order);

comment on table public.event_store_product_images is
  'Galeria de imagens do produto da loja. Capa continua em event_store_products.image_url.';
comment on column public.event_store_product_images.image_url is
  'URL pública (ex.: corporacao-bucket). Não substitui image_url_snapshot do pedido.';

-- ------------------------------------------------------------
-- RLS (espelha event_store_products)
-- ------------------------------------------------------------
alter table public.event_store_product_images enable row level security;

-- Público: só imagens de produto ativo em evento ativo
do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'event_store_product_images_select_active'
      and tablename = 'event_store_product_images'
  ) then
    create policy event_store_product_images_select_active
      on public.event_store_product_images for select to anon, authenticated
      using (
        exists (
          select 1
          from public.event_store_products p
          join public.events e on e.id = p.event_id
          where p.id = event_store_product_images.product_id
            and p.active = true
            and coalesce(e.active, false) = true
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'event_store_product_images_select_admin'
      and tablename = 'event_store_product_images'
  ) then
    create policy event_store_product_images_select_admin
      on public.event_store_product_images for select to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'event_store_product_images_select_organizer'
      and tablename = 'event_store_product_images'
  ) then
    create policy event_store_product_images_select_organizer
      on public.event_store_product_images for select to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_images.product_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'event_store_product_images_write_admin'
      and tablename = 'event_store_product_images'
  ) then
    create policy event_store_product_images_write_admin
      on public.event_store_product_images for all to authenticated
      using (public.has_role(auth.uid(), 'admin'::public.app_role))
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'event_store_product_images_write_organizer'
      and tablename = 'event_store_product_images'
  ) then
    create policy event_store_product_images_write_organizer
      on public.event_store_product_images for all to authenticated
      using (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_images.product_id
            and o.user_id = auth.uid()
        )
      )
      with check (
        public.has_role(auth.uid(), 'organizer'::public.app_role)
        and exists (
          select 1
          from public.event_store_products p
          join public.events e on e.id = p.event_id
          join public.organizers o on o.id = e.organizer_id
          where p.id = event_store_product_images.product_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- FIM — NÃO APLICAR sem revisão humana.
-- ============================================================
