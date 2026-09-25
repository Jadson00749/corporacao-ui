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
import {
  STORE_MOCK_FULFILLMENT,
  formatStoreMockDateBR,
  formatStoreMockDateShort,
  initialStoreMockCatalog,
  storeMockAvailableStock,
  storeMockCartProductsAmount,
  storeMockCartToAcquiredItems,
  storeMockLineLabel,
  storeMockRawStock,
  storeMockSaleStatus,
  storeMockScarcityLabel,
  storeMockTotalUnits,
  storeMockVariantStockLabel,
  type StoreMockCartLine,
  type StoreMockProduct,
} from "@/data/storeMockCatalog";
import { StoreAcquiredOrderPanel } from "@/components/store-mock/StoreAcquiredProducts";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  cart: StoreMockCartLine[];
  onCartChange: (cart: StoreMockCartLine[]) => void;
};

export function StoreMockSignupProducts({ cart, onCartChange }: Props) {
  const catalog = useMemo(() => initialStoreMockCatalog().filter((p) => p.active), []);
  const [sizePick, setSizePick] = useState<StoreMockProduct | null>(null);
  const [pickedSize, setPickedSize] = useState<string | null>(null);

  const lineFor = (productId: string, variantId: string | null) =>
    cart.find(
      (l) =>
        l.productId === productId &&
        (l.variantId ?? null) === (variantId ?? null),
    );

  const canPurchase = (product: StoreMockProduct) =>
    storeMockSaleStatus(product) === "open" && storeMockTotalUnits(product) > 0;

  const addSimple = (product: StoreMockProduct) => {
    if (!canPurchase(product)) return;
    const stock = storeMockAvailableStock(product, null);
    if (stock < 1) return;
    const existing = lineFor(product.id, null);
    if (existing) {
      if (existing.quantity >= stock) return;
      onCartChange(
        cart.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      onCartChange([...cart, { productId: product.id, variantId: null, quantity: 1 }]);
    }
  };

  const openVariants = (product: StoreMockProduct) => {
    if (!canPurchase(product)) return;
    setSizePick(product);
    setPickedSize(null);
  };

  const confirmVariant = () => {
    if (!sizePick || !pickedSize) return;
    if (!canPurchase(sizePick)) return;
    const stock = storeMockAvailableStock(sizePick, pickedSize);
    if (stock < 1) return;
    const existing = lineFor(sizePick.id, pickedSize);
    if (existing) {
      if (existing.quantity >= stock) return;
      onCartChange(
        cart.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      onCartChange([
        ...cart,
        { productId: sizePick.id, variantId: pickedSize, quantity: 1 },
      ]);
    }
    setSizePick(null);
    setPickedSize(null);
  };

  const setQty = (line: StoreMockCartLine, qty: number) => {
    const product = catalog.find((p) => p.id === line.productId);
    if (!product) return;
    const max = storeMockAvailableStock(product, line.variantId);
    const next = Math.max(0, Math.min(qty, max));
    if (next === 0) {
      onCartChange(cart.filter((l) => l !== line));
      return;
    }
    onCartChange(
      cart.map((l) => (l === line ? { ...l, quantity: next } : l)),
    );
  };

  const productsAmount = storeMockCartProductsAmount(catalog, cart);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          Produtos da prova · opcional
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          Adicione produtos ao seu carrinho
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Itens opcionais da prova para retirar junto com o kit no dia do evento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((p) => {
          const lines = cart.filter((l) => l.productId === p.id);
          const added = lines.length > 0;
          const primaryLine = lines[0];
          const sale = storeMockSaleStatus(p);
          const units = storeMockTotalUnits(p);
          const buyUntil = formatStoreMockDateShort(p.sale_ends_at);
          const purchasable = canPurchase(p);
          /** Sem variantes: escassez do estoque único. Com variantes: só após escolher tamanho. */
          const cardScarcity = (() => {
            if (sale !== "open") return null;
            if (!p.has_variants) {
              return storeMockScarcityLabel(units);
            }
            if (!primaryLine?.variantId) return null;
            const stock = storeMockRawStock(p, primaryLine.variantId);
            const label = storeMockScarcityLabel(stock);
            if (!label) return null;
            const sizeName =
              p.variants.find((v) => v.id === primaryLine.variantId)?.name ??
              "";
            return sizeName ? `Tamanho ${sizeName} — ${label.toLowerCase()}` : label;
          })();
          const scarcityUnits = p.has_variants
            ? primaryLine?.variantId
              ? storeMockRawStock(p, primaryLine.variantId)
              : 0
            : units;

          return (
            <div
              key={p.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-border/50 bg-card/30",
                !purchasable && !added && "opacity-80",
              )}
            >
              <div
                className={cn(
                  "aspect-[16/10] w-full bg-gradient-to-br",
                  p.imageTone,
                )}
              />
              <div className="p-3.5 space-y-2.5">
                <div>
                  <p className="font-medium text-sm leading-snug">{p.name}</p>
                  <p className="mt-1 text-sm font-semibold text-brand">
                    {brl(p.price)}
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
                        ? ` · ${formatStoreMockDateBR(p.sale_starts_at)}`
                        : ""}
                    </p>
                  )}
                  {cardScarcity && (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        scarcityUnits <= 3
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
                      variant="outline"
                      size="sm"
                      className="w-full min-h-10"
                      onClick={() =>
                        p.has_variants ? openVariants(p) : addSimple(p)
                      }
                    >
                      <Plus className="w-4 h-4" /> Adicionar ao carrinho
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
                      <Check className="w-3.5 h-3.5" /> No carrinho
                      {p.has_variants && primaryLine?.variantId
                        ? ` · ${storeMockLineLabel(p, primaryLine.variantId).split("—")[1]?.trim() || ""}`
                        : ""}
                    </p>
                    {lines.map((line) => {
                      const max = storeMockAvailableStock(p, line.variantId);
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

      {cart.length > 0 && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {brl(productsAmount)} em produtos no carrinho · pagos junto com a inscrição ·{" "}
          {STORE_MOCK_FULFILLMENT}
        </p>
      )}

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
                  const stock = storeMockRawStock(sizePick, v.id);
                  const soldOut = stock < 1;
                  const active = pickedSize === v.id;
                  const label = storeMockVariantStockLabel(stock);
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
                            : stock <= 3
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
                Adicionar ao carrinho
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bloco de resumo / pagamento — só visual; não altera PixPayment.amount */
export function StoreMockCheckoutBreakdown({
  registrationAmount,
  modality,
  cart,
  isPartner,
  partnerName,
}: {
  registrationAmount: number;
  modality?: string | null;
  cart: StoreMockCartLine[];
  isPartner?: boolean;
  partnerName?: string | null;
}) {
  const catalog = useMemo(() => initialStoreMockCatalog(), []);
  const items = useMemo(
    () => storeMockCartToAcquiredItems(catalog, cart),
    [catalog, cart],
  );
  const productsAmount = storeMockCartProductsAmount(catalog, cart);
  const visualTotal =
    Math.round((Math.max(0, registrationAmount) + productsAmount) * 100) / 100;

  if (cart.length === 0) return null;

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
      showMockPixHint
    />
  );
}

export function useStoreMockSummaryLines(cart: StoreMockCartLine[]) {
  const catalog = useMemo(() => initialStoreMockCatalog(), []);
  return useMemo(() => {
    return cart.map((line) => {
      const p = catalog.find((x) => x.id === line.productId)!;
      return {
        label: storeMockLineLabel(p, line.variantId),
        qty: line.quantity,
        amount: Math.round(p.price * line.quantity * 100) / 100,
      };
    });
  }, [cart, catalog]);
}

export function storeMockProductsTotal(cart: StoreMockCartLine[]) {
  return storeMockCartProductsAmount(initialStoreMockCatalog(), cart);
}
