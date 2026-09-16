-- ============================================================
-- 16 — CPF na prova: cancelada libera nova inscrição
--
-- Índice atual (produção, criado fora deste repositório):
--   UNIQUE (event_id, participant_cpf)
--   WHERE participant_cpf IS NOT NULL AND btrim(participant_cpf) <> ''
--
-- Problemas:
--   1) inscrição CANCELADA continua ocupando o CPF
--   2) CPF com máscara (123.456.789-00) e só dígitos
--      (12345678900) são tratados como valores distintos
--
-- Regra:
--   pendente   → bloqueia novo CPF na prova
--   confirmada → bloqueia novo CPF na prova
--   cancelada  → NÃO bloqueia
--
-- Unicidade pelo CPF normalizado (somente dígitos):
--   regexp_replace(participant_cpf, '\D', '', 'g')
--
-- Ordem segura (não deixa a tabela sem unique se o CREATE falhar):
--   1) DROP índice temporário residual de tentativa anterior
--   2) CREATE índice novo (nome temporário)
--   3) DROP índice antigo
--   4) RENAME do novo para o nome original
--
-- Reativar cancelada → pendente/confirmada enquanto já existir
-- outra inscrição ativa com o mesmo (event_id, CPF normalizado)
-- continua bloqueado pelo índice (esperado).
--
-- Não altera tabela. Não apaga histórico.
-- Idempotente. NÃO aplicar automaticamente — revise no SQL Editor.
-- ============================================================

-- 1) Residual de tentativa anterior (não é o índice de produção)
drop index if exists public.event_signups_event_participant_cpf_active_uidx;

-- 2) Novo índice parcial: ativos + CPF só dígitos
create unique index event_signups_event_participant_cpf_active_uidx
  on public.event_signups (
    event_id,
    (regexp_replace(participant_cpf, '\D', '', 'g'))
  )
  where participant_cpf is not null
    and btrim(participant_cpf) <> ''
    and regexp_replace(participant_cpf, '\D', '', 'g') <> ''
    and status is distinct from 'cancelada';

-- 3) Só depois do CREATE bem-sucedido: remove o índice antigo
drop index if exists public.event_signups_event_participant_cpf_uidx;

-- 4) Nome de produção permanece o mesmo
alter index public.event_signups_event_participant_cpf_active_uidx
  rename to event_signups_event_participant_cpf_uidx;

comment on index public.event_signups_event_participant_cpf_uidx is
  'Um CPF ativo (pendente/confirmada) por prova, comparado só pelos dígitos. Cancelada libera o CPF para nova inscrição.';

notify pgrst, 'reload schema';
