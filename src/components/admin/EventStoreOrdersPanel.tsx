import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router-compat";
import {
  computeEventStoreOrderKpis,
  computeEventStoreSeparation,
  eventStoreFulfillmentLabel,
  eventStoreOrderBuyerName,
  eventStoreOrderOriginLabel,
  mapEventStoreAdminOrderError,
  updateEventStoreOrderFulfillment,
  useEventStoreOrders,
  type EventStoreFulfillmentStatus,
  type EventStoreOrderRow,
} from "@/lib/eventStore";
import { downloadEventStoreOrdersXlsx } from "@/lib/exportEventStoreOrdersXlsx";
import { getSignupStatusInfo } from "@/lib/signupOperationalStatus";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type OriginFilter = "all" | "signup_bundle" | "standalone";

type Props = {
  eventId: string;
  eventName: string;
};

export function EventStoreOrdersPanel({ eventId, eventName }: Props) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, refetch } = useEventStoreOrders(eventId);
  const [exporting, setExporting] = useState(false);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (originFilter === "all") return orders;
    return orders.filter((o) => (o.order_type || "signup_bundle") === originFilter);
  }, [orders, originFilter]);

  const kpis = useMemo(() => computeEventStoreOrderKpis(orders), [orders]);
  const separation = useMemo(
    () => computeEventStoreSeparation(orders),
    [orders],
  );
  const flatRows = useMemo(
    () => flattenOrderRows(filteredOrders, eventId),
    [filteredOrders, eventId],
  );

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadEventStoreOrdersXlsx({ eventName, orders });
      toast.success("Excel gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  };

  const setFulfillment = async (
    order: EventStoreOrderRow,
    status: EventStoreFulfillmentStatus,
  ) => {
    if (order.status === "cancelada") {
      toast.error("Pedido cancelado não pode ser marcado como retirado.");
      return;
    }
    setUpdatingId(order.id);
    try {
      await updateEventStoreOrderFulfillment({
        orderId: order.id,
        fulfillmentStatus: status,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin_event_store_orders", eventId],
      });
      toast.success(eventStoreFulfillmentLabel(status));
    } catch (e: any) {
      toast.error(
        mapEventStoreAdminOrderError(e ?? {}) ||
          e?.message ||
          "Não foi possível atualizar a retirada.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="font-display text-base font-semibold text-foreground">
            Pedidos e separação
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Separação, variantes e retirada. Status de pagamento aparece como
            informação — a rotina principal de aprovar PIX fica em Inscrições →
            Pagamentos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            Atualizar
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={exporting || isLoading}
            onClick={() => void onExport()}
          >
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Pedidos confirmados" value={String(kpis.confirmedOrders)} />
        <Kpi label="Pedidos pendentes" value={String(kpis.pendingOrders)} />
        <Kpi
          label="Em atraso"
          value={String(kpis.overdueOrders)}
          emphasize={kpis.overdueOrders > 0}
        />
        <Kpi label="Unidades confirmadas" value={String(kpis.confirmedUnits)} />
        <Kpi
          label="Receita produtos (conf.)"
          value={brl(kpis.confirmedRevenue)}
        />
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">
          Separação para o dia da prova
        </h4>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : separation.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item pendente ou confirmado para separar ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium text-right">Confirmados</th>
                  <th className="px-3 py-2 font-medium text-right">Pendentes</th>
                </tr>
              </thead>
              <tbody>
                {separation.map((row) => (
                  <tr
                    key={`${row.product}||${row.variant}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2.5 font-medium">{row.product}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.variant}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.confirmed}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.pending}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">
            Pedidos detalhados
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "Todos"],
                ["signup_bundle", "Inscrição"],
                ["standalone", "Compra avulsa"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOriginFilter(value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  originFilter === value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : flatRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido da loja nesta prova ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Comprador</th>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium text-right">Qtd</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Retirada</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-border/40 last:border-0 align-top"
                  >
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {r.origin}
                    </td>
                    <td className="px-3 py-2.5 font-medium max-w-[10rem] truncate">
                      {r.buyer}
                    </td>
                    <td className="px-3 py-2.5">{r.product}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.variant}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {brl(r.lineTotal)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1.5 min-w-[9rem]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            r.op.badgeClassName,
                          )}
                        >
                          {r.op.overdue ? (
                            <Clock className="w-3 h-3 shrink-0" />
                          ) : null}
                          {r.op.label}
                        </span>
                        {r.op.overdueHint ? (
                          <p className="text-[10px] leading-snug text-amber-800/90 dark:text-amber-300/90 max-w-[12rem]">
                            {r.op.overdueHint}
                          </p>
                        ) : null}
                        {r.showManagePaymentLink ? (
                          <Link
                            to={r.managePaymentHref}
                            className="inline-block pt-0.5 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Gerenciar pagamento
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1.5 min-w-[9rem]">
                        <p className="text-xs text-foreground/90">
                          {r.fulfillmentLabel}
                        </p>
                        {r.canMarkFulfillment ? (
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={updatingId === r.orderId}
                              onClick={() =>
                                void setFulfillment(r.order, "retirado")
                              }
                            >
                              Marcar como retirado
                            </Button>
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground underline-offset-2 hover:underline text-left"
                              disabled={updatingId === r.orderId}
                              onClick={() =>
                                void setFulfillment(r.order, "nao_retirado")
                              }
                            >
                              Marcar como não retirado
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {r.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 px-3 py-2.5",
        emphasize ? "border-amber-500/40" : "border-border/60",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function flattenOrderRows(orders: EventStoreOrderRow[], eventId: string) {
  const rows: {
    key: string;
    orderId: string;
    order: EventStoreOrderRow;
    origin: string;
    buyer: string;
    product: string;
    variant: string;
    quantity: number;
    lineTotal: number;
    op: ReturnType<typeof getSignupStatusInfo>;
    fulfillmentLabel: string;
    canMarkFulfillment: boolean;
    showManagePaymentLink: boolean;
    managePaymentHref: string;
    date: string;
  }[] = [];

  for (const order of orders) {
    const buyer = eventStoreOrderBuyerName(order);
    const op = getSignupStatusInfo({
      status: order.status || order.event_signups?.status,
    });
    const canMarkFulfillment = order.status === "confirmada";
    const pendingPayment =
      order.status === "pendente" || order.status === "pagamento_atrasado";
    const showManagePaymentLink = pendingPayment;
    const params = new URLSearchParams({ tab: "pagamentos", event: eventId });
    if (order.status === "pagamento_atrasado") {
      params.set("status", "pagamento_atrasado");
    } else if (order.status === "pendente") {
      params.set("status", "pendente");
    }
    if (buyer && buyer !== "—") params.set("q", buyer);
    const managePaymentHref = `/admin/event-signups?${params.toString()}`;

    const items = order.event_store_order_items ?? [];
    items.forEach((item, idx) => {
      rows.push({
        key: item.id,
        orderId: order.id,
        order,
        origin: eventStoreOrderOriginLabel(order.order_type),
        buyer,
        product: item.product_name_snapshot || "Produto",
        variant: item.variant_name_snapshot?.trim() || "Padrão",
        quantity: item.quantity,
        lineTotal: Number(item.line_total) || 0,
        op,
        fulfillmentLabel: eventStoreFulfillmentLabel(order.fulfillment_status),
        canMarkFulfillment: canMarkFulfillment && idx === 0,
        showManagePaymentLink: showManagePaymentLink && idx === 0,
        managePaymentHref,
        date: formatDateTime(order.created_at),
      });
    });
  }
  return rows;
}
