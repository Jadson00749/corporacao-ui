/**
 * Golden tests — paridade do checkout (TS helpers vs espelho SQL).
 * Rode: npx tsx scripts/event-checkout-golden.ts
 * NÃO aplica migration.
 */
import {
  assertStoreProductSaleWindow,
  assertVariantInStock,
  computeCheckoutAmounts,
  computeCheckoutAmountsSqlMirror,
  computeCommissionSnapshot,
  computeVariantRemaining,
  rejectClientPricePayload,
  roundPgMulDiv,
  roundPgNumeric,
  scarcityLabelFromRemaining,
  type CheckoutPricingInput,
  type DistanceRow,
} from "../src/lib/eventCheckoutPricing";
import type { EventKitOption } from "../src/lib/eventKits";
import type { EventCoupon } from "../src/lib/eventCoupons";

const distLote1: DistanceRow = {
  distance: "5Km",
  price: 89.9,
};

const distWithLotes: DistanceRow = {
  distance: "5Km",
  price: 89.9,
  price_lote2: 99.9,
  lote2_starts_at: "2026-06-01",
  price_lote3: 109.9,
  lote3_starts_at: "2026-09-01",
};

const distSeniorFixed: DistanceRow = {
  distance: "10Km",
  price: 120,
  price_60_plus: 60,
};

const kitCompleto: EventKitOption = {
  name: "Kit Completo",
  extra_price: 20,
  availability: "all_lots",
  has_shirt: true,
  sizes: ["P", "M"],
};

const kitEconomico: EventKitOption = {
  name: "Kit Econômico",
  extra_price: -20,
  availability: "last_lot",
  has_shirt: false,
  sizes: [],
};

const kitPlus20: EventKitOption = {
  name: "Kit Plus",
  extra_price: 20,
  availability: "all_lots",
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

const runParity = (label: string, input: CheckoutPricingInput, expect: Partial<ReturnType<typeof computeCheckoutAmounts>>) => {
  const ts = computeCheckoutAmounts(input);
  const sql = computeCheckoutAmountsSqlMirror(input);
  assertEq(`${label} · TS≡SQL mirror`, ts, sql);
  for (const [k, v] of Object.entries(expect)) {
    assertEq(`${label} · ${k}`, (ts as any)[k], v);
  }
};

console.log("=== Golden checkout parity ===\n");

// A
runParity("A inscrição normal", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  today: "2026-03-01",
}, {
  registration_base_amount: 89.9,
  kit_adjustment_amount: 0,
  discount_amount: 0,
  registration_amount: 89.9,
  products_amount: 0,
  total_amount: 89.9,
});

// B
runParity("B kit +20", {
  distance: distLote1,
  selectedKits: [kitPlus20],
  allKitsForEvent: [kitPlus20],
  today: "2026-03-01",
}, {
  registration_base_amount: 89.9,
  kit_adjustment_amount: 20,
  registration_amount: 109.9,
  total_amount: 109.9,
});

// C
runParity("C Kit Econômico -20 (last_lot no último lote)", {
  distance: distWithLotes,
  selectedKits: [kitEconomico],
  allKitsForEvent: [kitEconomico],
  today: "2026-09-15", // lote 3 = last
}, {
  registration_base_amount: 109.9,
  kit_adjustment_amount: -20,
  registration_amount: 89.9,
  total_amount: 89.9,
});

assertThrow("C2 Kit Econômico antes do last_lot", () => {
  computeCheckoutAmounts({
    distance: distWithLotes,
    selectedKits: [kitEconomico],
    allKitsForEvent: [kitEconomico],
    today: "2026-03-01", // lote 1
  });
}, "STORE_KIT_NOT_AVAILABLE");

// D
runParity("D cupom 10%", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  coupon: { code: "DESC10", type: "percentage", value: 10, active: true },
  today: "2026-03-01",
}, {
  registration_base_amount: 89.9,
  discount_amount: 8.99,
  registration_amount: 80.91,
  total_amount: 80.91,
});

// E
runParity("E cupom 100% sem produto", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  coupon: { code: "FREE", type: "percentage", value: 100, active: true },
  today: "2026-03-01",
}, {
  registration_amount: 0,
  products_amount: 0,
  total_amount: 0,
});

// F
runParity("F cupom 100% + produto 39.90", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  coupon: { code: "FREE", type: "percentage", value: 100, active: true },
  storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 39.9, eventId: "e1" }],
  eventId: "e1",
  today: "2026-03-01",
}, {
  registration_amount: 0,
  products_amount: 39.9,
  total_amount: 39.9,
});

// G
runParity("G benefício 60+ preço fixo", {
  distance: distSeniorFixed,
  eventDate: "2026-10-10",
  participantBirth: "1960-01-01",
  selectedKits: [],
  allKitsForEvent: [],
  today: "2026-03-01",
}, {
  registration_base_amount: 60,
  senior: true,
  senior_fixed: true,
  total_amount: 60,
});

