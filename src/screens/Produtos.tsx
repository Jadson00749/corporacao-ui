import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { ProductCard } from "@/components/site/ProductCard";
import { CTASection } from "@/components/site/CTASection";
import { useProducts } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";

const Produtos = () => {
  const { data: products = [], isLoading } = useProducts();
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
              : products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

export default Produtos;
