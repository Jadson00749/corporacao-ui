import ExcelJS from "exceljs";
import { slugify } from "@/lib/exportSignupsXlsx";
import {
  computeEventStoreSeparation,
  eventStoreFulfillmentLabel,
  eventStoreOrderBuyerEmail,
  eventStoreOrderBuyerName,
  eventStoreOrderBuyerPhone,
  eventStoreOrderOriginLabel,
  type EventStoreOrderRow,
} from "@/lib/eventStore";
import { getSignupStatusInfo, signupStatusLabel } from "@/lib/signupOperationalStatus";

const brlNum = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const styleHeader = (ws: ExcelJS.Worksheet) => {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111111" },
  };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: "A1",
    to: { row: 1, column: ws.columnCount },
  };
};

export async function downloadEventStoreOrdersXlsx(args: {
  eventName: string;
  orders: EventStoreOrderRow[];
  /** Inclui coluna Prova quando o export cobre várias provas. */
  includeEventColumn?: boolean;
  eventNameById?: Map<string, string> | Record<string, string>;
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Corporação";
  const includeEvent = !!args.includeEventColumn;
  const nameOf = (eventId: string) => {
    if (!args.eventNameById) return "";
    if (args.eventNameById instanceof Map) {
      return args.eventNameById.get(eventId) || "";
    }
    return args.eventNameById[eventId] || "";
  };

  const sep = computeEventStoreSeparation(args.orders);
  const ws1 = wb.addWorksheet("Resumo para separação");
  ws1.columns = [
    { header: "Produto", key: "produto", width: 32 },
    { header: "Variação", key: "variacao", width: 16 },
    { header: "Quantidade confirmada", key: "confirmada", width: 22 },
    { header: "Quantidade pendente", key: "pendente", width: 20 },
    { header: "Total de unidades", key: "total", width: 18 },
  ];
  for (const row of sep) {
    ws1.addRow({
      produto: row.product,
      variacao: row.variant,
      confirmada: row.confirmed,
      pendente: row.pending,
      total: row.confirmed + row.pending,
    });
  }
  styleHeader(ws1);

  const ws2 = wb.addWorksheet("Pedidos e retirada");
  ws2.columns = [
    ...(includeEvent
      ? [{ header: "Prova", key: "prova", width: 28 } as const]
      : []),
    { header: "Origem", key: "origem", width: 16 },
    { header: "Comprador", key: "comprador", width: 28 },
    { header: "Telefone", key: "telefone", width: 16 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Produto", key: "produto", width: 28 },
    { header: "Variação", key: "variacao", width: 14 },
    { header: "Quantidade", key: "qty", width: 12 },
    { header: "Valor unitário", key: "unit", width: 14 },
    { header: "Valor total", key: "line", width: 14 },
    { header: "Status pagamento", key: "status", width: 18 },
    { header: "Status retirada", key: "retirada", width: 18 },
    { header: "Data do pedido", key: "data", width: 20 },
  ];

  for (const order of args.orders) {
    const comprador = eventStoreOrderBuyerName(order);
    const phone = eventStoreOrderBuyerPhone(order);
    const email = eventStoreOrderBuyerEmail(order);
    const op = getSignupStatusInfo({
      status: order.status || order.event_signups?.status,
    });
    for (const item of order.event_store_order_items ?? []) {
      ws2.addRow({
        ...(includeEvent ? { prova: nameOf(order.event_id) } : {}),
        origem: eventStoreOrderOriginLabel(order.order_type),
        comprador,
        telefone: phone,
        email,
        produto: item.product_name_snapshot || "Produto",
        variacao: item.variant_name_snapshot?.trim() || "Padrão",
        qty: item.quantity,
        unit: brlNum(item.unit_price),
        line: brlNum(item.line_total),
        status: op.label || signupStatusLabel(order.status),
        retirada: eventStoreFulfillmentLabel(order.fulfillment_status),
        data: formatDateTime(order.created_at),
      });
    }
  }
  styleHeader(ws2);
  ws2.getColumn("telefone").numFmt = "@";
  ws2.getColumn("email").numFmt = "@";
  ws2.getColumn("unit").numFmt = "#,##0.00";
  ws2.getColumn("line").numFmt = "#,##0.00";

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `produtos-${slugify(args.eventName || "prova")}-${todayYmd()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
