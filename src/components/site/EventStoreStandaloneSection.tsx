import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { EventStoreSignupProducts } from "@/components/site/EventStoreSignupProducts";
import { EventStoreStandaloneCheckout } from "@/components/site/EventStoreStandaloneCheckout";
import { useAuth } from "@/contexts/AuthContext";
import {
  eventStoreCartProductsAmount,
  eventStoreFulfillmentLabel,
  eventStorePaymentStatusLabel,
  loadStandaloneStoreCart,
  orderItemsToAcquired,
  pickAwaitingPaymentStandaloneOrder,
  pickLatestStandaloneOrder,
  saveStandaloneStoreCart,
  useEventStoreSignupCatalog,
  useMyEventStoreOrders,
  type EventStoreCartLine,
  type MyEventStoreOrderRow,
} from "@/lib/eventStore";
import { isEventStorePublicEnabled } from "@/lib/eventStoreDev";
import { cn } from "@/lib/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  eventId: string;
  eventName: string;
  eventCity?: string | null;
  eventOrganizerId?: string | null;
  eventPixKey?: string | null;
  eventPixRecipient?: string | null;
  eventPaymentInstructions?: string | null;
  siteWhatsapp?: string | null;
  partnerName?: string | null;
  autoOpenCheckout?: boolean;
  /** CTA de inscrição (secundário no mobile quando o carrinho assume o rodapé). */
  signupHref?: string | null;
  signupInternal?: boolean;
};

/**
 * Seção pública "Produtos da prova" — mesmo catálogo da inscrição.
 * Só renderiza com isEventStorePublicEnabled() e produtos ativos.
 * Pedido confirmado NÃO bloqueia nova compra.
 */
