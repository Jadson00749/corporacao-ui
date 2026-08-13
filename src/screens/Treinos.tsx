import { useEffect } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { TrainingCard } from "@/components/site/TrainingCard";
import { CTASection } from "@/components/site/CTASection";
import { Button } from "@/components/ui/button";
import { useTrainings } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";

const Treinos = () => {
  const { data: trainings = [], isLoading } = useTrainings();
  const sorted = [...trainings].sort((a, b) => a.date.localeCompare(b.date));
  const { hash } = useLocation();

  // Scroll para o card de treino quando a URL tem âncora (ex: vindo da Agenda).
  useEffect(() => {
    if (!hash || isLoading) return;
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-brand", "rounded-2xl");
        setTimeout(() => el.classList.remove("ring-2", "ring-brand", "rounded-2xl"), 2000);
      });
    }
  }, [hash, isLoading]);

  return (
    <Layout>
      <SEO
        title="Próximos treinos | Corporação Assessoria"
        description="Confira a agenda de treinões e encontros da equipe Corporação. Pistas, parques e ruas, para todos os níveis."
      />
      <PageHero
        eyebrow="Agenda da equipe"
        title="Treine na rua, na pista, no parque."
        subtitle="Encontros abertos para alunos e convidados. Escolha o dia, apareça e corra com a tribo."
      />

      <section className="pt-12 pb-0">
        <div className="container-page">
          <Link
            to="/agenda"
            className="group flex flex-wrap items-center justify-between gap-4 border border-border/60 hover:border-brand/50 transition-all duration-500 rounded-2xl p-5 sm:p-6 bg-card/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl border border-border/60 bg-background text-brand flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand mb-1">
                  Calendário completo
                </p>
                <p className="font-display font-semibold leading-tight">Agenda de treinos e provas</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tudo do mês em um só lugar</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground">
              Abrir agenda
              <span aria-hidden className="w-5 h-px bg-foreground/40 group-hover:w-10 group-hover:bg-brand transition-all duration-300" />
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </span>
          </Link>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-page">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-2xl" />
                ))
              : sorted.map((t) => (
                  <div key={t.id} id={`treino-${t.id}`} className="scroll-mt-28">
                    <TrainingCard training={t} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

export default Treinos;