// H
runParity("H troca de lote (lote 2)", {
  distance: distWithLotes,
  selectedKits: [],
  allKitsForEvent: [],
  today: "2026-07-01",
}, {
  registration_base_amount: 99.9,
  lote: 2,
  total_amount: 99.9,
});

// I
runParity("I produto qty>1", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  storeLines: [{ variantId: "v1", quantity: 2, unitPrice: 39.9, eventId: "e1" }],
  eventId: "e1",
  today: "2026-03-01",
}, {
  products_amount: 79.8,
  total_amount: 169.7,
});

// J
assertThrow("J preço enviado pelo cliente", () => {
  rejectClientPricePayload({ variant_id: "v1", quantity: 1, unit_price: 1 });
}, "STORE_CLIENT_PRICE_FORBIDDEN");

// K
assertThrow("K produto de outra prova", () => {
  computeCheckoutAmounts({
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 39.9, eventId: "e2" }],
    today: "2026-03-01",
  });
}, "STORE_PRODUCT_WRONG_EVENT");

// L
assertThrow("L variante inativa", () => {
  computeCheckoutAmounts({
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 39.9, eventId: "e1", variantActive: false }],
    today: "2026-03-01",
  });
}, "STORE_VARIANT_INACTIVE");

// Extra: cupom fixo + kit negativo
runParity("EXTRA cupom fixo 30 + kit -20", {
  distance: distLote1,
  selectedKits: [kitEconomico],
  allKitsForEvent: [kitEconomico],
  // last_lot: force distance with only 1 lote so economico allowed
  coupon: { code: "FIX30", type: "fixed", value: 30, active: true } as EventCoupon,
  today: "2026-03-01",
}, {
  // wait - kit economico is last_lot and distLote1 last is 1, so OK
  registration_base_amount: 89.9,
  kit_adjustment_amount: -20,
  // coupon on max(0, 69.9) = 69.9, fixed 30 → discount 30, reg 39.9
  discount_amount: 30,
  registration_amount: 39.9,
  total_amount: 39.9,
});

console.log(`\n=== Commission ===\n`);

// Commission A
{
  const c = computeCommissionSnapshot(100, { commissionPercentage: 5 });
  assertEq("COMM A pct", c.commission_percentage_snapshot, 5);
  assertEq("COMM A base", c.commission_base_amount, 100);
  assertEq("COMM A amount", c.commission_amount, 5);
  assertEq("COMM A net", c.organizer_net_amount, 95);
}

// Commission B
runParity("COMM B reg 100 + prod 50 @5%", {
  distance: { distance: "5Km", price: 100 },
  selectedKits: [],
  allKitsForEvent: [],
  storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 50, eventId: "e1" }],
  eventId: "e1",
  commissionPercentage: 5,
  today: "2026-03-01",
}, {
  total_amount: 150,
  commission_base_amount: 150,
  commission_amount: 7.5,
  organizer_net_amount: 142.5,
  commission_percentage_snapshot: 5,
});

// Commission C
runParity("COMM C cupom 100% + produto 39.90 @5%", {
  distance: distLote1,
  selectedKits: [],
  allKitsForEvent: [],
  coupon: { code: "FREE", type: "percentage", value: 100, active: true },
  storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 39.9, eventId: "e1" }],
  eventId: "e1",
  commissionPercentage: 5,
  today: "2026-03-01",
}, {
  registration_amount: 0,
  products_amount: 39.9,
  total_amount: 39.9,
  commission_amount: 2,
  organizer_net_amount: 37.9,
});

// Commission D — platform (is_platform_owner / organizer_id null)
runParity("COMM D platform pct 0", {
  distance: { distance: "5Km", price: 100 },
  selectedKits: [],
  allKitsForEvent: [],
  storeLines: [{ variantId: "v1", quantity: 1, unitPrice: 50, eventId: "e1" }],
  eventId: "e1",
  isPlatformOwned: true,
  commissionPercentage: 99, // ignorado
  today: "2026-03-01",
}, {
  total_amount: 150,
  commission_percentage_snapshot: 0,
  commission_amount: 0,
  organizer_net_amount: 150,
});

// Commission E — snapshot congelado (cadastro futuro não altera)
{
  const sold = computeCommissionSnapshot(100, { commissionPercentage: 5 });
  const laterCadastro = 7;
  assertEq("COMM E frozen pct", sold.commission_percentage_snapshot, 5);
  assertEq("COMM E not using future %", sold.commission_amount, 5);
  assertEq("COMM E future would differ", computeCommissionSnapshot(100, { commissionPercentage: laterCadastro }).commission_amount, 7);
}

console.log(`\n=== PG numeric round (half away from zero) ===\n`);

