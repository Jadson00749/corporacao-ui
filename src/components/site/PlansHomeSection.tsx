import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/site/SectionHeader";
import { PlansCarousel } from "@/components/site/PlansCarousel";
import { usePlans } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_CATEGORIES, type PlanCategory } from "@/data/plans";
import { whatsappLink } from "@/data/settings";
import { cn } from "@/lib/utils";
import logoCorporacao from "@/assets/logo-corporacao.png";

const DEFAULT_TAB: PlanCategory = "corrida";

const CATEGORY_DESCRIPTION: Record<PlanCategory, string> = {
  corrida: "Treinos individuais de corrida com acompanhamento direto do treinador.",
  fortalecimento:
    "Programa de musculação periodizado em 4 fases, desenhado para as demandas biomecânicas da corrida.",
  completo: "Corrida + musculação juntos, para quem quer evolução completa.",
};

export const PlansHomeSection = () => {
  const { data: plans = [], isLoading } = usePlans();
  const [activeTab, setActiveTab] = useState<PlanCategory>(DEFAULT_TAB);

  const filteredPlans = useMemo(
    () => plans.filter((p) => p.categories?.includes(activeTab)),
    [plans, activeTab]
  );

  return (
    <section className="relative section-padding bg-background overflow-hidden">
      {/* Atmosfera muito sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full opacity-[0.06] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      <div className="container-page relative">
        <SectionHeader
          eyebrow="Planos"
          title="Encontre o plano certo para sua jornada"
          subtitle={CATEGORY_DESCRIPTION[activeTab]}
        />

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap gap-2 justify-center">
          {PLAN_CATEGORIES.map((t) => {
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveTab(t.value)}
                className={cn(
                  "px-5 py-2 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        <div className="mt-12 max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex gap-6 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[480px] flex-1 min-w-[260px] rounded-2xl" />
              ))}
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center bg-card border border-border/60 rounded-2xl p-10 max-w-xl mx-auto">
              <h3 className="font-display text-xl font-semibold">Em breve</h3>
              <p className="text-muted-foreground mt-2">
                Estamos preparando novidades para essa frente.
              </p>
            </div>
          ) : (
            <div key={activeTab} className="animate-fade-up">
              <PlansCarousel plans={filteredPlans} />
            </div>
          )}
        </div>

        {/* Clube de Benefícios - incluso em todos os planos */}
        <div className="mt-12 max-w-3xl mx-auto">
          <a
            href="/#patrocinadores-gold"
            className="group relative flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-brand/[0.08] via-card to-card border border-brand/20 hover:border-brand/40 transition-all duration-300 overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(circle at left, hsl(var(--brand) / 0.08), transparent 60%)" }}
            />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-brand/15 border border-brand/30 shrink-0">
              <span className="text-brand text-xl">★</span>
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-brand">Incluso em todos os planos</span>
              </div>
              <h4 className="mt-1 font-display text-base md:text-lg font-semibold text-foreground">
                Clube de Benefícios Corporação
              </h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Cupons e descontos exclusivos com parceiros selecionados: viagens, suplementação, equipamentos e mais.
              </p>
            </div>
            <span className="relative hidden sm:inline-flex items-center text-sm text-foreground/70 group-hover:text-brand transition-colors">
              Ver parceiros →
            </span>
          </a>
        </div>


        <div className="mt-16 max-w-2xl mx-auto text-center">
          <h3 className="font-display text-xl md:text-2xl font-semibold tracking-tight">
            Fale com o professor e <span className="text-brand">comece sua jornada.</span>
          </h3>
          <p className="mt-3 text-muted-foreground">
            Tire dúvidas, conheça a metodologia e dê o primeiro passo com a equipe.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center items-center">
            <Button asChild variant="brand" size="lg" className="rounded-full px-7">
              <a
                href={whatsappLink("Olá! Quero falar com o professor sobre os planos da Corporação.")}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4" /> Falar com o professor
              </a>
            </Button>
            <Link
              to={`/planos?tab=${activeTab}`}
              className="group inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Ver detalhes completos
              <span className="w-5 h-px bg-foreground/40 group-hover:w-10 group-hover:bg-brand transition-all duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
