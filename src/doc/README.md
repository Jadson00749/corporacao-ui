# Corporação UI — Documentação de Pagamentos

## O que foi implementado?

Integração de pagamentos via **Asaas** nos fluxos de inscrição em provas, compra de produtos e locação de estruturas. O atleta/organizador escolhe entre **PIX** ou **Cartão de Crédito**, paga, e a confirmação acontece automaticamente via webhook — sem nenhuma ação manual.

---

## Arquitetura de pagamentos

**Todas as cobranças passam pela conta Asaas do dono da plataforma (`is_platform_owner = true`).** Isso garante webhook único, sem necessidade de configuração por cliente.

| Fluxo | Conta que cria a cobrança | Split |
|---|---|---|
| Inscrições em provas | Dono da plataforma | Valor líquido → wallet do organizador |
| Compra de produtos | Dono da plataforma | Sem split (100% para o dono) |
| Locação de estruturas | Dono da plataforma | Sem split (100% para o dono) |

### Por que tudo passa pelo dono?

- **Webhook único** → o Asaas notifica apenas a conta que criou a cobrança. Com todos os pagamentos na conta do dono, um único webhook recebe todos os eventos.
- **Escalável** → novos clientes/organizadores não precisam configurar webhook.
- **Controle total** → a plataforma tem visibilidade de todas as transações.

---

## Como funciona o fluxo de inscrições em provas?

```
Atleta conclui formulário de inscrição
      ↓
Tela de pagamento (AsaasPaymentStep) exibe opção de PIX ou Cartão
      ↓
Atleta escolhe o método e paga
      ↓
Front-end chama a API do backend (corporacao-nest-apis) com:
  - dados do atleta (nome, CPF, e-mail)
  - valor, eventId, organizerId, signupId
      ↓
Backend cria a cobrança usando a API key do DONO da plataforma
Split automático: (100 - commission_percentage)% → wallet do organizador
      ↓
Asaas notifica o backend via Webhook (conta do dono)
      ↓
Backend atualiza event_signups.status = 'confirmada' no Supabase
      ↓
Front-end recebe atualização via Supabase Realtime
      ↓
Modal "Pagamento confirmado!" é exibido → redireciona para /minha-conta
```

---

## Como funciona o split de comissão?

- A cobrança é criada na conta do **dono** com a API key dele
- O Asaas automaticamente repassa `(100 - commission_percentage)%` para o **wallet do organizador**
- O dono retém `commission_percentage`% como comissão da plataforma
- **PIX:** repasse instantâneo no momento do pagamento
- **Cartão parcelado:** repasse parcela a parcela pelo Asaas automaticamente

**Exemplo:** inscrição de R$70,00 com 10% de comissão
- Organizador recebe: R$63,00 (90%)
- Dono retém: R$7,00 (10%)

---

## O que cada cliente/organizador precisa fornecer?

| Dado | Onde obter | Quem cadastra | Coluna no banco (`organizers`) |
|---|---|---|---|
| **Wallet ID** | Painel Asaas → Configurações → Dados da conta | Organizador ou Admin | `asaas_wallet_id` |
| **Comissão (%)** | Definida pelo admin da plataforma | Admin | `commission_percentage` |

> O organizador **não precisa** fornecer API Key — a cobrança é criada sempre com a API key do dono da plataforma.

---

## O que o dono da plataforma precisa configurar?

| Dado | Coluna no banco (`organizers`) | Obrigatório |
|---|---|---|
| API Key Asaas | `asaas_api_key` | Sim — todas as cobranças usam essa chave |
| Wallet ID Asaas | `asaas_wallet_id` | Sim — recebe a comissão via split |
| `is_platform_owner` | `is_platform_owner = true` | Sim — identifica o dono |

---

## Como cadastrar no banco

**Dono da plataforma:**
```sql
ALTER TABLE organizers DISABLE TRIGGER organizers_guard_non_payment_update;

UPDATE organizers
SET
  asaas_api_key   = '$aact_...',        -- API Key da conta do dono
  asaas_wallet_id = 'uuid-da-carteira'  -- Wallet ID da conta do dono
WHERE is_platform_owner = true;

ALTER TABLE organizers ENABLE TRIGGER organizers_guard_non_payment_update;
```

**Organizador (cliente):**
```sql
ALTER TABLE organizers DISABLE TRIGGER organizers_guard_non_payment_update;

UPDATE organizers
SET
  asaas_wallet_id       = 'uuid-da-carteira',  -- Wallet ID do organizador
  commission_percentage = 10                   -- % de comissão da plataforma
WHERE id = 'uuid-do-organizador';

ALTER TABLE organizers ENABLE TRIGGER organizers_guard_non_payment_update;
```

---

## Arquivos envolvidos

```
src/
├── components/site/
│   ├── AsaasPaymentStep.tsx      # Inscrições: PIX e cartão com split
│   ├── CartPaymentStep.tsx       # Produtos: PIX e cartão sem split
│   └── RentalPaymentStep.tsx     # Locações: PIX e cartão sem split
│
├── screens/
│   ├── ProvaInscricao.tsx        # Tela de inscrição — integra AsaasPaymentStep
│   └── ProdutoCheckout.tsx       # Checkout de produtos — integra CartPaymentStep
│
├── screens/admin/
│   ├── AdminOrganizers.tsx       # Admin cadastra Wallet ID e comissão do organizador
│   └── OrganizerPaymentSettings.tsx # Organizador cadastra próprio Wallet ID
│
├── lib/
│   └── eventPayment.ts           # Tipos e hook useOrganizerPayment
│
└── services/
    └── paymentService.ts         # Chamadas HTTP para o backend
```

---

## Realtime — como a confirmação chega ao front

O `AsaasPaymentStep` cria um canal Supabase Realtime no mount e escuta atualizações na tabela `event_signups`. Quando o `status` muda para `'confirmada'` e o `id` bate com o `signupId` atual, o modal de confirmação é exibido.

---

## Webhook

O webhook está configurado na conta **do dono da plataforma** no Asaas. Ele recebe todos os eventos de pagamento (PIX confirmado, cartão aprovado, pagamento atrasado) e atualiza o status no Supabase automaticamente.

Eventos tratados:
- `PAYMENT_RECEIVED` → inscrição `confirmada` / produto `paid` / locação `contracted`
- `PAYMENT_OVERDUE` → inscrição `pagamento_atrasado`
