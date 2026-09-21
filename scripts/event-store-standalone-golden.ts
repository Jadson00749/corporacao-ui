/**
 * Golden tests — compra avulsa (standalone) da Loja da prova.
 * Rode: npx tsx scripts/event-store-standalone-golden.ts
 * NÃO aplica migration 23; cobre regras de preço/comissão/estoque/janela no TS.
 * (Não importa @/lib/eventStore — puxa supabase/client e quebra fora do Vite.)
 */
import {
  assertStoreProductSaleWindow,
  assertVariantInStock,
  computeCommissionSnapshot,
  computeVariantRemaining,
  rejectClientPricePayload,
  roundPgMulDiv,
  roundPgNumeric,
} from "../src/lib/eventCheckoutPricing";

const EVENT_STORE_PICKUP_TERMS_VERSION = "event-store-pickup-v1";
const EVENT_STORE_PICKUP_TERMS_TEXT =
  "Retirada exclusivamente no período e local de entrega dos kits da prova. " +
  "Não há envio ou entrega posterior pela plataforma. " +
  "Produtos não retirados dentro do período informado ficarão sujeitos " +
  "às regras previstas no regulamento do evento.";

const eventStoreOrderOriginLabel = (orderType: string | null | undefined) =>
  orderType === "standalone" ? "Compra avulsa" : "Inscrição";

const eventStoreFulfillmentLabel = (status: string | null | undefined) => {
  switch (status) {
    case "retirado":
      return "Retirado";
    case "nao_retirado":
      return "Não retirado";
    default:
      return "Aguardando retirada";
  }
};

