import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  eventStoreFulfillmentLabel,
  eventStorePaymentStatusLabel,
  orderItemsToAcquired,
  useMyEventStoreOrders,
  type MyEventStoreOrderRow,
} from "@/lib/eventStore";
import { isEventStorePublicEnabled } from "@/lib/eventStoreDev";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Minha Conta — Compras da prova (standalone).
 * Visível com feature flag DEV ou quando o usuário já tem pedidos.
 */
export function AccountEventStoreOrders() {
  const { user } = useAuth();
  const flagOn = isEventStorePublicEnabled();
  const { data: orders = [], isLoading } = useMyEventStoreOrders({
    standaloneOnly: true,
    enabled: !!user,
  });

  const standalone = useMemo(
    () => orders.filter((o) => o.order_type === "standalone" || !o.signup_id),
    [orders],
  );

  const [detail, setDetail] = useState<MyEventStoreOrderRow | null>(null);

  if (!user) return null;
  if (!flagOn && standalone.length === 0 && !isLoading) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Compras da prova</h2>
        <p className="text-sm text-muted-foreground">
          Produtos comprados avulsamente — separados das suas inscrições.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando compras…</p>
      ) : standalone.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-sm text-muted-foreground">
            Você ainda não tem compras de produtos da prova.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {standalone.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={() => setDetail(order)}
            />
          ))}
        </div>
      )}

      <OrderDetailDialog
        order={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
    </div>
  );
}

function OrderCard({
  order,
  onOpen,
}: {
  order: MyEventStoreOrderRow;
  onOpen: () => void;
}) {
  const items = orderItemsToAcquired(order);
  const first = items[0];
  const needsPay =
    order.status === "pendente" || order.status === "pagamento_atrasado";
  const eventName = order.events?.name || "Prova";
  const eventDate = order.events?.date;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3.5 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm sm:text-base truncate">
            {eventName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(eventDate)} · Pedido {fmtDate(order.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            order.status === "confirmada"
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : order.status === "cancelada"
                ? "border-border text-muted-foreground"
                : order.status === "pagamento_atrasado"
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "border-brand/40 text-brand",
          )}
        >
          {eventStorePaymentStatusLabel(order.status)}
        </span>
      </div>

      {first ? (
        <div className="flex items-center gap-3">
          {first.image ? (
            <img
              src={first.image}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-border/50 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-muted shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{first.name}</p>
            <p className="text-xs text-muted-foreground">
              {first.variant_name ? `${first.variant_name} · ` : ""}
              Qtd. {first.quantity}
              {items.length > 1 ? ` · +${items.length - 1}` : ""}
            </p>
            <p className="text-sm font-semibold text-brand tabular-nums mt-0.5">
              {brl(Number(order.total_amount) || 0)}
            </p>
          </div>
        </div>
      ) : null}

      {order.status === "confirmada" ? (
        <p className="text-xs text-muted-foreground">
          Retirada:{" "}
          <span className="font-medium text-foreground/90">
            {eventStoreFulfillmentLabel(order.fulfillment_status)}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={onOpen}
        >
          {needsPay ? "Ver pedido" : "Ver detalhes"}
        </Button>
        {needsPay && order.event_id ? (
          <Button asChild variant="brand" size="sm" className="min-h-9">
            <Link to={`/provas/${order.event_id}?checkout=store#produtos-prova`}>
              {order.status === "pagamento_atrasado"
                ? "Ver pagamento"
                : "Pagar agora"}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: MyEventStoreOrderRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!order) return null;
  const items = orderItemsToAcquired(order);
  const eventName = order.events?.name || "Prova";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pedido da prova</DialogTitle>
          <DialogDescription>{eventName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover border border-border/50 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  {item.variant_name ? (
                    <p className="text-xs text-muted-foreground">
                      {item.variant_name}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Qtd. {item.quantity} · {brl(item.unit_price)} un.
                  </p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {brl(item.line_total)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-border/60 px-3 py-2.5 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3 font-semibold">
              <span>Total</span>
              <span className="text-brand tabular-nums">
                {brl(Number(order.total_amount) || 0)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Pagamento</span>
              <span className="text-foreground/90">
                {eventStorePaymentStatusLabel(order.status)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Retirada</span>
              <span className="text-foreground/90">
                {eventStoreFulfillmentLabel(order.fulfillment_status)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Data do pedido</span>
              <span className="text-foreground/90">
                {fmtDate(order.created_at)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Retirada durante a entrega dos kits da prova. Não há envio pela
            plataforma.
          </p>

          {(order.status === "pendente" ||
            order.status === "pagamento_atrasado") &&
          order.event_id ? (
            <Button asChild variant="brand" className="w-full min-h-11">
              <Link
                to={`/provas/${order.event_id}?checkout=store#produtos-prova`}
              >
                {order.status === "pagamento_atrasado"
                  ? "Ver pagamento"
                  : "Pagar agora"}
              </Link>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
