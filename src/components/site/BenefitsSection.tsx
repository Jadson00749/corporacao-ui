import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/site/SectionHeader";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import c1Asset from "@/assets/c1.jpg.asset.json";
import c2Asset from "@/assets/c2.jpg.asset.json";
import c3Asset from "@/assets/c3.jpg.asset.json";


type Benefit = {
  fallbackImage: string;
  title: string;
  desc: string;
  objectPosition?: string;
};

// Ordem dos cards = ordem das imagens em site_settings.home_benefit_image_1..6
const benefits: Benefit[] = [
  {
    fallbackImage: c1Asset.url,
    title: "Provas da região no radar",
    desc: "Calendário mapeado e orientação pra escolher a próxima.",
  },
  {
    fallbackImage: c2Asset.url,
    title: "Clube de benefícios",
    desc: "Descontos exclusivos em tênis e produtos com parceiros.",
  },
  {
    fallbackImage: c3Asset.url,
    title: "Treinão mensal",
    desc: "Uma vez por mês a equipe se encontra pra correr junto.",
    objectPosition: "center 30%",
  },
];

export const BenefitsSection = () => {
  const whatsappLink = useWhatsappLink();
  const { homeBenefitImages } = useSettings();

  return (
    <section className="relative section-padding bg-background overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full opacity-[0.06] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />

      <div className="container-page relative">
        <SectionHeader
          eyebrow="Por que Corporação"
          title="Tudo que você precisa pra evoluir."
          subtitle="Planilha individual no app, coach acompanhando e a equipe junto uma vez por mês no Treinão."
        />

        {/* Mobile: carrossel horizontal */}
        <div className="mt-10 sm:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-4 pb-2">
            {benefits.map((b, i) => {
              const src = homeBenefitImages?.[i + 3] || b.fallbackImage;
              return (
                <article key={b.title} className="snap-start shrink-0 w-[72%] flex flex-col">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-card">
                    <img
                      src={src}
                      alt={b.title}
                      loading="lazy"
                      style={b.objectPosition ? { objectPosition: b.objectPosition } : undefined}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-[0.3em] uppercase text-white/85">
                      0{i + 1}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h3 className="font-display font-semibold text-[15px] leading-snug text-foreground">
                      {b.title}
                    </h3>
                    <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </article>
              );
            })}
            <div className="shrink-0 w-1" aria-hidden />
          </div>
        </div>
        <p className="sm:hidden mt-2 text-center text-[10px] text-muted-foreground/70 tracking-wider uppercase">
          Arraste para o lado
        </p>

        {/* Desktop/tablet: grid */}
        <div className="mt-14 hidden sm:grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => {
            const src = homeBenefitImages?.[i + 3] || b.fallbackImage;
            return (
              <article key={b.title} className="group flex flex-col">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-card">
                  <img
                    src={src}
                    alt={b.title}
                    loading="lazy"
                    style={b.objectPosition ? { objectPosition: b.objectPosition } : undefined}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
                  />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-[0.3em] uppercase text-white/85">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-display font-semibold text-base leading-snug text-foreground">
                    {b.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {b.desc}
                  </p>
                  <span
                    aria-hidden
                    className="mt-3 block h-px w-6 bg-brand/60 transition-all duration-500 group-hover:w-12"
                  />
                </div>
              </article>
            );
          })}
        </div>


        <div className="mt-16 flex justify-center">
          <Button asChild variant="brand" size="lg" className="rounded-full px-7">
            <a
              href={whatsappLink(
                "Olá! Quero saber mais sobre os benefícios de fazer parte da Corporação."
              )}
              target="_blank"
              rel="noreferrer"
            >
              Quero fazer parte da equipe <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
