-- ============================================================
-- Locação de Estruturas: persistência da seleção do organizador
--
-- requested_at registra quando o organizador pediu a verificação de
-- disponibilidade, separando "quando o rascunho nasceu" (created_at) de
-- "quando virou solicitação".
--
-- O índice parcial é o que garante, no banco, um único rascunho por
-- organizador + prova. Sem ele, dois cliques simultâneos ou duas abas
-- abertas criariam pedidos concorrentes e a estrutura ficaria dividida
-- entre dois rascunhos.
--
-- Não cria policy nem altera RLS: as políticas existentes já cobrem
-- organizador (próprios pedidos) e admin (todos).
-- ============================================================

alter table public.rental_orders
  add column if not exists requested_at timestamptz;

comment on column public.rental_orders.requested_at is
  'Momento em que o organizador solicitou a verificação de disponibilidade (status draft -> requested).';

-- Só vale para rascunho e para pedido vinculado a prova. Pedidos já
-- solicitados, contratados ou cancelados podem coexistir livremente,
-- inclusive vários para a mesma prova ao longo do tempo.
create unique index if not exists rental_orders_single_draft_per_event
  on public.rental_orders (organizer_id, event_id)
  where status = 'draft' and event_id is not null;

-- ------------------------------------------------------------
-- Se a criação do índice falhar por duplicidade, é porque já existem
-- rascunhos repetidos. Esta consulta mostra os casos, para consolidar
-- manualmente antes de repetir a migration:
--
--   select organizer_id, event_id, count(*), array_agg(id order by updated_at desc)
--   from public.rental_orders
--   where status = 'draft' and event_id is not null
--   group by organizer_id, event_id
--   having count(*) > 1;
-- ------------------------------------------------------------
