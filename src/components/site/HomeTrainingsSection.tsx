import { useRef } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/site/SectionHeader";
import { useTrainings } from "@/hooks/useContent";
import type { Training } from "@/data/trainings";
import imgGroup from "@/assets/coaches-running.jpg";
import imgRaces from "@/assets/benefit-races-team.jpg";
import imgGallery3 from "@/assets/gallery-3.jpg";
import imgGallery1 from "@/assets/gallery-1.jpg";
import imgGallery5 from "@/assets/gallery-5.jpg";

const TRAINING_PHOTOS = [imgGroup, imgRaces, imgGallery3, imgGallery1, imgGallery5];

const pickPhoto = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TRAINING_PHOTOS[h % TRAINING_PHOTOS.length];
};

const formatShort = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
};

const formatMini = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const vibeLabel = (t: Training) => {
  const s = t.title.toLowerCase();
  if (s.includes("longão") || s.includes("longao")) return "Longão";
  if (s.includes("tiros") || s.includes("pista")) return "Pista";
  if (s.includes("regenerativo") || s.includes("trote")) return "Regenerativo";
  if (s.includes("subida") || s.includes("morro")) return "Subidas";
  if (s.includes("pace") || s.includes("peace")) return "Coletivo";
  return "Treino aberto";
};

const TrainingBanner = ({ training }: { training: Training }) => {
  const photo = training.image && training.image.trim().length > 0 ? training.image : pickPhoto(training.id);
  return (
    <Link
      to={`/treinos#treino-${training.id}`}
      data-card
      className="group relative shrink-0 snap-start block overflow-hidden rounded-3xl border border-border/60 bg-card transition-all duration-500 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_20px_60px_-20px_hsl(var(--brand)/0.35)] w-[78%] sm:w-[58%] md:w-[360px] lg:w-[380px] xl:w-[400px]"
    >
      {/* Mobile 9:16, Desktop crop mais premium 3/4 */}
      <div className="relative aspect-[9/16] md:aspect-[3/4] overflow-hidden bg-muted">
        <img
          src={photo}
          alt={training.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.08]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Top tag */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md">
            {vibeLabel(training)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full bg-brand/90 text-brand-foreground">
            {formatShort(training.date)}
          </span>
        </div>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 text-white">
          <h3 className="font-display text-xl md:text-2xl font-semibold leading-tight drop-shadow-sm">
            {training.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs md:text-[13px] text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {training.time}
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{training.location}</span>
            </span>
          </div>
          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/95 group-hover:text-brand transition-colors">
            Ver detalhes
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
};

export const HomeTrainingsSection = () => {
  const { data: trainings = [] } = useTrainings();
  const upcoming = trainings.slice(0, 6);
  const miniList = trainings.slice(0, 4);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 24 : 380;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  if (upcoming.length === 0) return null;

  return (
    <section className="relative section-padding overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full opacity-[0.09] blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-160px] right-[8%] w-[420px] h-[420px] rounded-full opacity-[0.07] blur-[110px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />

      <div className="container-page relative">
        <div className="flex flex-wrap gap-6 justify-between items-end mb-10 md:mb-14">
          <SectionHeader
            eyebrow="Agenda da equipe"
            title="Treine na rua, na pista, no parque."
            subtitle="Encontros abertos para alunos e convidados. Escolhe o dia, aparece e corre com a tribo."
            align="left"
            className="!mx-0"
          />
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Anterior"
              className="w-11 h-11 rounded-full border border-border/70 hover:border-brand/60 hover:text-brand transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Próximo"
              className="w-11 h-11 rounded-full border border-border/70 hover:border-brand/60 hover:text-brand transition-colors flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Premium horizontal carousel */}
        <div
          ref={scrollerRef}
          className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {upcoming.map((t) => (
            <TrainingBanner key={t.id} training={t} />
          ))}
          <div aria-hidden className="shrink-0 w-1 md:w-2" />
        </div>

        {/* Mini agenda + CTA */}
        <div className="mt-10 md:mt-14 grid md:grid-cols-[1fr_auto] gap-6 items-center bg-card/60 border border-border/60 rounded-2xl p-5 md:p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-brand">
              Próximos encontros
            </span>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/80">
              {miniList.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span className="font-medium text-foreground">{formatMini(t.date)}</span>
                  <span className="text-muted-foreground">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline" className="rounded-full group">
            <Link to="/treinos">
              Abrir agenda completa
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
