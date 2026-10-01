import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { ProductCard } from "@/components/site/ProductCard";
import { CTASection } from "@/components/site/CTASection";
import { useProducts } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "@/lib/router-compat";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { showCartToast } from "@/components/site/CartToast";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Produtos = () => {
  const { data: products = [], isLoading } = useProducts();
  const { items, add, decrement, clear, total, count } = useCart();
  const navigate = useNavigate();

  const handleAdd = (product: Parameters<typeof add>[0], size?: string) => {
    add(product, size);
    showCartToast(product);
  };

  return (
    <Layout>
      <SEO
        title="Produtos | Corporação Assessoria Esportiva"
        description="Vista a equipe! Camisetas, bonés, jaquetas e acessórios oficiais da Corporação Assessoria Esportiva."
      />
      <PageHero
        eyebrow="Loja da equipe"
        title="Vista a Corporação."
        subtitle="Peças pensadas para quem treina de verdade. Tecidos premium, design exclusivo, identidade da tribo."
      />

      <section className="section-padding">
        <div className="container-page">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand mb-2">
                Coleção
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Itens oficiais
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs text-right">
              Pedidos pelo WhatsApp. Retirada combinada com a equipe.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 rounded-2xl" />
                ))
              : products.map((p) => (
                  <ProductCard key={p.id} product={p} onBuy={(size) => handleAdd(p, size)} />
                ))}
          </div>
        </div>
      </section>

      {/* Carrinho flutuante */}
      {count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-brand" />
                <span className="font-display font-semibold text-sm">
                  {count} {count === 1 ? "item" : "itens"} no carrinho
                </span>
              </div>
              <span className="font-display font-bold text-brand">{brl(total)}</span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {items.map(({ lineId, product, quantity, selectedSize }) => (
                <div key={lineId} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground truncate block">{product.name}</span>
                    {selectedSize && (
                      <span className="text-[10px] font-bold text-brand uppercase">{selectedSize}</span>
                    )}
                    {!selectedSize && (product.sizes?.length ?? 0) > 0 && (
                      <span className="text-[10px] text-warning">escolha o tamanho</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrement(lineId)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-semibold text-foreground">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => add(product)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-brand hover:border-brand/50 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={clear}
              >
                Cancelar
              </Button>
              <Button
                variant="brand"
                size="lg"
                className="flex-1"
                onClick={() => navigate("/checkout/carrinho")}
              >
                Finalizar compra
              </Button>
            </div>
          </div>
        </div>
      )}

      <CTASection />
    </Layout>
  );
};

export default Produtos;
