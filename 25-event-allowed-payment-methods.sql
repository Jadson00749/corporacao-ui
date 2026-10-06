-- Adiciona coluna para controlar métodos de pagamento permitidos por prova.
-- Valores: 'both' | 'pix' | 'credit_card'  (default: 'both')
alter table events
  add column if not exists allowed_payment_methods text not null default 'both'
  check (allowed_payment_methods in ('both', 'pix', 'credit_card'));
