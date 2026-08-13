import { useMemo } from "react";
import { useSearchParams, Link } from "@/lib/router-compat";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { PlansCarousel } from "@/components/site/PlansCarousel";
import { CTASection } from "@/components/site/CTASection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeader } from "@/components/site/SectionHeader";
import { usePlans, useFaqs } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_CATEGORIES, type PlanCategory, type Plan } from "@/data/plans";
import { cn } from "@/lib/utils";

const TABS: { value: PlanCategory; label: string }[] = [...PLAN_CATEGORIES];

const DEFAULT_TAB: PlanCategory = "corrida";

const CATEGORY_DESCRIPTION: Record<PlanCategory, string> = {
  corrida: "Treinos individuais de corrida com acompanhamento direto do treinador.",
  fortalecimento:
    "Programa de musculação periodizado em 4 fases, desenhado para as demandas biomecânicas da corrida.",
  completo: "Corrida + musculação juntos, para quem quer evolução completa.",
};

const Planos = () => {
  const { data: plans = [], isLoading } = usePlans();
  const { data: faqs = [] } = useFaqs();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab") ?? DEFAULT_TAB;
  const activeTab = (TABS.some((t) => t.value === rawTab) ? rawTab : DEFAULT_TAB) as PlanCategory;

  const setTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === DEFAULT_TAB) next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => p.categories?.includes(activeTab));
  }, [plans, activeTab]);

  // collect unique footer notes from a list of plans (preserves order, dedupes)
  const collectFooterNotes = (list: Plan[]) => {
    const seen = new Set<string>();
    const notes: string[] = [];
    for (const p of list) {
      if (p.footerNote && !seen.has(p.footerNote)) {
        seen.add(p.footerNote);
        notes.push(p.footerNote);
      }
    }
    return notes;
  };

  return (
    <Layout>
      <SEO
        title="Planos | Corporação Assessoria Esportiva"
        description="Planos de corrida, fortalecimento e pacotes completos. Escolha mensal, trimestral, semestral ou anual."
      />
      <PageHero
        eyebrow="Planos"
        title="Estrutura para a sua evolução."
        subtitle="Treino, equipe técnica e comunidade. Escolha a frente que combina com o seu objetivo."
      />

      {/* Tabs */}
      <section className="pt-12 pb-4">
        <div className="container-page">
          <div className="flex flex-wrap gap-2 justify-center">
            {TABS.map((t) => {
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase border transition-all duration-300",
                    isActive
                      ? "bg-brand text-brand-foreground border-brand"
                      : "bg-transparent text-foreground/60 border-border hover:border-brand/50 hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-padding pt-8">
        <div className="container-page">
          {isLoading ? (
            <div className="flex gap-6 max-w-7xl mx-auto overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[480px] flex-1 min-w-[260px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div key={activeTab} className="max-w-7xl mx-auto animate-fade-up">
              <SectionHeader
                eyebrow="Planos"
                title={TABS.find((t) => t.value === activeTab)?.label ?? ""}
                subtitle={CATEGORY_DESCRIPTION[activeTab]}
                align="left"
                className="!mx-0"
              />
              {filteredPlans.length === 0 ? (
                <div className="mt-10">
                  <EmptyState tab={activeTab} />
                </div>
              ) : (
                <>
                  <PlansCarousel plans={filteredPlans} />
                  {collectFooterNotes(filteredPlans).length > 0 && (
                    <div className="mt-6 text-xs text-muted-foreground text-right space-y-1">
                      {collectFooterNotes(filteredPlans).map((n) => (
                        <p key={n}>{n}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section-padding bg-secondary/40">
        <div className="container-page max-w-3xl">
          <SectionHeader eyebrow="FAQ" title="Perguntas frequentes" />
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={f.id} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-display text-base md:text-lg">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

const EmptyState = ({ tab }: { tab?: PlanCategory }) => (
  <div className="text-center bg-card border border-border rounded-2xl p-10 max-w-xl mx-auto">
    <h3 className="font-display text-xl font-bold">Nenhum plano nesta categoria</h3>
    <p className="text-muted-foreground mt-2">
      {tab
        ? "Estamos preparando novidades para essa frente. Volte em breve ou veja outras opções."
        : "Cadastre planos no painel e categorize-os para aparecerem aqui."}
    </p>
    <Link to="/planos" className="inline-block mt-5 text-brand font-semibold hover:underline">
      Ver todos os planos
    </Link>
  </div>
);

export default Planos;
