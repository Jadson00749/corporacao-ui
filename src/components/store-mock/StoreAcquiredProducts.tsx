import { cn } from "@/lib/utils";
import type { StoreAcquiredItem, StoreOrderSummary } from "@/components/store-mock/storeAcquiredTypes";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const STORE_ACQUIRED_FULFILLMENT_DEFAULT =
  "junto à entrega do kit, antes da prova";

type ListProps = {
  items: StoreAcquiredItem[];
  /** Título da seção — ex.: "Produtos adquiridos" | omitir se pai já tem "Seu pedido" */
  title?: string | null;
  className?: string;
  /** Mostra a linha de retirada em cada item (default true). */
  showPerItemFulfillment?: boolean;
};

/**
 * Lista visual reutilizável: thumbnail + nome + variação + qty + valor + retirada.
 * Retorna null se items vazio.
 */
export function StoreAcquiredProductsList({
  items,
  title = "Produtos adquiridos",
  className,
  showPerItemFulfillment = true,
}: ListProps) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {title ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          {title}
        </p>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => {
          const fulfillment =
            item.fulfillment_note?.trim() ||
            STORE_ACQUIRED_FULFILLMENT_DEFAULT;
          const metaParts = [
            item.variant_name?.trim()
              ? item.variant_name.trim().toLowerCase().startsWith("tamanho")
                ? item.variant_name.trim()
                : `Tamanho ${item.variant_name.trim()}`
              : null,
            `${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"}`,
            brl(item.line_total),
          ].filter(Boolean);

          return (
            <li key={item.id} className="flex gap-3 min-w-0">
              <div
                className={cn(
                  "h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl border border-border/40 overflow-hidden bg-gradient-to-br",
                  item.imageTone || "from-zinc-800 to-zinc-950",
                )}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {metaParts.join(" · ")}
                </p>
                {showPerItemFulfillment && (
                  <p className="text-[11px] text-muted-foreground/90 leading-snug">
                    Retirada: {fulfillment}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type FinancialProps = {
  summary: StoreOrderSummary;
  title?: string;
  className?: string;
};

export function StoreOrderFinancialSummary({
  summary,
  title = "Resumo financeiro",
  className,
}: FinancialProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {title ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground min-w-0">
            {summary.registration_label || "Inscrição"}
          </span>
          <span className="tabular-nums font-medium shrink-0">
            {brl(summary.registration_amount)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Produtos</span>
          <span className="tabular-nums font-medium shrink-0">
            {brl(summary.products_amount)}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t border-border/50 pt-2 font-semibold">
          <span>Total</span>
          <span className="text-brand tabular-nums shrink-0">
            {brl(summary.total_amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

type PanelProps = {
  items: StoreAcquiredItem[];
  summary: StoreOrderSummary;
  /** "payment" = Seu pedido + única transação; "account" = Produtos adquiridos + Resumo da compra */
  variant?: "payment" | "account";
  isPartner?: boolean;
  partnerName?: string | null;
  className?: string;
  /** Aviso discreto de que o PIX real ainda não inclui produtos (só payment). */
  showMockPixHint?: boolean;
};

/**
 * Painel completo reutilizado em pagamento (mock) e Minha Conta (mock).
 * Sem items → null.
 */
export function StoreAcquiredOrderPanel({
  items,
  summary,
  variant = "payment",
  isPartner,
  partnerName,
  className,
  showMockPixHint = false,
}: PanelProps) {
  if (!items.length) return null;

  const isPayment = variant === "payment";

  return (
    <div
      className={cn(
        "rounded-2xl border border-brand/20 bg-brand/[0.03] px-3.5 py-3.5 sm:px-4 sm:py-4 space-y-4",
        className,
      )}
    >
      {isPayment ? (
        <p className="font-display text-base font-semibold text-foreground">
          Seu pedido
        </p>
      ) : null}

      <StoreAcquiredProductsList
        items={items}
        title={isPayment ? null : "Produtos adquiridos"}
      />

      <div className="border-t border-border/50 pt-3">
        <StoreOrderFinancialSummary
          summary={summary}
          title={isPayment ? "Resumo financeiro" : "Resumo da compra"}
        />
      </div>

      <div className="space-y-1.5">
        {isPayment ? (
          <p className="text-xs text-foreground/90 leading-relaxed">
            Inscrição e produtos serão pagos em uma única transação.
            {isPartner && partnerName
              ? ` Pagamento destinado a ${partnerName}, organizador responsável pela prova.`
              : ""}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isPayment ? (
            <>
              <span className="font-medium text-foreground/80">Retirada dos produtos:</span>{" "}
              {STORE_ACQUIRED_FULFILLMENT_DEFAULT}.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground/80">Retirada:</span>{" "}
              {STORE_ACQUIRED_FULFILLMENT_DEFAULT.charAt(0).toUpperCase() +
                STORE_ACQUIRED_FULFILLMENT_DEFAULT.slice(1)}.
            </>
          )}
        </p>
        {showMockPixHint && (
          <p className="text-[11px] text-warning/90 leading-relaxed">
            Prévia visual — o PIX abaixo ainda usa só o valor da inscrição.
          </p>
        )}
      </div>
    </div>
  );
}
