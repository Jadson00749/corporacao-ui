-- Adiciona o tamanho da camiseta nas inscrições (seguro / idempotente)
ALTER TABLE public.event_signups
  ADD COLUMN IF NOT EXISTS shirt_size text;