{
  // Expected = PostgreSQL: select round(x::numeric, 2);
  const cases: [string, number][] = [
    ["0.005", 0.01],
    ["1.005", 1.01],
    ["2.675", 2.68],
    ["10.125", 10.13],
  ];
  for (const [input, expected] of cases) {
    assertEq(`ROUND ${input}`, roundPgNumeric(input, 2), expected);
  }
  // JS float trap: Math.round(1.005*100)/100 === 1 — mirror must use string/decimal path
  assertEq("ROUND float-trap 1.005 via number stringified", roundPgNumeric(1.005, 2), 1.01);
  assertEq("ROUND muldiv 39.90*5/100", roundPgMulDiv("39.90", 5, 100, 2), 2);
  assertEq("ROUND muldiv 150*5/100", roundPgMulDiv(150, 5, 100, 2), 7.5);
}

console.log(`\n=== Sale window + stock ===\n`);

// SALE A — antes do início
assertThrow("SALE A before start blocked", () => {
  assertStoreProductSaleWindow(
    {
      saleStartsAt: "2026-10-01T00:00:00.000Z",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    },
    "2026-09-20T12:00:00.000Z",
  );
}, "STORE_PRODUCT_NOT_STARTED");

assertThrow("SALE A via checkout", () => {
  computeCheckoutAmounts({
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    pricedAt: "2026-09-20T12:00:00.000Z",
    storeLines: [{
      variantId: "v1",
      quantity: 1,
      unitPrice: 39.9,
      eventId: "e1",
      saleStartsAt: "2026-10-01T00:00:00.000Z",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    }],
    today: "2026-09-20",
  });
}, "STORE_PRODUCT_NOT_STARTED");

// SALE B — durante a janela
{
  assertStoreProductSaleWindow(
    {
      saleStartsAt: "2026-10-01T00:00:00.000Z",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    },
    "2026-10-05T15:00:00.000Z",
  );
  console.log("PASS  SALE B during window allowed (assert)");
  passed++;

  runParity("SALE B during window checkout", {
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    pricedAt: "2026-10-05T15:00:00.000Z",
    storeLines: [{
      variantId: "v1",
      quantity: 1,
      unitPrice: 39.9,
      eventId: "e1",
      saleStartsAt: "2026-10-01T00:00:00.000Z",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    }],
    today: "2026-10-05",
  }, {
    products_amount: 39.9,
    total_amount: 129.8,
  });
}

// SALE C — depois do limite
assertThrow("SALE C after end blocked", () => {
  assertStoreProductSaleWindow(
    {
      saleStartsAt: "2026-10-01T00:00:00.000Z",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    },
    "2026-10-11T00:00:01.000Z",
  );
}, "STORE_PRODUCT_SALES_ENDED");

assertThrow("SALE C via checkout", () => {
  computeCheckoutAmounts({
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    pricedAt: "2026-10-11T00:00:01.000Z",
    storeLines: [{
      variantId: "v1",
      quantity: 1,
      unitPrice: 39.9,
      eventId: "e1",
      saleEndsAt: "2026-10-10T23:59:59.000Z",
    }],
    today: "2026-10-11",
  });
}, "STORE_PRODUCT_SALES_ENDED");

// SALE D — nulls = sem janela
{
  assertStoreProductSaleWindow({}, "2026-12-01T00:00:00.000Z");
  console.log("PASS  SALE D null window open");
  passed++;
}

// STOCK A — variante estoque 0
assertThrow("STOCK A remaining 0 blocked", () => {
  assertVariantInStock(0, 0, 1);
}, "STORE_OUT_OF_STOCK");

assertThrow("STOCK A via checkout", () => {
  computeCheckoutAmounts({
    distance: distLote1,
    selectedKits: [],
    allKitsForEvent: [],
    eventId: "e1",
    storeLines: [{
      variantId: "v-gg",
      quantity: 1,
      unitPrice: 69.9,
      eventId: "e1",
      stockQuantity: 0,
      reservedQuantity: 0,
    }],
    today: "2026-03-01",
  });
}, "STORE_OUT_OF_STOCK");

// STOCK B — estoque 3 → remaining = 3
{
  assertEq("STOCK B remaining=3", computeVariantRemaining(3, 0), 3);
  assertEq("STOCK B scarcity", scarcityLabelFromRemaining(3), "Últimas 3 unidades");
  assertVariantInStock(3, 0, 1);
  console.log("PASS  STOCK B qty 1 of 3 allowed");
  passed++;
  assertThrow("STOCK B qty 4 of 3 blocked", () => {
    assertVariantInStock(3, 0, 4);
  }, "STORE_OUT_OF_STOCK");
}

// STOCK C — reserved reduz remaining
{
  assertEq("STOCK C remaining after reserved", computeVariantRemaining(10, 7), 3);
  assertEq("STOCK C unlimited null", computeVariantRemaining(null, 99), null);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
