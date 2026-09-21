/**
 * Central de pagamentos (admin) — unifica inscrição + standalone
 * sem duplicar signup_bundle.
 */
import { signupValue, type EventPricingRow, type ExportSignup } from "@/lib/exportSignupsXlsx";

export type PaymentEntityType = "signup" | "standalone";
export type PaymentOrigin =
  | "registration"
  | "registration_with_products"
  | "product";

export type PaymentRow = {
  id: string;
  entityType: PaymentEntityType;
  customerName: string;
  email: string;
  phone: string;
  cpf: string;
  eventId: string;
  eventName: string;
  organizerId: string | null;
  origin: PaymentOrigin;
  amount: number;
  registrationAmount: number;
  productsAmount: number;
  status: string;
  createdAt: string;
};

export type SignupMoney = {
  total: number;
  registration: number;
  products: number;
  /** true se veio de colunas snapshot; false se fallback legado signupValue */
  fromSnapshot: boolean;
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Valor financeiro de uma inscrição.
 * Preferência: total_amount / registration_amount / products_amount.
 * Fallback legado: signupValue (lista de preços da prova) — preserva histórico.
 */
export function resolveSignupMoney(
  s: ExportSignup & {
    registration_amount?: number | null;
    products_amount?: number | null;
    total_amount?: number | null;
  },
  event?: EventPricingRow,
): SignupMoney {
  const regSnap = num(s.registration_amount);
  const prodSnap = num(s.products_amount);
  const totalSnap = num(s.total_amount);

  if (totalSnap != null && totalSnap >= 0) {
    const products = Math.max(0, prodSnap ?? 0);
    const registration =
      regSnap != null && regSnap >= 0
        ? regSnap
        : Math.max(0, Math.round((totalSnap - products) * 100) / 100);
    return {
      total: totalSnap,
      registration,
      products,
      fromSnapshot: true,
    };
  }

  if (regSnap != null || prodSnap != null) {
    const registration = Math.max(0, regSnap ?? 0);
    const products = Math.max(0, prodSnap ?? 0);
    return {
      total: Math.round((registration + products) * 100) / 100,
      registration,
      products,
      fromSnapshot: true,
    };
  }

  const legacy = signupValue(s, event) ?? 0;
  return {
    total: legacy,
    registration: legacy,
    products: 0,
    fromSnapshot: false,
  };
}

export function paymentOriginLabel(origin: PaymentOrigin): string {
  switch (origin) {
    case "registration_with_products":
      return "Inscrição + produtos";
    case "product":
      return "Produto";
    default:
      return "Inscrição";
  }
}

export function signupToPaymentRow(args: {
  signup: ExportSignup & {
    registration_amount?: number | null;
    products_amount?: number | null;
    total_amount?: number | null;
    participant_full_name?: string | null;
    participant_cpf?: string | null;
    participant_phone?: string | null;
    user_id?: string;
  };
  event?: EventPricingRow & { organizer_id?: string | null };
  organizerId?: string | null;
}): PaymentRow {
  const s = args.signup;
  const money = resolveSignupMoney(s, args.event);
  const name =
    (s.participant_full_name || "").trim() ||
    s.profiles?.full_name ||
    "—";
  const origin: PaymentOrigin =
    money.products > 0 ? "registration_with_products" : "registration";

  return {
    id: s.id,
    entityType: "signup",
    customerName: name,
    email: s.profiles?.email || "",
    phone: s.profiles?.whatsapp || s.participant_phone || "",
    cpf: (s.participant_cpf || s.profiles?.cpf || "").trim(),
    eventId: s.event_id,
    eventName: s.events?.name || args.event?.name || "Prova",
    organizerId: args.organizerId ?? args.event?.organizer_id ?? null,
    origin,
    amount: money.total,
    registrationAmount: money.registration,
    productsAmount: money.products,
    status: (s.status || "").toLowerCase(),
    createdAt: s.created_at,
  };
}

export function standaloneOrderToPaymentRow(args: {
  order: {
    id: string;
    event_id: string;
    organizer_id?: string | null;
    status: string;
    total_amount: number;
    products_amount?: number;
    created_at: string;
    buyer_name_snapshot?: string | null;
    buyer_email_snapshot?: string | null;
    buyer_phone_snapshot?: string | null;
    events?: { id: string; name: string } | null;
  };
}): PaymentRow {
  const o = args.order;
  const total = Number(o.total_amount) || 0;
  return {
    id: o.id,
    entityType: "standalone",
    customerName: (o.buyer_name_snapshot || "").trim() || "Comprador",
    email: (o.buyer_email_snapshot || "").trim(),
    phone: (o.buyer_phone_snapshot || "").trim(),
    cpf: "",
    eventId: o.event_id,
    eventName: o.events?.name || "Prova",
    organizerId: o.organizer_id ?? null,
    origin: "product",
    amount: total,
    registrationAmount: 0,
    productsAmount: total,
    status: (o.status || "").toLowerCase(),
    createdAt: o.created_at,
  };
}

/** KPIs da central de pagamentos (sem duplicar signup_bundle). */
export function computePaymentKpis(rows: PaymentRow[]) {
  let aReceber = 0;
  let emAtraso = 0;
  let recebido = 0;
  let cancelado = 0;
  let countReceber = 0;
  let countAtraso = 0;
  let countRecebido = 0;
  let countCancelado = 0;

  for (const r of rows) {
    const a = r.amount || 0;
    if (r.status === "confirmada") {
      recebido += a;
      countRecebido += 1;
    } else if (r.status === "pagamento_atrasado") {
      emAtraso += a;
      aReceber += a;
      countAtraso += 1;
      countReceber += 1;
    } else if (r.status === "pendente") {
      aReceber += a;
      countReceber += 1;
    } else if (r.status === "cancelada") {
      cancelado += a;
      countCancelado += 1;
    }
  }

  return {
    aReceber: Math.round(aReceber * 100) / 100,
    emAtraso: Math.round(emAtraso * 100) / 100,
    recebido: Math.round(recebido * 100) / 100,
    cancelado: Math.round(cancelado * 100) / 100,
    countReceber,
    countAtraso,
    countRecebido,
    countCancelado,
  };
}
