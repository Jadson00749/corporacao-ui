-- ============================================================
-- Contato financeiro do organizador + autonomia de edição
--
-- payment_email e payment_contact_name ficam em organizers (não em
-- profiles): são dados da organização, tipicamente do setor financeiro.
--
-- Policies: o organizador lê e atualiza só a própria linha
-- (user_id = auth.uid()). O Super Admin continua com as policies
-- existentes; não removemos nada.
--
-- Trigger: organizador não-admin não pode alterar comissão, status,
-- user_id nem nome pela policy de update (só os campos financeiros).
-- ============================================================

alter table public.organizers
  add column if not exists payment_email text not null default '',
  add column if not exists payment_contact_name text not null default '';

comment on column public.organizers.payment_email is
  'E-mail financeiro da organização. Independente de profiles.email.';
comment on column public.organizers.payment_contact_name is
  'Nome do responsável financeiro (pode ser um funcionário). Independente de profiles.full_name.';

-- Leitura da própria organização (necessário para a tela Dados de pagamento)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizers'
      and policyname = 'organizers_select_own'
  ) then
    create policy organizers_select_own
      on public.organizers
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Update da própria linha (só o vínculo user_id = auth.uid())
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizers'
      and policyname = 'organizers_update_own'
  ) then
    create policy organizers_update_own
      on public.organizers
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Impede que o organizador altere campos administrativos via update próprio.
create or replace function public.organizers_guard_non_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Super Admin (role admin) pode alterar tudo.
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    return new;
  end if;

  -- Quem não é dono da linha nem chega aqui (RLS), mas reforçamos.
  if old.user_id is distinct from auth.uid() then
    raise exception 'Sem permissão para alterar este organizador.';
  end if;

  if new.user_id is distinct from old.user_id
     or new.commission_percentage is distinct from old.commission_percentage
     or new.status is distinct from old.status
     or new.name is distinct from old.name
  then
    raise exception 'Organizadores só podem alterar os dados de pagamento.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists organizers_guard_non_payment_update on public.organizers;
create trigger organizers_guard_non_payment_update
  before update on public.organizers
  for each row
  execute function public.organizers_guard_non_payment_update();

-- ------------------------------------------------------------
-- Atualiza a resolução pública do pagamento: incluiui payment_email e
-- remove o fallback para profiles.whatsapp (contato financeiro ≠
-- o da organização, não o telefone pessoal).
-- ------------------------------------------------------------
drop function if exists public.get_event_payment_info(uuid);

create function public.get_event_payment_info(_event_id uuid)
returns table(
  pix_key text,
  pix_recipient text,
  payment_instructions text,
  payment_whatsapp text,
  payment_email text,
  payment_contact_name text,
  organizer_name text,
  is_partner boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with base as (
    select
      e.pix_key              as e_key,
      e.pix_recipient        as e_recipient,
      e.payment_instructions as e_instructions,
      o.pix_key              as o_key,
      o.pix_recipient        as o_recipient,
      o.payment_whatsapp     as o_whatsapp,
      o.payment_email        as o_email,
      o.payment_contact_name as o_contact,
      o.name                 as o_name,
      (o.id is not null and o.name !~* 'corpora[çc][ãa]o') as partner
    from public.events e
    left join public.organizers o on o.id = e.organizer_id
    where e.id = _event_id
  )
  select
    case when b.partner
      then coalesce(nullif(b.o_key, ''), nullif(b.e_key, ''), '')
      else coalesce(nullif(b.e_key, ''), nullif(b.o_key, ''), '')
    end,
    case when b.partner
      then coalesce(nullif(b.o_recipient, ''), nullif(b.e_recipient, ''), '')
      else coalesce(nullif(b.e_recipient, ''), nullif(b.o_recipient, ''), '')
    end,
    coalesce(b.e_instructions, ''),
    case when b.partner
      then coalesce(nullif(b.o_whatsapp, ''), '')
      else coalesce(nullif(b.o_whatsapp, ''), '')
    end,
    case when b.partner then coalesce(b.o_email, '') else coalesce(b.o_email, '') end,
    case when b.partner then coalesce(b.o_contact, '') else coalesce(b.o_contact, '') end,
    coalesce(b.o_name, ''),
    coalesce(b.partner, false)
  from base b;
$function$;

grant execute on function public.get_event_payment_info(uuid) to anon, authenticated;
