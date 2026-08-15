import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { SectionHeader } from "@/components/site/SectionHeader";
import { useSettings } from "@/contexts/SettingsContext";
import pathRunningAsset from "@/assets/path-corrida.jpg.asset.json";
import pathStrengthAsset from "@/assets/path-forca.jpg.asset.json";
import pathCompleteAsset from "@/assets/path-completo.jpg.asset.json";

const pathRunning = pathRunningAsset.url;
const pathStrength = pathStrengthAsset.url;
const pathComplete = pathCompleteAsset.url;

type Pathway = {
  number: string;
  title: string;
  description: string;
  image: string;
  href: string;
  cta: string;
};

const buildPathways = (overrides: string[] = []): Pathway[] => [
  {
    number: "01",
    title: "Quero correr",
    description: "Para quem quer começar ou evoluir na corrida com método e acompanhamento.",
    image: overrides[0] || pathRunning,
    href: "/planos?tab=corrida",
    cta: "Ver planos",
  },
  {
    number: "02",
    title: "Fortalecimento",
    description: "Musculação focada em performance, prevenção e força específica para corredores.",
    image: overrides[1] || pathStrength,
    href: "/planos?tab=fortalecimento",
    cta: "Ver detalhes",
  },
  {
    number: "03",
    title: "Pacote completo",
    description: "Corrida e musculação combinados para uma evolução completa e sustentável.",
    image: overrides[2] || pathComplete,
    href: "/planos?tab=completo",
    cta: "Ver planos",
  },
];

const PathwayCard = ({ p, i, offset }: { p: Pathway; i: number; offset?: boolean }) => (
  <Link
    to={p.href}
    className={`group relative flex flex-col ${offset && i === 1 ? "md:translate-y-6" : ""}`}
  >
    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-card border border-border/50 transition-all duration-500 group-hover:border-brand/40">
      <img
        src={p.image}
        alt={p.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-transparent" />

      <span className="absolute top-5 left-5 text-[11px] font-semibold tracking-[0.32em] uppercase text-white/80">
        {p.number}
      </span>

      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h3 className="font-display text-2xl md:text-[1.7rem] font-semibold leading-tight">
          {p.title}
        </h3>
        <p className="mt-2 text-sm text-white/70 leading-relaxed max-w-xs">
          {p.description}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-white">
          {p.cta}
          <span className="w-6 h-px bg-white/50 group-hover:w-12 group-hover:bg-brand transition-all duration-300" />
          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
        </div>
      </div>
    </div>
  </Link>
);

const MobileAutoCarousel = ({ pathways }: { pathways: Pathway[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = () => { pausedRef.current = true; };
    const onPointerUp = () => { setTimeout(() => { pausedRef.current = false; }, 2500); };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    const id = setInterval(() => {
      if (pausedRef.current || !el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      const step = card ? card.offsetWidth + 16 : 240;
      let next = el.scrollLeft + step * dirRef.current;
      if (next >= max - 2) { next = max; dirRef.current = -1; }
      else if (next <= 0) { next = 0; dirRef.current = 1; }
      el.scrollTo({ left: next, behavior: "smooth" });
    }, 3800);

    return () => {
      clearInterval(id);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex gap-4 pb-2">
        {pathways.map((p, i) => (
          <div key={p.title} data-card className="snap-start shrink-0 w-[78%]">
            <PathwayCard p={p} i={i} />
          </div>
        ))}
        <div className="shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
};

export const PathwaysSection = () => {
  const settings = useSettings();
  const pathways = buildPathways(settings.images?.pathways);
  return (
  <section className="section-padding bg-background">
    <div className="container-page">
      <SectionHeader
        eyebrow="Por onde começar"
        title="Escolha o seu caminho"
        subtitle="Três frentes pensadas para diferentes objetivos. Encontre a que combina com o seu momento."
      />

      {/* Mobile: carrossel com auto-scroll */}
      <div className="mt-10">
        <MobileAutoCarousel pathways={pathways} />
        <p className="md:hidden mt-2 text-center text-[10px] text-muted-foreground/70 tracking-wider uppercase">
          Arraste para o lado
        </p>
      </div>

      {/* Desktop: grid */}
      <div className="mt-14 hidden md:grid md:grid-cols-3 gap-6 md:gap-8">
        {pathways.map((p, i) => (
          <PathwayCard key={p.title} p={p} i={i} offset />
        ))}
      </div>
    </div>
  </section>
  );
};
