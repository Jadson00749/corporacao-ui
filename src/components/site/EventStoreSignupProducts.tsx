import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventStoreProductCarousel } from "@/components/site/EventStoreProductCarousel";
import {
  eventStoreCartProductsAmount,
  eventStoreCartToAcquiredItems,
  eventStoreMaxQty,
  eventStoreSaleStatus,
  eventStoreScarcityLabel,
  eventStoreVariantRemaining,
  eventStoreVariantStockLabel,
  formatEventStoreDateBR,
  useEventStoreSignupCatalog,
  type EventStoreCartLine,
  type EventStoreCatalogProduct,
} from "@/lib/eventStore";
import { StoreAcquiredOrderPanel } from "@/components/store-mock/StoreAcquiredProducts";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const buyUntilShort = (iso: string | null | undefined) => {
  const full = formatEventStoreDateBR(iso);
  return full ? full.slice(0, 5) : "";
};

type Props = {
  eventId: string;
  cart: EventStoreCartLine[];
  onCartChange: (cart: EventStoreCartLine[]) => void;
  /**
   * signup = inscrição (header + grid 2 cols).
   * standalone = produtos da prova (header externo + cards compactos).
   */
  mode?: "signup" | "standalone";
};

export function EventStoreSignupProducts({
  eventId,
  cart,
  onCartChange,
  mode = "signup",
}: Props) {
  const compact = mode === "standalone";
  const { data: catalog = [], isLoading } = useEventStoreSignupCatalog(eventId);
  const [sizePick, setSizePick] = useState<EventStoreCatalogProduct | null>(
    null,
  );
  const [pickedSize, setPickedSize] = useState<string | null>(null);

  const lineFor = (productId: string, variantId: string) =>
    cart.find((l) => l.productId === productId && l.variantId === variantId);

  const canPurchase = (product: EventStoreCatalogProduct) => {
    if (eventStoreSaleStatus(product.sale_starts_at, product.sale_ends_at) !== "open") {
      return false;
    }
    return product.variants.some((v) => {
      if (!v.active) return false;
      const rem = eventStoreVariantRemaining(v);
      return rem == null || rem > 0;
    });
  };

  const addVariant = (
    product: EventStoreCatalogProduct,
    variantId: string,
  ) => {
    if (!canPurchase(product)) return;
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) return;
    const max = eventStoreMaxQty(v);
    if (max < 1) return;
    const existing = lineFor(product.id, variantId);
    if (existing) {
      if (existing.quantity >= max) return;
      onCartChange(
        cart.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      onCartChange([
        ...cart,
        { productId: product.id, variantId, quantity: 1 },
      ]);
    }
  };

  const addSimple = (product: EventStoreCatalogProduct) => {
    const v = product.variants[0];
    if (!v) return;
    addVariant(product, v.id);
  };

  const openVariants = (product: EventStoreCatalogProduct) => {
    if (!canPurchase(product)) return;
    setSizePick(product);
    setPickedSize(null);
  };

  const confirmVariant = () => {
    if (!sizePick || !pickedSize) return;
    addVariant(sizePick, pickedSize);
    setSizePick(null);
    setPickedSize(null);
  };

  const setQty = (line: EventStoreCartLine, qty: number) => {
    const product = catalog.find((p) => p.id === line.productId);
    const v = product?.variants.find((x) => x.id === line.variantId);
    const max = eventStoreMaxQty(v);
    const next = Math.max(0, Math.min(qty, max));
    if (next === 0) {
      onCartChange(cart.filter((l) => l !== line));
      return;
    }
    onCartChange(
      cart.map((l) => (l === line ? { ...l, quantity: next } : l)),
    );
  };

  const productsAmount = eventStoreCartProductsAmount(catalog, cart);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
        Carregando produtos da prova…
      </div>
    );
  }

  if (catalog.length === 0) return null;

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
            Produtos da prova · opcional
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            Adicione produtos ao seu carrinho
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Itens opcionais da prova para retirar junto com o kit antes da prova.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-3",
          compact
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 sm:justify-items-start"
            : "sm:grid-cols-2",
        )}
      >
        {catalog.map((p) => {
          const lines = cart.filter((l) => l.productId === p.id);
          const added = lines.length > 0;
          const primaryLine = lines[0];
          const sale = eventStoreSaleStatus(p.sale_starts_at, p.sale_ends_at);
          const buyUntil = buyUntilShort(p.sale_ends_at);
          const purchasable = canPurchase(p);

          const primaryVariant = primaryLine
            ? p.variants.find((v) => v.id === primaryLine.variantId)
            : null;

          /** Sem variações: escassez do único estoque. Com: após selecionar. */
          const cardScarcity = (() => {
            if (sale !== "open") return null;
            if (!p.has_variants) {
              const v = p.variants[0];
              if (!v) return null;
              return eventStoreScarcityLabel(
                v.available_quantity,
                v.unlimited,
              );
            }
            if (!primaryVariant) return null;
            const label = eventStoreScarcityLabel(
              primaryVariant.available_quantity,
              primaryVariant.unlimited,
            );
            if (!label) return null;
            return `Tamanho ${primaryVariant.name} — ${label.toLowerCase()}`;
          })();

          const scarcityHot =
            primaryVariant != null
              ? (eventStoreVariantRemaining(primaryVariant) ?? 99) <= 3
              : !p.has_variants &&
                (eventStoreVariantRemaining(p.variants[0]) ?? 99) <= 3;

          return (
            <div
              key={p.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-border/50 bg-card/30",
                compact && "w-full sm:max-w-[320px]",
                !purchasable && !added && "opacity-80",
              )}
            >
              <div className={cn(compact && "max-w-full")}>
                <EventStoreProductCarousel
                  urls={
                    p.image_urls?.length
                      ? p.image_urls
                      : p.image_url
                        ? [p.image_url]
                        : []
                  }
                  alt={p.name}
                  className={
                    compact
                      ? "!aspect-[4/3] max-h-[200px] sm:max-h-none sm:!aspect-square"
                      : undefined
                  }
                />
              </div>
              <div className={cn("space-y-2", compact ? "p-3" : "p-3.5 space-y-2.5")}>
                <div>
                  <p
                    className={cn(
                      "font-medium leading-snug",
                      compact ? "text-[13px]" : "text-sm",
                    )}
                  >
                    {p.name}
                  </p>
                  <p
                    className={cn(
                      "font-semibold text-brand",
                      compact ? "mt-0.5 text-base" : "mt-1 text-sm",
                    )}
                  >
                    {brl(
                      primaryVariant?.unit_price ??
                        p.variants[0]?.unit_price ??
                        0,
                    )}
                  </p>
                </div>

                <div className="space-y-0.5">
                  {sale === "ended" && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Vendas encerradas
                    </p>
                  )}
                  {sale === "upcoming" && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Disponível em breve
                      {p.sale_starts_at
                        ? ` · ${formatEventStoreDateBR(p.sale_starts_at)}`
                        : ""}
                    </p>
                  )}
                  {cardScarcity && (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        scarcityHot
                          ? "text-amber-400/90"
                          : "text-muted-foreground",
                      )}
                    >
                      {cardScarcity}
                    </p>
                  )}
                  {sale === "open" && buyUntil && (
                    <p className="text-[11px] text-muted-foreground">
                      Compre até {buyUntil}
                    </p>
                  )}
                </div>

                {!added ? (
                  purchasable ? (
                    <Button
                      type="button"
                      variant={compact ? "brand" : "outline"}
                      size="sm"
                      className="w-full min-h-10"
                      onClick={() =>
                        p.has_variants ? openVariants(p) : addSimple(p)
                      }
                    >
                      <Plus className="w-4 h-4" />{" "}
                      {compact ? "Adicionar ao pedido" : "Adicionar ao carrinho"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full min-h-10"
                      disabled
                    >
                      {sale === "ended"
                        ? "Vendas encerradas"
                        : sale === "upcoming"
                          ? "Disponível em breve"
                          : "Esgotado"}
                    </Button>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Check className="w-3.5 h-3.5" />{" "}
                      {compact ? "No pedido" : "No carrinho"}
                      {p.has_variants && primaryVariant
                        ? ` · ${primaryVariant.name}`
                        : ""}
                    </p>
                    {lines.map((line) => {
                      const v = p.variants.find((x) => x.id === line.variantId);
                      const max = eventStoreMaxQty(v);
                      return (
                        <div
                          key={`${line.productId}-${line.variantId}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="inline-flex items-center rounded-lg border border-border/60">
                            <button
                              type="button"
                              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() => setQty(line, line.quantity - 1)}
                              aria-label="Diminuir"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="min-w-7 text-center text-sm font-semibold tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={line.quantity >= max || !purchasable}
                              onClick={() => setQty(line, line.quantity + 1)}
                              aria-label="Aumentar"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setQty(line, 0)}
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                    {p.has_variants && purchasable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-0 text-xs"
                        onClick={() => openVariants(p)}
                      >
                        + Outro tamanho
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && !compact ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {brl(productsAmount)} em produtos no carrinho · prévia visual · retirada
          junto à entrega do kit, antes da prova.
        </p>
      ) : null}

      <Dialog open={!!sizePick} onOpenChange={(o) => !o && setSizePick(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escolha o tamanho</DialogTitle>
          </DialogHeader>
          {sizePick && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{sizePick.name}</p>
              <div className="space-y-2">
                {sizePick.variants.map((v) => {
                  const rem = eventStoreVariantRemaining(v);
                  const soldOut = rem != null && rem < 1;
                  const active = pickedSize === v.id;
                  const label = eventStoreVariantStockLabel(
                    v.available_quantity,
                    v.unlimited,
                  );
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => setPickedSize(v.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                        soldOut &&
                          "opacity-40 cursor-not-allowed border-border/40",
                        !soldOut &&
                          active &&
                          "border-brand bg-brand/15 text-brand",
                        !soldOut &&
                          !active &&
                          "border-border/60 hover:border-brand/40",
                      )}
                    >
                      <span className="font-semibold">{v.name}</span>
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          soldOut
                            ? "text-muted-foreground line-through"
                            : rem != null && rem <= 3
                              ? "text-amber-400/90"
                              : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="brand"
                className="w-full"
                disabled={!pickedSize}
                onClick={confirmVariant}
              >
                {compact ? "Adicionar ao pedido" : "Adicionar ao carrinho"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "Seu pedido" no pagamento — totais podem vir da RPC (autoridade) ou prévia. */
export function EventStoreCheckoutPreview({
  eventId,
  registrationAmount,
  productsAmount: productsAmountProp,
  totalAmount: totalAmountProp,
  modality,
  cart,
  isPartner,
  partnerName,
}: {
  eventId: string;
  registrationAmount: number;
  /** Quando definido (pós-RPC), substitui o cálculo do carrinho. */
  productsAmount?: number;
  totalAmount?: number;
  modality?: string | null;
  cart: EventStoreCartLine[];
  isPartner?: boolean;
  partnerName?: string | null;
}) {
  const { data: catalog = [] } = useEventStoreSignupCatalog(eventId);
  const items = useMemo(
    () => eventStoreCartToAcquiredItems(catalog, cart),
    [catalog, cart],
  );
  const cartProducts = eventStoreCartProductsAmount(catalog, cart);
  const productsAmount =
    productsAmountProp != null ? productsAmountProp : cartProducts;
  const visualTotal =
    totalAmountProp != null
      ? totalAmountProp
      : Math.round((Math.max(0, registrationAmount) + productsAmount) * 100) /
        100;

  if (cart.length === 0 || items.length === 0) return null;

  const inscLabel = modality?.trim()
    ? `Inscrição ${modality.trim()}`
    : "Inscrição";

  return (
    <StoreAcquiredOrderPanel
      variant="payment"
      items={items}
      summary={{
        registration_amount: Math.max(0, registrationAmount),
        products_amount: productsAmount,
        total_amount: visualTotal,
        registration_label: inscLabel,
      }}
      isPartner={isPartner}
      partnerName={partnerName}
    />
  );
}