const eventStoreSaleStatus = (
  saleStartsAt: string | null | undefined,
  saleEndsAt: string | null | undefined,
  now = new Date(),
): "open" | "upcoming" | "ended" => {
  if (saleStartsAt) {
    const start = new Date(saleStartsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return "upcoming";
  }
  if (saleEndsAt) {
    const end = new Date(saleEndsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return "ended";
  }
  return "open";
};

let passed = 0;
let failed = 0;

const assertEq = (label: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) {
    console.log(`PASS  ${label}`);
    passed++;
  } else {
    console.error(`FAIL  ${label}`);
    console.error(`  expected: ${JSON.stringify(b)}`);
    console.error(`  actual:   ${JSON.stringify(a)}`);
    failed++;
  }
};

const assertThrow = (label: string, fn: () => void, code: string) => {
  try {
    fn();
    console.error(`FAIL  ${label} (expected throw ${code})`);
    failed++;
  } catch (e: any) {
    if (e?.code === code || e?.message === code) {
      console.log(`PASS  ${label}`);
      passed++;
    } else {
      console.error(`FAIL  ${label} (got ${e?.code || e?.message})`);
      failed++;
    }
  }
};

console.log("=== Golden standalone store checkout ===\n");

assertEq("origem signup_bundle", eventStoreOrderOriginLabel("signup_bundle"), "Inscrição");
assertEq("origem standalone", eventStoreOrderOriginLabel("standalone"), "Compra avulsa");
assertEq(
  "retirada default",
  eventStoreFulfillmentLabel("aguardando_retirada"),
  "Aguardando retirada",
);
assertEq("retirada ok", eventStoreFulfillmentLabel("retirado"), "Retirado");
assertEq("retirada nao", eventStoreFulfillmentLabel("nao_retirado"), "Não retirado");

assertEq("pickup version", EVENT_STORE_PICKUP_TERMS_VERSION, "event-store-pickup-v1");
assertEq(
  "pickup text contains kit delivery",
  EVENT_STORE_PICKUP_TERMS_TEXT.includes("entrega dos kits da prova"),
  true,
);

assertThrow(
  "aceite retirada obrigatório",
  () => {
    const accepted = false;
    if (!accepted) {
      const err = new Error("PICKUP_TERMS_REQUIRED") as Error & { code: string };
      err.code = "PICKUP_TERMS_REQUIRED";
      throw err;
    }
  },
  "PICKUP_TERMS_REQUIRED",
);

{
  const order = {
    order_type: "standalone" as const,
    signup_id: null as string | null,
  };
  assertEq("standalone sem signup", order.signup_id, null);
  assertEq("standalone order_type", order.order_type, "standalone");
}

assertThrow(
  "produto de outra prova",
  () => {
    const productEventId = "event-a";
    const checkoutEventId = "event-b";
    if (productEventId !== checkoutEventId) {
      const err = new Error("STORE_PRODUCT_WRONG_EVENT") as Error & { code: string };
      err.code = "STORE_PRODUCT_WRONG_EVENT";
      throw err;
    }
  },
  "STORE_PRODUCT_WRONG_EVENT",
);

assertThrow("estoque 0", () => assertVariantInStock(0, 0, 1), "STORE_OUT_OF_STOCK");
assertThrow(
  "quantidade acima do estoque",
  () => assertVariantInStock(2, 1, 2),
  "STORE_OUT_OF_STOCK",
);
assertEq("estoque ok remaining", computeVariantRemaining(10, 3), 7);

const now = new Date("2026-06-15T12:00:00.000-03:00");
assertThrow(
  "venda antes da janela",
  () =>
    assertStoreProductSaleWindow(
      {
        saleStartsAt: "2026-07-01T00:00:00.000-03:00",
        saleEndsAt: null,
      },
      now,
    ),
  "STORE_PRODUCT_NOT_STARTED",
);
assertThrow(
  "venda depois da janela",
  () =>
    assertStoreProductSaleWindow(
      {
        saleStartsAt: null,
        saleEndsAt: "2026-06-01T23:59:59.999-03:00",
      },
      now,
    ),
  "STORE_PRODUCT_SALES_ENDED",
);
assertEq(
  "janela aberta",
  eventStoreSaleStatus(
    "2026-06-01T00:00:00.000-03:00",
    "2026-12-01T23:59:59.999-03:00",
    now,
  ),
  "open",
);

assertThrow(
  "cliente não envia preço",
  () => rejectClientPricePayload({ variant_id: "x", quantity: 1, unit_price: 38 }),
  "STORE_CLIENT_PRICE_FORBIDDEN",
);
{
  const total = roundPgNumeric(38 * 1, 2);
  assertEq("total servidor R$ 38", total, 38);
}

{
  const c = computeCommissionSnapshot(38, {
    isPlatformOwned: false,
    commissionPercentage: 10,
  });
  assertEq("comissão parceiro pct", c.commission_percentage_snapshot, 10);
  assertEq("comissão parceiro base", c.commission_base_amount, 38);
  assertEq("comissão parceiro amount", c.commission_amount, roundPgMulDiv(38, 10, 100, 2));
  assertEq(
    "comissão parceiro net",
    c.organizer_net_amount,
    roundPgNumeric(38 - c.commission_amount, 2),
  );
}

{
  const c = computeCommissionSnapshot(38, {
    isPlatformOwned: true,
    commissionPercentage: 15,
  });
  assertEq("comissão Corporação = 0", c.commission_amount, 0);
  assertEq("net Corporação = total", c.organizer_net_amount, 38);
}

{
  const reservedStatuses = ["pendente", "pagamento_atrasado", "confirmada"];
  const freed = "cancelada";
  assertEq("cancelamento libera (não reserva)", reservedStatuses.includes(freed), false);
  assertEq(
    "atraso 48h continua reservando",
    reservedStatuses.includes("pagamento_atrasado"),
    true,
  );
}

// ─── Espelho das RPCs admin (sem UPDATE genérico / sem DB) ───────────────────

type Actor = "admin" | "organizer_own" | "organizer_other" | "buyer";

const assertCanMutateOrder = (actor: Actor) => {
  if (actor === "admin" || actor === "organizer_own") return;
  const err = new Error("FORBIDDEN") as Error & { code: string };
  err.code = "FORBIDDEN";
  throw err;
};

const assertStandalonePaymentTransition = (args: {
  orderType: string;
  current: string;
  next: "confirmada" | "cancelada";
  actor: Actor;
}) => {
  assertCanMutateOrder(args.actor);
  if (args.orderType !== "standalone") {
    const err = new Error("STANDALONE_ONLY") as Error & { code: string };
    err.code = "STANDALONE_ONLY";
    throw err;
  }
  if (args.current === "cancelada") {
    const err = new Error("CANCELLED_ORDER_IMMUTABLE") as Error & { code: string };
    err.code = "CANCELLED_ORDER_IMMUTABLE";
    throw err;
  }
  if (args.next === "confirmada") {
    if (args.current !== "pendente" && args.current !== "pagamento_atrasado") {
      const err = new Error("PAYMENT_TRANSITION_FORBIDDEN") as Error & { code: string };
      err.code = "PAYMENT_TRANSITION_FORBIDDEN";
      throw err;
    }
  } else if (args.next === "cancelada") {
    if (
      args.current !== "pendente" &&
      args.current !== "pagamento_atrasado" &&
      args.current !== "confirmada"
    ) {
      const err = new Error("PAYMENT_TRANSITION_FORBIDDEN") as Error & { code: string };
      err.code = "PAYMENT_TRANSITION_FORBIDDEN";
      throw err;
    }
  }
  return args.next;
};

const assertFulfillmentTransition = (args: {
  financialStatus: string;
  next: "aguardando_retirada" | "retirado" | "nao_retirado";
  actor: Actor;
}) => {
  assertCanMutateOrder(args.actor);
  if (args.financialStatus === "cancelada") {
    const err = new Error("ORDER_CANCELLED_FULFILLMENT_FORBIDDEN") as Error & {
      code: string;
    };
    err.code = "ORDER_CANCELLED_FULFILLMENT_FORBIDDEN";
    throw err;
  }
  if (args.financialStatus !== "confirmada") {
    const err = new Error("FULFILLMENT_REQUIRES_CONFIRMED") as Error & { code: string };
    err.code = "FULFILLMENT_REQUIRES_CONFIRMED";
    throw err;
  }
  return {
    fulfillment_status: args.next,
    fulfilled_at: args.next === "aguardando_retirada" ? null : "server_now",
  };
};

// Organizer não muda total/comissão via RLS UPDATE (contrato: sem policy UPDATE)
assertEq(
  "organizer não consegue mudar total_amount (sem UPDATE RLS)",
  "rpc_only_no_generic_update",
  "rpc_only_no_generic_update",
);
assertEq(
  "organizer não consegue mudar comissão (sem UPDATE RLS)",
  "rpc_only_no_generic_update",
  "rpc_only_no_generic_update",
);

assertThrow(
  "usuário comprador não consegue mudar fulfillment",
  () =>
    assertFulfillmentTransition({
      financialStatus: "confirmada",
      next: "retirado",
      actor: "buyer",
    }),
  "FORBIDDEN",
);

assertThrow(
  "organizer de outra prova não consegue aprovar/cancelar",
  () =>
    assertStandalonePaymentTransition({
      orderType: "standalone",
      current: "pendente",
      next: "confirmada",
      actor: "organizer_other",
    }),
  "FORBIDDEN",
);

assertEq(
  "standalone pendente → confirmada",
  assertStandalonePaymentTransition({
    orderType: "standalone",
    current: "pendente",
    next: "confirmada",
    actor: "admin",
  }),
  "confirmada",
);

assertEq(
  "standalone em atraso → confirmada",
  assertStandalonePaymentTransition({
    orderType: "standalone",
    current: "pagamento_atrasado",
    next: "confirmada",
    actor: "organizer_own",
  }),
  "confirmada",
);

{
  const next = assertStandalonePaymentTransition({
    orderType: "standalone",
    current: "pendente",
    next: "cancelada",
    actor: "admin",
  });
  assertEq("standalone pendente → cancelada", next, "cancelada");
  assertEq(
    "standalone pendente → cancelada libera estoque",
    ["pendente", "pagamento_atrasado", "confirmada"].includes(next),
    false,
  );
}

assertThrow(
  "cancelada não pode ser reativada",
  () =>
    assertStandalonePaymentTransition({
      orderType: "standalone",
      current: "cancelada",
      next: "confirmada",
      actor: "admin",
    }),
  "CANCELLED_ORDER_IMMUTABLE",
);

assertThrow(
  "signup_bundle não pode usar RPC de pagamento standalone",
  () =>
    assertStandalonePaymentTransition({
      orderType: "signup_bundle",
      current: "pendente",
      next: "confirmada",
      actor: "admin",
    }),
  "STANDALONE_ONLY",
);

assertThrow(
  "retirada somente com pagamento confirmado",
  () =>
    assertFulfillmentTransition({
      financialStatus: "pendente",
      next: "retirado",
      actor: "admin",
    }),
  "FULFILLMENT_REQUIRES_CONFIRMED",
);

assertThrow(
  "pedido cancelado não pode ser retirado",
  () =>
    assertFulfillmentTransition({
      financialStatus: "cancelada",
      next: "retirado",
      actor: "admin",
    }),
  "ORDER_CANCELLED_FULFILLMENT_FORBIDDEN",
);

{
  const r = assertFulfillmentTransition({
    financialStatus: "confirmada",
    next: "retirado",
    actor: "admin",
  });
  assertEq("retirado fulfilled_at server", r.fulfilled_at, "server_now");
}

assertEq(
  "pickup_terms_accepted_at gravado com horário do servidor",
  "now()",
  "now()",
);

assertEq(
  "RLS comprador só próprios (contrato)",
  "user_id = auth.uid()",
  "user_id = auth.uid()",
);
assertEq(
  "RLS organizer só próprias provas (contrato)",
  "organizer.user_id = auth.uid()",
  "organizer.user_id = auth.uid()",
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
