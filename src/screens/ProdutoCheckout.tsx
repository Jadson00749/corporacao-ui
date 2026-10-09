import { useParams } from "@/lib/router-compat";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useProducts } from "@/hooks/useContent";
import { useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Package } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { CartPaymentStep } from "@/components/site/CartPaymentStep";
import { useMemo } from "react";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parsePrice(price?: string): number {
  if (!price) return 0;
  return parseFloat(price.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

const ProdutoCheckout = () => {
  const { id } = useParams<{ id: string }>();

  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: products = [], isLoading } = useProducts();
  const cart = useCart();

  const isCart = id === "carrinho";

  const cartItems = cart.items;
  const cartTotal = cart.total;
  const cartProductIds = cartItems.map((i) => i.product.id);

  // Agrupa por produto + tamanho para exibição no resumo
  const groupedSummary = useMemo(() => {
    const map = new Map<string, { name: string; price: string; size?: string; count: number; subtotal: number }>();
    for (const item of cartItems) {
      const key = `${item.product.id}__${item.selectedSize ?? ""}`;
      const price = parsePrice(item.product.price);
      if (map.has(key)) {
        const entry = map.get(key)!;
        entry.count += item.quantity;
        entry.subtotal += price * item.quantity;
      } else {
        map.set(key, {
          name: item.product.name,
          price: item.product.price ?? "",
          size: item.selectedSize,
          count: item.quantity,
          subtotal: price * item.quantity,
        });
      }
    }
    return [...map.values()];
  }, [cartItems]);

  // Modo produto único
  const product = !isCart ? products.find((p) => p.id === id) : null;
  const singleValue = parsePrice(product?.price);

  const value = isCart ? cartTotal : singleValue;
  const productIds = isCart ? cartProductIds : (product ? [product.id] : []);
  const description = isCart
    ? `Carrinho: ${groupedSummary.map((g) => {
        const base = g.count > 1 ? `${g.count}× ${g.name}` : g.name;
        return g.size ? `${base} (${g.size})` : base;
      }).join(", ")}`
    : `Compra: ${product?.name}`;

  if (isLoading && !isCart) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page pb-10">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <Skeleton className="h-96 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isCart && (!product || singleValue <= 0)) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page pb-10 text-center space-y-4">
          <p className="text-muted-foreground">Produto não encontrado.</p>
          <Button variant="outline" asChild>
            <Link to="/produtos">Voltar para produtos</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (isCart && cartItems.length === 0) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page pb-10 text-center space-y-4">
          <p className="text-muted-foreground">Seu carrinho está vazio.</p>
          <Button variant="outline" asChild>
            <Link to="/produtos">Ver produtos</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page pb-10 text-center space-y-4">
          <p className="text-muted-foreground">Faça login para continuar com a compra.</p>
          <Button variant="brand" asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const summaryCard = (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 lg:sticky lg:top-28">
      {!isCart && product?.image && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-background">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            {isCart ? "Carrinho" : "Produto"}
          </span>
        </div>
        <h2 className="font-display text-lg font-bold leading-tight text-foreground">
          {isCart ? `${cart.count} ${cart.count === 1 ? "item" : "itens"}` : product!.name}
        </h2>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5 text-sm">
        {isCart ? (
          groupedSummary.map((g, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-muted-foreground truncate">
                {g.count > 1 && <span className="font-medium text-foreground mr-1">{g.count}×</span>}
                {g.name}
                {g.size && <span className="ml-1 text-xs text-brand font-semibold">({g.size})</span>}
              </span>
              <span className="font-medium shrink-0">{brl(g.subtotal)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{product!.name}</span>
            <span className="font-medium">{product!.price}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
          <span>Total</span>
          <span className="text-brand">{brl(value)}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          A retirada é combinada com a equipe após o pagamento.
        </p>
      </div>
    </div>
  );

  return (
    <Layout>
      <SEO
        title="Finalizar compra | Corporação Assessoria Esportiva"
        description="Conclua sua compra com segurança."
      />

      <div className="section-padding pt-24 container-page pb-10">
        <Link
          to="/produtos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para produtos
        </Link>

        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-8">
          Finalizar compra
        </h1>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-5">
            {/* Resumo do pedido agrupado */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Resumo do pedido
              </p>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Comprador</span>
                <span className="font-medium text-right">{profile?.full_name || user.email?.split("@")[0]}</span>
              </div>
              {isCart ? (
                groupedSummary.map((g, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="text-muted-foreground truncate">
                      {g.count > 1 && <span className="font-medium text-foreground mr-1">{g.count}×</span>}
                      {g.name}
                    </span>
                    <span className="font-medium shrink-0 inline-flex items-center gap-1.5">
                      {g.size && (
                        <span className="px-1.5 py-0.5 rounded bg-brand/10 text-brand text-xs font-bold border border-brand/30">
                          {g.size}
                        </span>
                      )}
                      {brl(g.subtotal)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{product!.name}</span>
                  <span className="font-medium">{product!.price}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-brand">{brl(value)}</span>
              </div>
            </div>

            <CartPaymentStep
              productIds={productIds}
              value={value}
              userId={user?.id}
              customer={{
                name: profile?.full_name || user.email?.split("@")[0] || "",
                cpfCnpj: profile?.cpf?.replace(/\D/g, "") || "",
                email: user.email ?? "",
                phone: profile?.whatsapp?.replace(/\D/g, "") || "",
              }}
              description={description}
              onSuccess={() => {
                cart.clear();
              }}
            />
          </div>
          <div className="hidden lg:block">{summaryCard}</div>
        </div>

        <div className="lg:hidden mt-6">{summaryCard}</div>
      </div>
    </Layout>
  );
};

export default ProdutoCheckout;
