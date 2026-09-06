import { useState } from "react";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { PageHero } from "@/components/site/PageHero";
import { EventCard } from "@/components/site/EventCard";
import { EventBannerCarousel } from "@/components/site/EventBannerCarousel";
import { CTASection } from "@/components/site/CTASection";
import { EventStatus, eventStatusLabel } from "@/data/events";
import { useEvents } from "@/hooks/useContent";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const filters: Array<{ key: "all" | EventStatus; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "open", label: eventStatusLabel.open },
  { key: "soon", label: eventStatusLabel.soon },
  { key: "closed", label: eventStatusLabel.closed },
];

const Provas = () => {
  const [filter, setFilter] = useState<typeof filters[number]["key"]>("all");
  const { data: events = [], isLoading } = useEvents();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = filter === "all" ? sorted : sorted.filter((e) => e.status === filter);

  return (
    <Layout>
      <SEO
        title="Provas e eventos | PACE Assessoria"
        description="Próximas provas e corridas de rua. Confira datas, distâncias e links de inscrição."
      />
      <PageHero
        eyebrow="Calendário"
        title="Os próximos desafios da equipe."
        subtitle="Datas, distâncias e inscrições oficiais. Marque na agenda e vamos juntos."
        className="pb-10 md:pb-28"
      />

      <EventBannerCarousel events={events} />
      <section className="pt-8 pb-12 md:py-24">
        <div className="container-page">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6 mb-6 md:mb-12">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand mb-2">
                Filtrar
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Todas as provas
              </h2>
            </div>
            <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap min-h-10 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all duration-300 border",
                    filter === f.key
                      ? "bg-brand text-brand-foreground border-brand"
                      : "bg-transparent text-foreground/60 border-border hover:border-brand/50 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhuma prova nessa categoria.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {filtered.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CTASection />
    </Layout>
  );
};

export default Provas;
