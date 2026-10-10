import { useState, useEffect } from "react";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

type ProductInfo = { id: string; name: string; image?: string | null };

type ProductOrder = {
  id: string;
  value: number;
  status: string;
  payment_method: string | null;
  created_at: string;
  product_ids: string[];
  products: ProductInfo[];
};

export function AccountProductOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ProductOrder | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("product_orders")
        .select("id, value, status, payment_method, created_at, product_ids")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) { setLoading(false); return; }

      const allProductIds = [...new Set(data.flatMap((o: any) => o.product_ids as string[]))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, image")
        .in("id", allProductIds);

      const productMap = Object.fromEntries(
        (products || []).map((p: any) => [p.id, { id: p.id, name: p.name, image: p.image }])
      );

      setOrders(
        data.map((o: any) => ({
          ...o,
          products: (o.product_ids as string[]).map(
            (id: string) => productMap[id] ?? { id, name: "Produto", image: null }
          ),
        }))
      );
      setLoading(false);
    }
    load();
  }, [user]);

  if (!user) return null;

  const whatsappLink = useWhatsappLink();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Meus pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Produtos adquiridos na loja da Corporação.
          </p>
        </div>
        <a
          href={whatsappLink("Olá! Gostaria de tirar uma dúvida sobre meu pedido.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/20 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Falar com a assessoria
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando pedidos…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="text-sm text-muted-foreground">
            Você ainda não realizou nenhuma compra.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onOpen={() => setDetail(order)} />
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

function OrderCard({ order, onOpen }: { order: ProductOrder; onOpen: () => void }) {
  const first = order.products[0];
  const isPaid = order.status === "paid";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3.5 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm sm:text-base truncate">
            {order.products.length === 1
              ? first.name
              : `${first.name} +${order.products.length - 1}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedido {fmtDate(order.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            isPaid
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-brand/40 text-brand"
          )}
        >
          {isPaid ? "Pagamento confirmado" : "Aguardando pagamento"}
        </span>
      </div>

      {first && (
        <div className="flex items-center gap-3">
          {first.image ? (
            <img
              src={first.image}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-border/50 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-muted shrink-0 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-muted-foreground opacity-40" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{first.name}</p>
            <p className="text-xs text-muted-foreground">
              Qtd. {order.product_ids.filter((id) => id === first.id).length}
              {order.products.length > 1 ? ` · +${order.products.length - 1} item(s)` : ""}
            </p>
            <p className="text-sm font-semibold text-brand tabular-nums mt-0.5">
              {brl(Number(order.value))}
            </p>
          </div>
        </div>
      )}

      {isPaid && (
        <p className="text-xs text-muted-foreground">
          Retirada: <span className="font-medium text-foreground/90">Aguardando retirada</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onOpen}>
          Ver detalhes
        </Button>
      </div>
    </div>
  );
}

function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: ProductOrder | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do pedido</DialogTitle>
          <DialogDescription>{fmtDate(order.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-3">
            {order.products.map((product, i) => (
              <li key={i} className="flex gap-3">
                {product.image ? (
                  <img
                    src={product.image}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover border border-border/50 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground opacity-40" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{product.name}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-border/60 px-3 py-2.5 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3 font-semibold">
              <span>Total</span>
              <span className="text-brand tabular-nums">{brl(Number(order.value))}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Pagamento</span>
              <span className="text-foreground/90">
                {order.status === "paid" ? "Pagamento confirmado" : "Aguardando pagamento"}
              </span>
            </div>
            {order.payment_method && (
              <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>Forma de pagamento</span>
                <span className="text-foreground/90 capitalize">{order.payment_method}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Data do pedido</span>
              <span className="text-foreground/90">{fmtDate(order.created_at)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            A retirada é combinada diretamente com a equipe após a confirmação do pagamento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
