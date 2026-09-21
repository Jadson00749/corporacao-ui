import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { PixPayment } from "@/components/site/PixPayment";
import { StoreAcquiredOrderPanel } from "@/components/store-mock/StoreAcquiredProducts";
import {
  resolveAthletePaymentView,
  useEventPayment,
} from "@/lib/eventPayment";
import {
  createEventStoreStandaloneOrder,
  eventStoreCartProductsAmount,
  eventStoreCartToAcquiredItems,
  eventStorePaymentStatusLabel,
  mapEventStoreCheckoutError,
  orderItemsToAcquired,
  useEventStoreSignupCatalog,
  type EventStoreCartLine,
  type MyEventStoreOrderRow,
} from "@/lib/eventStore";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Step = "review" | "identify" | "pay" | "done";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventCity?: string | null;
  eventOrganizerId?: string | null;
  eventPixKey?: string | null;
  eventPixRecipient?: string | null;
  eventPaymentInstructions?: string | null;
  siteWhatsapp?: string | null;
  partnerName?: string | null;
  cart: EventStoreCartLine[];
  onCartCleared: () => void;
  /** Reabre pagamento de um pedido já criado. */
  existingOrder?: MyEventStoreOrderRow | null;
  /** Pedido pendente/atrasado da mesma prova (aviso se estiver abrindo novo carrinho). */
  awaitingPaymentOrder?: MyEventStoreOrderRow | null;
  onOpenExistingOrder?: (order: MyEventStoreOrderRow) => void;
  initialStep?: Step;
};

