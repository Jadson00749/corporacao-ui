-- ============================================================
-- Configuração de banners por prova (seguro / idempotente)
-- Não altera banners existentes.
-- ============================================================

alter table public.events
  add column if not exists banner_aspect_ratio text;

alter table public.events
  add column if not exists banner_mobile_image text;

alter table public.events
  alter column banner_aspect_ratio set default '9:16';

update public.events
  set banner_aspect_ratio = '9:16'
  where banner_aspect_ratio is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_banner_aspect_ratio_check'
  ) then
    alter table public.events
      add constraint events_banner_aspect_ratio_check
      check (banner_aspect_ratio in ('9:16', '3:4', '1:1', '16:9'));
  end if;
end $$;