export function EventStoreStandaloneSection({
  eventId,
  eventName,
  eventCity,
  eventOrganizerId,
  eventPixKey,
  eventPixRecipient,
  eventPaymentInstructions,
  siteWhatsapp,
  partnerName,
  autoOpenCheckout = false,
  signupHref,
  signupInternal = true,
}: Props) {
  const enabled = isEventStorePublicEnabled();
  const { user } = useAuth();
  const { data: catalog = [], isLoading } = useEventStoreSignupCatalog(eventId);
  const { data: myOrders = [], refetch: refetchMyOrders } = useMyEventStoreOrders({
    eventId,
    standaloneOnly: true,
    enabled: enabled && !!user,
  });

  const [cart, setCart] = useState<EventStoreCartLine[]>(() =>
    loadStandaloneStoreCart(eventId),
  );
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [focusOrder, setFocusOrder] = useState<MyEventStoreOrderRow | null>(
    null,
  );
  const [inProductsSection, setInProductsSection] = useState(false);

  const awaitingOrder = useMemo(
    () => pickAwaitingPaymentStandaloneOrder(myOrders),
    [myOrders],
  );
  const latestOrder = useMemo(
    () => pickLatestStandaloneOrder(myOrders),
    [myOrders],
  );
  const highlightOrder = awaitingOrder ?? latestOrder;
  const orderCount = myOrders.filter(
    (o) => o.order_type === "standalone" || !o.signup_id,
  ).length;

  useEffect(() => {
    setCart(loadStandaloneStoreCart(eventId));
  }, [eventId]);

  useEffect(() => {
    saveStandaloneStoreCart(eventId, cart);
  }, [eventId, cart]);

  useEffect(() => {
    if (!autoOpenCheckout) return;
    if (cart.length > 0) {
      setFocusOrder(null);
      setCheckoutOpen(true);
      return;
    }
    if (awaitingOrder) {
      setFocusOrder(awaitingOrder);
      setCheckoutOpen(true);
    }
  }, [autoOpenCheckout, cart.length, awaitingOrder]);

  /* Carrinho + seção Produtos visível → CTA contextual no rodapé (some Inscrever-se sticky) */
  useEffect(() => {
    if (cart.length === 0) {
      setInProductsSection(false);
      document.body.classList.remove("store-cart-priority");
      return;
    }
    const section = document.getElementById("produtos-prova");
    if (!section) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting;
        setInProductsSection(active);
        document.body.classList.toggle("store-cart-priority", active);
      },
      { rootMargin: "-12% 0px -35% 0px", threshold: [0, 0.05, 0.15] },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      document.body.classList.remove("store-cart-priority");
    };
  }, [cart.length]);

  if (!enabled) return null;
  if (!isLoading && catalog.length === 0) return null;

  const preview = eventStoreCartProductsAmount(catalog, cart);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartPriority = cart.length > 0 && inProductsSection;

  const openCartCheckout = () => {
    setFocusOrder(null);
    setCheckoutOpen(true);
  };

  const openExisting = (order: MyEventStoreOrderRow) => {
    setFocusOrder(order);
    setCheckoutOpen(true);
  };

  return (
    <div
      className={cn(
        "space-y-5",
        cartPriority
          ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-2"
          : "pb-2",
      )}
    >
      <div className="space-y-1">
        <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
          Produtos oficiais da prova
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
          Quer levar algo a mais do evento? Escolha seus produtos e retire na
          entrega dos kits.
        </p>
      </div>

      {highlightOrder ? (
        <ExistingOrderCard
          order={highlightOrder}
          awaitingPayment={!!awaitingOrder && highlightOrder.id === awaitingOrder.id}
          hasMultiple={orderCount > 1}
          onView={() => openExisting(highlightOrder)}
          onPay={() => openExisting(highlightOrder)}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando produtos…</p>
      ) : (
        <EventStoreSignupProducts
          eventId={eventId}
          cart={cart}
          onCartChange={setCart}
          mode="standalone"
        />
      )}

      {cart.length > 0 ? (
        <div
          className={cn(
            "prova-store-cart-bar z-40 border border-border/60 bg-background/95 backdrop-blur",
            "supports-[backdrop-filter]:bg-background/80 shadow-lg",
            cartPriority
              ? "fixed inset-x-0 bottom-0 rounded-none border-x-0 border-b-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:inset-auto lg:rounded-xl lg:border lg:px-3 lg:py-2.5 lg:pb-2.5"
              : "sticky rounded-xl px-3 py-2.5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-4",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {itemCount} {itemCount === 1 ? "item" : "itens"} · {brl(preview)}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Retirada na entrega dos kits
              </p>
            </div>
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="shrink-0 min-h-10 px-4"
              onClick={openCartCheckout}
            >
              Ver pedido
            </Button>
          </div>
          {cartPriority && signupHref ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground lg:hidden">
              {signupInternal ? (
                <Link
                  to={signupHref}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Inscrever-se na prova
                </Link>
              ) : (
                <a
                  href={signupHref}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Inscrever-se na prova
                </a>
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      <EventStoreStandaloneCheckout
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) {
            setFocusOrder(null);
            void refetchMyOrders();
          }
        }}
        eventId={eventId}
        eventName={eventName}
        eventCity={eventCity}
        eventOrganizerId={eventOrganizerId}
        eventPixKey={eventPixKey}
        eventPixRecipient={eventPixRecipient}
        eventPaymentInstructions={eventPaymentInstructions}
        siteWhatsapp={siteWhatsapp}
        partnerName={partnerName}
        cart={cart}
        onCartCleared={() => setCart([])}
        existingOrder={focusOrder}
        awaitingPaymentOrder={
          focusOrder ? null : awaitingOrder
        }
        onOpenExistingOrder={(order) => {
          setFocusOrder(order);
        }}
      />
    </div>
  );
}

function ExistingOrderCard({
  order,
  awaitingPayment,
  hasMultiple,
  onView,
  onPay,
}: {
  order: MyEventStoreOrderRow;
  awaitingPayment: boolean;
  hasMultiple: boolean;
  onView: () => void;
  onPay: () => void;
}) {
  const items = orderItemsToAcquired(order);
  const needsPay =
    order.status === "pendente" || order.status === "pagamento_atrasado";
  const first = items[0];

  return (
    <div className="rounded-2xl border border-brand/25 bg-brand/[0.03] px-3.5 py-3.5 space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          {awaitingPayment ? "Pagamento pendente" : "Seu último pedido"}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {awaitingPayment
            ? "Você possui um pedido aguardando pagamento."
            : "Você já comprou produtos nesta prova."}
        </p>
        {!awaitingPayment ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pode comprar de novo a qualquer momento — cada compra gera um pedido
            novo.
          </p>
        ) : null}
      </div>

      {first ? (
        <div className="flex items-center gap-3">
          {first.image ? (
            <img
              src={first.image}
              alt=""
              className="w-12 h-12 rounded-lg object-cover border border-border/50 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{first.name}</p>
            <p className="text-xs text-muted-foreground">
              {items.reduce((s, i) => s + i.quantity, 0)}{" "}
              {items.reduce((s, i) => s + i.quantity, 0) === 1
                ? "unidade"
                : "unidades"}
              {items.length > 1 ? ` · ${items.length} itens` : ""}
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums shrink-0">
            {brl(Number(order.total_amount) || 0)}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Status:{" "}
          <span className="font-medium text-foreground">
            {eventStorePaymentStatusLabel(order.status)}
          </span>
        </span>
        {order.status === "confirmada" ? (
          <span>
            Retirada:{" "}
            <span className="font-medium text-foreground">
              {eventStoreFulfillmentLabel(order.fulfillment_status)}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={onView}
        >
          Ver pedido
        </Button>
        {needsPay ? (
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="min-h-9"
            onClick={onPay}
          >
            {order.status === "pagamento_atrasado"
              ? "Ver pagamento"
              : "Pagar agora"}
          </Button>
        ) : null}
        {hasMultiple || order.status === "confirmada" ? (
          <Button asChild variant="ghost" size="sm" className="min-h-9 px-2">
            <Link to="/minha-conta?tab=compras">Ver minhas compras</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Hook para decidir se a aba "Produtos da prova" aparece. */
export function useShowEventStoreProductsTab(eventId: string | null | undefined) {
  const enabled = isEventStorePublicEnabled();
  const { data: catalog = [], isLoading } = useEventStoreSignupCatalog(
    enabled ? eventId : null,
  );
  return {
    show: enabled && !isLoading && catalog.length > 0,
    isLoading: enabled && isLoading,
  };
}
