/**
 * Modelo compartilhado dos pedidos de locação (rental_orders e
 * rental_order_items), usado pela seleção do organizador e pela conferência
 * do super admin.
 *
 * line_total é coluna gerada no banco (quantity * unit_price), então nunca é
 * escrita pelo cliente. Já subtotal e total ficam no pedido e são recalculados
 * aqui a cada sincronização.
 */

export const RENTAL_STATUSES = [
  "draft",
  "requested",
  "under_review",
  "approved",
  "contracted",
  "delivered",
  "returned",
  "completed",
  "cancelled",
] as const;

export type RentalOrderStatus = (typeof RENTAL_STATUSES)[number];

export const RENTAL_STATUS_LABEL: Record<RentalOrderStatus, string> = {
  draft: "Rascunho",
  requested: "Solicitado",
  under_review: "Em análise",
  approved: "Aprovado",
  contracted: "Contratado",
  delivered: "Entregue",
  returned: "Devolvido",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const RENTAL_STATUS_CLASS: Record<RentalOrderStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  requested: "bg-warning/15 text-warning",
  under_review: "bg-warning/15 text-warning",
  approved: "bg-brand/15 text-brand",
  contracted: "bg-brand/15 text-brand",
  delivered: "bg-brand/15 text-brand",
  returned: "bg-secondary text-muted-foreground",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

/** Status em que o Admin pode hard-delete (limpeza / testes). */
export const RENTAL_DELETABLE_STATUSES = [
  "draft",
  "requested",
  "under_review",
  "cancelled",
] as const satisfies readonly RentalOrderStatus[];

export type RentalDeletableStatus = (typeof RENTAL_DELETABLE_STATUSES)[number];

export const canAdminDeleteRentalOrder = (raw?: string | null) =>
  (RENTAL_DELETABLE_STATUSES as readonly string[]).includes(statusOf(raw));

export const mapDeleteRentalOrderError = (err: {
  message?: string;
  code?: string;
}): string => {
  const msg = String(err?.message || "");
  if (/ORDER_STATUS_NOT_DELETABLE/i.test(msg)) {
    return "Pedidos já contratados ou concluídos não podem ser excluídos.";
  }
  if (/FORBIDDEN|NOT_AUTHENTICATED/i.test(msg)) {
    return "Você não tem permissão para excluir este pedido.";
  }
  if (/ORDER_NOT_FOUND/i.test(msg)) {
    return "Pedido não encontrado.";
  }
  if (/function.*delete_rental_order|PGRST202|404/i.test(msg)) {
    return "Exclusão ainda não está disponível no servidor. Aplique a migration 24.";
  }
  return "Não foi possível excluir o pedido.";
};

export const statusOf = (raw?: string | null): RentalOrderStatus =>
  (RENTAL_STATUSES as readonly string[]).includes((raw || "").trim())
    ? ((raw as string).trim() as RentalOrderStatus)
    : "draft";

/** Pedido encerrado não bloqueia a criação de um novo rascunho para a prova. */
export const isClosedStatus = (raw?: string | null) => {
  const s = statusOf(raw);
  return s === "cancelled" || s === "completed";
};

export type RentalOrder = {
  id: string;
  contract_number: string | null;
  organizer_id: string;
  event_id: string | null;
  event_name: string | null;
  event_date: string;
  event_location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  notes: string | null;
  status: string | null;
  subtotal: number | string | null;
  total: number | string | null;
  requested_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RentalOrderItem = {
  id: string;
  order_id: string;
  rental_item_id: string | null;
  item_name: string | null;
  unit_type: string | null;
  unit_label: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  configuration: unknown;
  line_total: number | string | null;
};

export const ORDER_COLUMNS =
  "id,contract_number,organizer_id,event_id,event_name,event_date,event_location,responsible_name,responsible_phone,notes,status,subtotal,total,created_at,updated_at";

/** Coluna adicionada pela migration 07; pedida à parte para não quebrar se ainda não existir. */
export const ORDER_COLUMNS_WITH_REQUESTED = `${ORDER_COLUMNS},requested_at`;

export const ORDER_ITEM_COLUMNS =
  "id,order_id,rental_item_id,item_name,unit_type,unit_label,quantity,unit_price,configuration,line_total";

export const num = (v: unknown) => Number(v ?? 0) || 0;

export const lineTotalOf = (i: RentalOrderItem) =>
  num(i.line_total) || num(i.quantity) * num(i.unit_price);

export const sumItems = (items: RentalOrderItem[]) =>
  items.reduce((sum, i) => sum + lineTotalOf(i), 0);

/** Rótulo da opção escolhida, gravada em configuration jsonb. */
export const configLabelOf = (configuration: unknown): string => {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return "";
  const c = configuration as Record<string, unknown>;
  const raw = c.label ?? c.option ?? c.name;
  return raw == null ? "" : String(raw).trim();
};

/**
 * Valor sempre gravável em configuration (NOT NULL DEFAULT '{}').
 * Sem opção → {}; com opção → { label }. Nunca null/undefined.
 */
export const configPayload = (label?: string | null): Record<string, unknown> => {
  const trimmed = (label || "").trim();
  return trimmed ? { label: trimmed } : {};
};

/** Normaliza o que veio do banco: null/undefined/inválido → {}. */
export const configOf = (configuration: unknown): Record<string, unknown> => {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return {};
  return configuration as Record<string, unknown>;
};

export const configFor = (label?: string | null) => configPayload(label);

const brl = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const dateBR = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
};

/** Quantidade sem decimal desnecessário: 30 em vez de 30,00. */
const qtyLabel = (v: unknown) => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR");
};

/**
 * Mensagem enviada ao WhatsApp da Corporação. É reforço de comunicação: o
 * pedido já está registrado na plataforma quando isso é aberto.
 */
export const buildRentalWhatsMessage = ({
  organizer,
  eventName,
  eventDate,
  eventLocation,
  items,
  total,
}: {
  organizer?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  items: RentalOrderItem[];
  total: number;
}) => {
  const lines: string[] = [
    "Olá! Gostaria de confirmar a disponibilidade de estruturas para o meu evento.",
    "",
  ];

  if (organizer) lines.push(`Organizador: ${organizer}`);
  if (eventName) lines.push(`Evento: ${eventName}`);
  if (eventDate) lines.push(`Data: ${dateBR(eventDate)}`);
  if (eventLocation) lines.push(`Local: ${eventLocation}`);

  lines.push("", "Itens solicitados:");
  for (const i of items) {
    const config = configLabelOf(i.configuration);
    const name = [i.item_name || "Item", config && `(${config})`].filter(Boolean).join(" ");
    lines.push(`- ${qtyLabel(i.quantity)}x ${name} — ${brl(lineTotalOf(i))}`);
  }

  lines.push("", `Valor estimado: ${brl(total)}`, "", "Poderiam confirmar a disponibilidade para essa data?");
  return lines.join("\n");
};