export function EventStoreStandaloneCheckout({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventCity,
  eventOrganizerId,
  eventPixKey,
  eventPixRecipient,
  eventPaymentInstructions,
  siteWhatsapp,
  partnerName,
  cart,
  onCartCleared,
  existingOrder = null,
  awaitingPaymentOrder = null,
  onOpenExistingOrder,
  initialStep,
}: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: catalog = [] } = useEventStoreSignupCatalog(eventId);
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("review");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [pickupAccepted, setPickupAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [paidProducts, setPaidProducts] = useState<number | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<
    ReturnType<typeof eventStoreCartToAcquiredItems>
  >([]);
  const [paymentStatus, setPaymentStatus] = useState<string>("pendente");
  const [continueDespitePending, setContinueDespitePending] = useState(false);

  const authRedirect = `/auth?redirect=${encodeURIComponent(
    `/provas/${eventId}?checkout=store#produtos-prova`,
  )}`;

  useEffect(() => {
    if (!open) return;
    setPickupAccepted(false);
    setSubmitting(false);

    if (existingOrder) {
      setOrderId(existingOrder.id);
      setPaidTotal(Number(existingOrder.total_amount) || 0);
      setPaidProducts(Number(existingOrder.products_amount) || 0);
      setConfirmedItems(orderItemsToAcquired(existingOrder));
      setPaymentStatus(existingOrder.status || "pendente");
      setBuyerName(existingOrder.buyer_name_snapshot || "");
      setBuyerEmail(existingOrder.buyer_email_snapshot || "");
      setBuyerPhone(existingOrder.buyer_phone_snapshot || "");
      const pay =
        existingOrder.status === "pendente" ||
        existingOrder.status === "pagamento_atrasado";
      setStep(
        initialStep ??
          (pay ? "pay" : "done"),
      );
      return;
    }

    setStep(initialStep ?? "review");
    setOrderId(null);
    setPaidTotal(null);
    setPaidProducts(null);
    setConfirmedItems([]);
    setPaymentStatus("pendente");
    setContinueDespitePending(false);
  }, [open, existingOrder, initialStep]);

  useEffect(() => {
    if (!open || existingOrder) return;
    setBuyerName(
      (profile?.full_name || user?.user_metadata?.full_name || "").trim(),
    );
    setBuyerEmail((profile?.email || user?.email || "").trim());
    setBuyerPhone((profile?.whatsapp || profile?.phone || "").trim());
  }, [open, profile, user, existingOrder]);

  const items = useMemo(
    () => eventStoreCartToAcquiredItems(catalog, cart),
    [catalog, cart],
  );
  const previewTotal = eventStoreCartProductsAmount(catalog, cart);

  const {
    data: eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
  } = useEventPayment(open ? eventId : null);

  const payView = resolveAthletePaymentView({
    eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
    eventOrganizerId,
    eventPixKey,
    eventPixRecipient,
    eventPaymentInstructions,
    siteWhatsapp,
  });

  const displayTotal = paidTotal ?? previewTotal;
  const displayProducts = paidProducts ?? previewTotal;
  const displayItems =
    confirmedItems.length > 0 ? confirmedItems : items;

  const goIdentify = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }
    if (!user) {
      toast.message("Faça login para finalizar a compra.");
      window.location.assign(authRedirect);
      return;
    }
    setStep("identify");
  };

  const submitOrder = async () => {
    if (!user) {
      window.location.assign(authRedirect);
      return;
    }
    if (!pickupAccepted) {
      toast.error("Aceite as condições de retirada para continuar.");
      return;
    }
    if (!buyerName.trim() || !buyerEmail.trim() || !buyerPhone.trim()) {
      toast.error("Preencha nome, WhatsApp e e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEventStoreStandaloneOrder({
        eventId,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        buyerPhone: buyerPhone.trim(),
        pickupTermsAcceptedAt: new Date().toISOString(),
        storeItems: cart.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
        })),
      });
      setOrderId(result.order_id);
      setPaidTotal(result.total_amount);
      setPaidProducts(result.products_amount);
      setConfirmedItems(eventStoreCartToAcquiredItems(catalog, cart));
      setPaymentStatus(result.status || "pendente");
      onCartCleared();
      await qc.invalidateQueries({ queryKey: ["my_event_store_orders"] });
      setStep(result.total_amount > 0 ? "pay" : "done");
      toast.success("Pedido criado com sucesso.");
    } catch (e: any) {
      const friendly = mapEventStoreCheckoutError(e ?? {});
      toast.error(friendly || e?.message || "Não foi possível criar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === "pay" || step === "done"
      ? orderId
        ? "Pedido criado"
        : "Seu pedido"
      : step === "identify"
        ? "Seus dados para retirada"
        : "Seu pedido";

  const showPix =
    step === "pay" &&
    displayTotal > 0 &&
    (paymentStatus === "pendente" || paymentStatus === "pagamento_atrasado");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {step === "identify" ? (
            <DialogDescription>
              Usaremos essas informações para identificar seu pedido no dia da
              entrega dos kits.
            </DialogDescription>
          ) : step === "pay" || step === "done" ? (
            <DialogDescription>
              {showPix
                ? "Agora é só realizar o pagamento via PIX."
                : paymentStatus === "confirmada"
                  ? "Pagamento confirmado. Retire na entrega dos kits."
                  : "Acompanhe o status do seu pedido."}
            </DialogDescription>
          ) : (
            <DialogDescription>
              Confira os itens e finalize quando estiver pronto.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "review" && (
          <div className="space-y-4">
            {!existingOrder &&
            awaitingPaymentOrder &&
            !continueDespitePending ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/5 px-3.5 py-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Você já possui um pedido aguardando pagamento nesta prova.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Pode pagar o pedido existente ou continuar e criar uma nova
                    compra (outro pedido).
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="brand"
                    className="flex-1 min-h-10"
                    onClick={() =>
                      onOpenExistingOrder?.(awaitingPaymentOrder)
                    }
                  >
                    Ver pedido existente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 min-h-10"
                    onClick={() => setContinueDespitePending(true)}
                  >
                    Continuar com nova compra
                  </Button>
                </div>
              </div>
            ) : null}

            {items.length > 0 ? (
              <StoreAcquiredOrderPanel
                variant="payment"
                standalone
                items={items}
                summary={{
                  registration_amount: 0,
                  products_amount: previewTotal,
                  total_amount: previewTotal,
                  registration_label: "",
                }}
                isPartner={!!partnerName}
                partnerName={partnerName}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum item no pedido.
              </p>
            )}
            {!user ? (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-sm text-foreground">
                  Para finalizar, faça login ou cadastre-se. Seu pedido será
                  mantido nesta sessão.
                </p>
                <Button asChild variant="brand" className="w-full">
                  <Link to={authRedirect}>Entrar para continuar</Link>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="brand"
                className="w-full min-h-11"
                disabled={
                  cart.length === 0 ||
                  (!!awaitingPaymentOrder &&
                    !existingOrder &&
                    !continueDespitePending)
                }
                onClick={goIdentify}
              >
                Finalizar compra
              </Button>
            )}
          </div>
        )}

        {step === "identify" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="standalone-buyer-name">Nome</Label>
              <Input
                id="standalone-buyer-name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standalone-buyer-phone">WhatsApp</Label>
              <Input
                id="standalone-buyer-phone"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standalone-buyer-email">E-mail</Label>
              <Input
                id="standalone-buyer-email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={pickupAccepted}
                  onCheckedChange={(v) => setPickupAccepted(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug text-foreground">
                  Estou ciente de que os produtos devem ser retirados no período
                  e local de entrega dos kits da prova.
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                Não há envio pela plataforma. Produtos não retirados dentro do
                período informado ficam sujeitos às regras do evento.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-11"
                onClick={() => setStep("review")}
                disabled={submitting}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="brand"
                className="flex-1 min-h-11"
                disabled={submitting || !pickupAccepted}
                onClick={() => void submitOrder()}
              >
                {submitting
                  ? "Criando…"
                  : displayTotal > 0
                    ? "Gerar PIX"
                    : "Confirmar pedido"}
              </Button>
            </div>
          </div>
        )}

        {(step === "pay" || step === "done") && (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border px-3.5 py-3 flex items-start gap-2.5",
                paymentStatus === "confirmada"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : paymentStatus === "cancelada"
                    ? "border-border/60 bg-muted/30"
                    : "border-brand/25 bg-brand/[0.04]",
              )}
            >
              <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {paymentStatus === "confirmada"
                    ? "Pagamento confirmado"
                    : paymentStatus === "cancelada"
                      ? "Pedido cancelado"
                      : "Pedido criado com sucesso"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {eventName}
                  {" · "}
                  {eventStorePaymentStatusLabel(paymentStatus)}
                </p>
              </div>
            </div>

            {displayItems.length > 0 ? (
              <StoreAcquiredOrderPanel
                variant="payment"
                standalone
                items={displayItems}
                summary={{
                  registration_amount: 0,
                  products_amount: displayProducts,
                  total_amount: displayTotal,
                  registration_label: "",
                }}
                isPartner={payView.is_partner}
                partnerName={payView.organizer_name || partnerName}
              />
            ) : null}

            <p className="text-xs text-muted-foreground">
              Retirada durante a entrega dos kits da prova.
            </p>

            {showPix ? (
              payView.unavailable ? (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  Dados de pagamento indisponíveis no momento. Tente novamente
                  em instantes.
                </p>
              ) : payView.loading ? (
                <p className="text-sm text-muted-foreground">Carregando PIX…</p>
              ) : (
                <PixPayment
                  pixKey={payView.pix_key}
                  recipient={payView.pix_recipient}
                  city={eventCity}
                  amount={displayTotal}
                  txid={`LOJA${String(orderId || eventId).replace(/\D/g, "").slice(0, 10)}`}
                  instructions={payView.payment_instructions}
                  summary={{
                    eventName,
                    participant: buyerName,
                    modality: "Produtos da prova",
                    organizerName:
                      payView.organizer_name || payView.pix_recipient,
                    isPartner: payView.is_partner,
                  }}
                />
              )
            ) : null}

            <div className="flex flex-col gap-2">
              <Button asChild variant="brand" className="w-full min-h-11">
                <Link to="/minha-conta?tab=compras">Ir para Minha Conta</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-11"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
