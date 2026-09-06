-- ============================================================
-- Lista pública de inscritos: mostrar o participante real
--
-- Antes: full_name vinha de profiles, ou seja, o titular da conta.
-- Quem inscrevia a mãe ou um filho aparecia com o próprio nome na lista.
--
-- Agora: o nome gravado na inscrição tem prioridade e profiles fica
-- apenas como fallback, o que preserva as inscrições antigas em que
-- participant_full_name é nulo ou string vazia.
--
-- city continua vindo de profiles: event_signups não tem cidade própria
-- do participante.
-- ============================================================

-- Alterar a lista de colunas de um RETURNS TABLE não é permitido por
-- CREATE OR REPLACE ("cannot change return type of existing function"),
-- então a troca exige DROP + CREATE. Sem CASCADE de propósito: se algo
-- depender da função, é melhor falhar aqui do que derrubar o dependente.
drop function if exists public.list_event_signups_public(uuid);

create function public.list_event_signups_public(_event_id uuid)
returns table(
  full_name text,
  category text,
  team_name text,
  city text,
  status text,
  -- Coluna nova. É o que permite calcular a idade da criança na data da
  -- prova e separar a Corridinha Kids em até 5 / 6 a 10 / 11 ou mais.
  -- Devolvida como text para servir tanto a coluna date quanto text.
  participant_birth_date text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    coalesce(nullif(es.participant_full_name, ''), p.full_name) as full_name,
    es.category,
    es.team_name,
    p.city,
    es.status,
    es.participant_birth_date::text
  from public.event_signups es
  join public.profiles p on p.user_id = es.user_id
  where es.event_id = _event_id
  order by coalesce(nullif(es.participant_full_name, ''), p.full_name);
$function$;

-- CREATE FUNCTION já concede execute a PUBLIC por padrão; os grants
-- abaixo são explícitos para deixar registrado quem consome a lista.
grant execute on function public.list_event_signups_public(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Alternativa mínima, caso não queira habilitar as faixas Kids agora.
-- Corrige só o nome e mantém a assinatura de 5 colunas intacta:
--
--   create or replace function public.list_event_signups_public(_event_id uuid)
--   returns table(full_name text, category text, team_name text, city text, status text)
--   language sql stable security definer set search_path = public
--   as $$
--     select
--       coalesce(nullif(es.participant_full_name, ''), p.full_name),
--       es.category, es.team_name, p.city, es.status
--     from public.event_signups es
--     join public.profiles p on p.user_id = es.user_id
--     where es.event_id = _event_id;
--   $$;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Observação, não aplicada aqui para não mudar comportamento:
-- a função devolve todos os status (pendente, confirmada, cancelada) e
-- quem filtra "confirmada" é o frontend. Como os dois pontos de consumo
-- em ProvaDetalhe.tsx já filtram, mover o filtro para o SQL não mudaria
-- a tela e deixaria de expor nomes de inscrições pendentes ou canceladas
-- a visitantes anônimos. Se quiser, acrescente ao where:
--
--   and es.status = 'confirmada'
-- ------------------------------------------------------------
