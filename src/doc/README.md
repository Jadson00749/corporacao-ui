# Corporação UI — Documentação de Pagamentos

## O que foi implementado?

Integração de pagamentos via **Asaas** no fluxo de inscrição em provas. O atleta escolhe entre **PIX** ou **Cartão de Crédito**, paga, e a inscrição é confirmada automaticamente — sem nenhuma ação manual do organizador ou da plataforma.

---

## Como funciona o fluxo no front-end?

```
Atleta conclui formulário de inscrição
      ↓
Tela de pagamento (AsaasPaymentStep) exibe opção de PIX ou Cartão
      ↓
Atleta escolhe o método e paga
      ↓
Front-end chama a API do backend (corporacao-nest-apis) com:
  - dados do atleta (nome, CPF, e-mail)
  - valor, eventId, organizerId, signupId (externalReference)
      ↓
Backend processa no Asaas e retorna confirmação
      ↓
Asaas notifica o backend via Webhook
      ↓
Backend atualiza event_signups.status = 'confirmada' no Supabase
      ↓
Front-end recebe atualização via Supabase Realtime
      ↓
Modal "Pagamento confirmado!" é exibido → redireciona para /minha-conta
```

---

## Arquivos envolvidos

```
src/
├── components/site/
│   └── AsaasPaymentStep.tsx      # Componente principal: seleção de método, PIX e cartão
│
├── screens/
│   └── ProvaInscricao.tsx        # Tela de inscrição — integra o AsaasPaymentStep
│                                  # e exibe o modal de confirmação
│
├── screens/admin/
│   ├── AdminOrganizers.tsx       # Aba Pagamento: admin cadastra API Key + Wallet ID
│   └── OrganizerPaymentSettings.tsx # Tela do organizador: cadastra Wallet ID
│
├── lib/
│   └── eventPayment.ts           # Tipos, hook useOrganizerPayment, useSaveOrganizerPayment
│
└── services/
    └── paymentService.ts         # Chamadas HTTP para o backend (createPixPayment, createCreditCardPayment)
```

---

## O que o organizador precisa fornecer?

| Dado | Onde obter | Quem cadastra | Coluna no banco (`organizers`) |
|---|---|---|---|
| **API Key Asaas** | Painel Asaas → Configurações → Integrações → API Key | Admin (privado) | `asaas_api_key` |
| **Wallet ID** | Painel Asaas → Configurações → Dados da conta | Organizador (tela "Dados de pagamento") ou Admin | `asaas_wallet_id` |
| **Comissão (%)** | Definida pelo admin da plataforma | Admin | `commission_percentage` |

> **API Key:** fica restrita ao admin. O organizador não vê esse campo.
> **Wallet ID:** o organizador pode informar diretamente na tela "Dados de pagamento" do painel dele.

---

## Como cadastrar no banco

```sql
UPDATE organizers
SET
  asaas_api_key         = '$aact_...',         -- API Key do organizador (privado)
  asaas_wallet_id       = 'uuid-da-carteira',  -- Wallet ID do organizador
  commission_percentage = 15                   -- % de comissão da plataforma
WHERE id = 'uuid-do-organizador';
```

---

## Fluxo PIX

```
Atleta clica em PIX
  → paymentService.createPixPayment({ eventId, organizerId, value, customer, externalReference: signupId })
  → Backend cria cobrança PIX no Asaas com split automático
  → Retorna QR Code (imagem base64 + copia-e-cola)
  → Atleta paga
  → Asaas → Webhook → backend confirma inscrição
  → Supabase Realtime → frontend exibe modal
```

## Fluxo Cartão de Crédito

```
Atleta preenche dados do cartão (com flip visual 3D) e escolhe parcelas (1x–12x)
  → paymentService.createCreditCardPayment({ ..., installmentCount, creditCard, creditCardHolderInfo, externalReference: signupId })
  → Backend processa no Asaas com split automático
  → Asaas retorna CONFIRMED
  → Asaas → Webhook → backend confirma inscrição
  → Supabase Realtime → frontend exibe modal
  → Comissão fica em "Splits a receber" e é repassada conforme cada parcela é paga
```

---

## Realtime — como a confirmação chega ao front

O `AsaasPaymentStep` cria um canal Supabase Realtime no mount e escuta atualizações na tabela `event_signups`. Quando o `status` muda para `'confirmada'` e o `id` bate com o `signupId` atual, o callback `onSuccess` é chamado.

Padrão de refs usado para evitar closures stale:
```ts
signupIdRef.current  // sempre aponta para o signupId mais recente
onSuccessRef.current // sempre aponta para o callback mais recente
methodRef.current    // método de pagamento usado (pix | credit-card)
```

---

## Split de comissão

- A plataforma recebe `commission_percentage`% de cada pagamento
- O organizador recebe o restante direto na carteira Asaas dele (`asaas_wallet_id`)
- **PIX:** comissão cai instantaneamente no extrato da plataforma
- **Cartão parcelado:** comissão fica em "A receber" e é repassada parcela a parcela pelo Asaas automaticamente

---

## Telas de configuração

### Admin (`/admin/organizers`)
- Aba **Pagamento** no dialog de gerenciamento do organizador
- Campos: Chave PIX, Beneficiário, WhatsApp, E-mail, Responsável financeiro, **API Key Asaas**, **Wallet ID Asaas**
- Salva diretamente na tabela `organizers` via Supabase

### Organizador (`/admin/payment-settings`)
- Tela "Dados de pagamento" acessível apenas pelo próprio organizador
- Campos visíveis: Chave PIX, Beneficiário, WhatsApp, E-mail, Responsável, **Wallet ID Asaas**
- API Key **não é exibida** para o organizador — é gerenciada apenas pelo admin
- Salva via RPC `update_organizer_payment_settings` (SECURITY DEFINER — só atualiza o próprio organizador)
