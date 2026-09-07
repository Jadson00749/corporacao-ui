import { useEffect, useState } from "react";
import { ArrowRight, Users, Target, HeartPulse, Trophy, Calendar, Camera, Clock, MapPin } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { SectionHeader } from "@/components/site/SectionHeader";
import { TrainingCard } from "@/components/site/TrainingCard";
import { EventCard } from "@/components/site/EventCard";
import { MobileAutoCarousel } from "@/components/site/MobileAutoCarousel";
import { ProductCard } from "@/components/site/ProductCard";
import { AgendaCalendar } from "@/components/site/AgendaCalendar";
import type { Training } from "@/data/trainings";

import { CTASection } from "@/components/site/CTASection";
import { BenefitsSection } from "@/components/site/BenefitsSection";
import { PathwaysSection } from "@/components/site/PathwaysSection";
import { JourneySection } from "@/components/site/JourneySection";
import { TrainingPeaksSection } from "@/components/site/TrainingPeaksSection";
import { HomeTrainingsSection } from "@/components/site/HomeTrainingsSection";
import { PlansHomeSection } from "@/components/site/PlansHomeSection";
import { PartnersSection } from "@/components/site/PartnersSection";
import { GoldSponsorsSection } from "@/components/site/GoldSponsorsSection";
import { UpcomingRacesSection } from "@/components/site/UpcomingRacesSection";
import { HomeHighlightCarousel } from "@/components/site/HomeHighlightCarousel";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import {
  useTrainings,
  useEvents,
  useProducts,
  useTestimonials,
} from "@/hooks/useContent";
/** Hero otimizado (mesma foto do portico). Original CDN ~10,7 MB / 6240×4160. */
import heroMobileWebp from "@/assets/hero-corporacao-portico-mobile.webp";
import heroDesktopWebp from "@/assets/hero-corporacao-portico-desktop.webp";
import heroFallbackWebp from "@/assets/hero-corporacao-portico.webp";
import quemSomosBg from "@/assets/quem-somos-duo.jpg.asset.json";
import avatarLucas from "@/assets/coach-lucas.jpg";
import avatarHelo from "@/assets/coach-helo.jpg";
import avatarDuo from "@/assets/coaches-duo.jpg";
import avatarFund from "@/assets/fundadores.jpg";
import { resolveMediaUrl } from "@/lib/mediaUrl";

/** Detecta o hero pesado do CDN L5e (ou ausência de override no settings). */
const isHeavyPorticoHero = (url?: string | null) => {
  const u = (url || "").trim();
  if (!u) return true;
  return (
    u.includes("hero-corporacao-portico.jpg") ||
    u.includes("254407eb-f3fb-4d70-b8d3-ce8221cbc68f")
  );
};

const quemSomosImg = resolveMediaUrl(quemSomosBg.url);

const benefits = [
  { icon: Target, title: "Planilha individual", desc: "Feita pra você, no seu app." },
  { icon: Users, title: "Treinão mensal", desc: "Uma vez por mês a equipe se encontra." },
  { icon: HeartPulse, title: "Treino com segurança", desc: "Evoluir sem se machucar." },
  { icon: Trophy, title: "Provas da região", desc: "Você por dentro do calendário." },
];

const formatTreinaoDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
};

const NextTreinaoCard = ({ training }: { training: Training }) => (
  <article className="relative bg-card border border-border/60 rounded-2xl overflow-hidden h-full flex flex-col">
    <div className="absolute top-4 left-4 z-10">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1 rounded-full bg-brand text-brand-foreground">
        Próximo treinão
      </span>
    </div>
    <div className="p-6 pt-16 flex flex-col flex-1">
      <h3 className="font-display text-2xl font-semibold leading-tight">
        {training.title}
      </h3>
      <div className="mt-5 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand" />
          <span className="capitalize">{formatTreinaoDate(training.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand" />
          <span>{training.time}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-brand mt-0.5 shrink-0" />
          <span>{training.location}</span>
        </div>
      </div>
      {training.description && (
        <p className="mt-5 text-sm text-foreground/75 leading-relaxed flex-1">
          {training.description}
        </p>
      )}
      {training.mapUrl && (
        <a
          href={training.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <MapPin className="w-4 h-4" /> Ver localização
        </a>
      )}
    </div>
  </article>
);

const Index = () => {
  const siteSettings = useSettings();
  const whatsappLink = useWhatsappLink();

  
  const { data: trainings = [] } = useTrainings();
  const { data: events = [] } = useEvents();
  const { data: products = [] } = useProducts();
  
  const { data: testimonials = [] } = useTestimonials();

  const upcomingTrainings = trainings.slice(0, 3);
  const featuredEvents = events.filter((e) => e.status !== "closed").slice(0, 3);
  const featuredProducts = products.slice(0, 4);

  const scrollToProvas = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("proximas-provas");
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const settingsHeroUrl = resolveMediaUrl(siteSettings.hero.image);
  const useOptimizedHero = isHeavyPorticoHero(siteSettings.hero.image);

  const [showStickyCta, setShowStickyCta] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



  return (
    <Layout>
      <SEO
        title={`${siteSettings.brand.name} | ${siteSettings.brand.slogan}`}
        description={siteSettings.brand.description}
      />

      {/* HERO */}
      <section
        id="home-hero"
        className="relative overflow-hidden bg-[#070707] md:flex md:min-h-[100svh] md:items-end"
      >
        {/*
          Imagem:
          - Mobile: faixa no topo (corta céu/fios; pessoas claras, sem texto por cima)
          - Desktop: full-bleed absoluto (inalterado)
        */}
        <div
          className={cn(
            "overflow-hidden bg-[#070707]",
            "relative h-[min(50svh,400px)] w-full",
            "md:absolute md:inset-0 md:h-auto"
          )}
        >
          {useOptimizedHero ? (
            <img
              key="hero-portico-optimized"
              src={heroFallbackWebp}
              srcSet={`${heroMobileWebp} 1280w, ${heroFallbackWebp} 1600w, ${heroDesktopWebp} 1920w`}
              sizes="100vw"
              alt="Equipe da Corporação Assessoria Esportiva correndo em grupo"
              fetchPriority="high"
              decoding="async"
              loading="eager"
              width={1920}
              height={1280}
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                // Mobile: faixa baixa → object-cover corta céu/asfalto; foco no grupo + arco
                "object-[50%_62%] scale-[1.12] origin-center",
                "md:object-[68%_center] md:scale-100",
                "md:animate-hero-zoom md:[filter:contrast(1.05)_saturate(1.08)] md:animate-fade-in"
              )}
            />
          ) : (
            <img
              key={settingsHeroUrl || "custom-hero"}
              src={settingsHeroUrl}
              alt="Equipe da Corporação Assessoria Esportiva correndo em grupo"
              fetchPriority="high"
              decoding="async"
              loading="eager"
              width={1920}
              height={1280}
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                "object-[50%_62%] scale-[1.12] origin-center",
                "md:object-[68%_center] md:scale-100",
                "md:animate-hero-zoom md:[filter:contrast(1.05)_saturate(1.08)] md:animate-fade-in"
              )}
            />
          )}

          {/* Fade suave só na junção foto → conteúdo (mobile) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070707] to-transparent md:hidden"
          />
        </div>

        {/* Overlays DESKTOP only (mobile sem cobrir a faixa de foto) */}
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(105deg, rgba(5,5,7,0.92) 0%, rgba(5,5,7,0.78) 28%, rgba(5,5,7,0.42) 52%, rgba(5,5,7,0.12) 74%, rgba(5,5,7,0) 92%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "radial-gradient(80% 60% at 22% 55%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 hidden h-48 bg-gradient-to-t from-black/45 via-black/10 to-transparent md:block"
        />

        {/* Halo verde — desktop only */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-32 hidden w-[55vw] h-[55vw] max-w-[680px] max-h-[680px] rounded-full opacity-[0.22] blur-[140px] md:block"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />

        {/* Linhas GPS (desktop) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-[0.10] mix-blend-screen md:block"
          preserveAspectRatio="none"
          viewBox="0 0 1600 900"
        >
          <path d="M-50,720 C260,640 420,820 720,700 C1020,580 1240,820 1700,640" stroke="hsl(var(--brand))" strokeWidth="1.2" fill="none" strokeDasharray="2 6" />
          <path d="M-50,180 C300,140 520,260 820,200 C1120,140 1300,300 1700,220" stroke="hsl(var(--brand))" strokeWidth="0.9" fill="none" />
        </svg>

        {/* Indicador esportivo (desktop) */}
        <div className="absolute right-10 top-28 z-10 hidden flex-col items-end gap-2 text-white/55 md:flex lg:right-16">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase">
            <span className="relative flex">
              <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            São Paulo, BR
          </div>
          <div className="text-[10px] tracking-[0.28em] uppercase text-white/35">Pace 5ʹ20ʺ/km</div>
        </div>

        {/* ════════════ MOBILE HERO — conteúdo centralizado abaixo da foto ════════════ */}
        <div className="container-page relative z-10 flex w-full flex-col items-center pb-3 pt-3 text-center md:hidden">
          <div className="mx-auto w-full max-w-md animate-fade-up text-white [animation-fill-mode:both]">
            <span className="mb-2.5 inline-flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-brand opacity-60 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
              </span>
              Treino em grupo · Corrida & evolução
            </span>

            <h1 className="font-display text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.03em] text-balance">
              <span className="block">Você não</span>
              <span className="block">treina sozinho.</span>
            </h1>

            <p className="mx-auto mt-2.5 max-w-[26ch] text-[14px] leading-snug text-white/75">
              Treino, corrida e evolução com um time de verdade.
            </p>

            <div className="mx-auto mt-5 flex w-full max-w-sm flex-col items-center gap-1">
              <Button
                asChild
                variant="brand"
                size="lg"
                className="h-12 w-full rounded-full px-6 text-[15px] font-semibold shadow-[0_12px_32px_-12px_hsl(var(--brand)/0.65)]"
              >
                <a
                  data-whatsapp-cta
                  href={whatsappLink("Olá! Quero treinar com a Corporação Assessoria Esportiva.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {siteSettings.hero.primaryCta} <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <a
                href="#proximas-provas"
                onClick={scrollToProvas}
                className="inline-flex h-11 items-center justify-center gap-1 px-3 text-[13px] font-medium text-white/65 transition-colors active:scale-[0.98] active:opacity-80 hover:text-white"
              >
                Ver próximas provas
                <ArrowRight className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="flex -space-x-2.5">
                {[avatarLucas, avatarHelo, avatarDuo, avatarFund].map((fallback, i) => {
                  const src = siteSettings.images?.homeTeamAvatars?.[i] || fallback;
                  return (
                    <div
                      key={i}
                      className="h-9 w-9 overflow-hidden rounded-full border-2 border-black/50 ring-1 ring-white/15"
                    >
                      <img
                        src={src}
                        alt=""
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="max-w-[14rem] text-left text-[12.5px] leading-snug text-white/75">
                <span className="font-semibold text-white">+120 atletas</span>
                {" "}treinando com a Corporação
              </p>
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-0 border-t border-white/12 pt-3">
              {(siteSettings.hero?.stats ?? []).map((s, i) => {
                const shortLabels = ["atletas", "anos", "provas"];
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-w-0 px-2 text-center first:pl-0 last:pr-0",
                      i > 0 && "border-l border-white/12"
                    )}
                  >
                    <div className="font-display text-[1.28rem] font-semibold leading-none tracking-[-0.03em] text-white">
                      {s.value}
                    </div>
                    <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/68">
                      {shortLabels[i] ?? s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════════ DESKTOP HERO (intact) ════════════ */}
        <div className="container-page relative z-10 hidden pb-28 pt-32 md:block">
          <div className="relative max-w-2xl animate-fade-up text-white [animation-fill-mode:both]">
            <div className="absolute -left-10 bottom-2 top-2 hidden flex-col items-start gap-3 md:flex">
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-glow [writing-mode:vertical-rl] rotate-180">
                Est. 2017
              </span>
              <span className="w-px flex-1 bg-gradient-to-b from-brand/60 via-white/15 to-transparent" />
            </div>

            <span className="mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-brand opacity-60 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
              </span>
              {siteSettings.hero.eyebrow}
            </span>

            <h1 className="font-display text-[3.4rem] font-semibold leading-[1.02] tracking-[-0.025em] text-balance lg:text-[4.2rem]">
              {siteSettings.hero.title}
              <span className="mt-3 block text-[3.4rem] font-light leading-[1.15] text-white/80 lg:text-[4.2rem]">
                {siteSettings.hero.titleAccent}
              </span>
            </h1>

            <p className="mt-7 max-w-[460px] text-[15px] leading-[1.7] text-white/70 md:text-[16px]">
              {siteSettings.hero.subtitle}
            </p>

            <div className="mt-10 flex flex-row flex-wrap items-center gap-3">
              <Button
                asChild
                variant="brand"
                size="lg"
                className="h-12 w-auto rounded-full px-6 text-[14.5px] font-semibold shadow-[0_10px_28px_-10px_hsl(var(--brand)/0.55)] transition-all hover:shadow-[0_14px_36px_-10px_hsl(var(--brand)/0.7)] active:scale-[0.98]"
              >
                <a
                  data-whatsapp-cta
                  href={whatsappLink("Olá! Quero treinar com a Corporação Assessoria Esportiva.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {siteSettings.hero.primaryCta} <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Link
                to="/provas"
                className="group inline-flex items-center justify-start gap-1.5 text-[13.5px] font-medium text-white/80 transition-colors hover:text-white"
              >
                Ver próximas provas
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="mt-9 flex items-center gap-3">
              <div className="flex -space-x-2">
                {[avatarLucas, avatarHelo, avatarDuo, avatarFund].map((fallback, i) => {
                  const src = siteSettings.images?.homeTeamAvatars?.[i] || fallback;
                  return (
                    <div
                      key={i}
                      className="h-8 w-8 overflow-hidden rounded-full border-2 border-black/60 ring-1 ring-white/10"
                    >
                      <img
                        src={src}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[13px] leading-snug text-white/70">
                <span className="font-semibold text-white">+120 atletas</span> treinando com a Corporação
              </p>
            </div>

            <div className="mt-14 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] backdrop-blur-sm">
              {(siteSettings.hero?.stats ?? []).map((s, i) => (
                <div
                  key={i}
                  className="bg-black/30 px-6 py-5 transition-colors duration-300 hover:bg-black/10 animate-fade-up"
                  style={{ animationDelay: `${120 + i * 90}ms`, animationFillMode: "both" }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-glow/80">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-3 font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-white md:text-[2.25rem]">
                    {s.value}
                  </div>
                  <div className="mt-2 max-w-[180px] text-[12px] leading-snug text-white/55 md:text-[12.5px]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Sticky Mobile */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 px-5 pointer-events-none transition-all duration-300 md:hidden ${
            showStickyCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="pointer-events-auto mx-auto max-w-xs">
            <a
              {...(showStickyCta ? { "data-whatsapp-cta": true } : {})}
              href={whatsappLink("Olá! Quero treinar com a Corporação Assessoria Esportiva.")}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-brand text-brand-foreground text-[13.5px] font-semibold shadow-[0_14px_36px_-12px_hsl(var(--brand)/0.7),0_0_0_1px_hsl(var(--brand)/0.3)] transition-transform active:scale-[0.97]"
            >
              {siteSettings.hero.primaryCta}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* PRÓXIMAS PROVAS - logo após o Hero (apenas mobile) */}
      <div className="md:hidden">
        <UpcomingRacesSection />
      </div>

      {/* DESTAQUES EDITÁVEIS - carrossel logo após o Hero */}
      <HomeHighlightCarousel />

      {/* PATROCINADORES OURO - destaque privilegiado logo após o Hero */}
      <GoldSponsorsSection />

      {/* JOURNEY - pista premium (ocultado temporariamente, basta remover o false && para reexibir) */}
      {false && <JourneySection />}

      {/* INTRO (Quem somos) - editorial */}
      <section className="relative section-padding overflow-hidden bg-background">
        {/* Atmosfera sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full opacity-[0.07] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />

        <div className="container-page relative grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Texto editorial */}
          <div className="relative">
            <span className="inline-flex items-center gap-3 text-[11px] font-semibold tracking-[0.32em] uppercase text-brand mb-6">
              <span className="w-6 h-px bg-brand" />
              Quem somos
            </span>
            <h2 className="font-display text-3xl md:text-5xl lg:text-[3.4rem] font-semibold leading-[1.08] tracking-[-0.01em] text-balance">
              Tem gente esperando você no
              <span className="block mt-2 font-light text-foreground/70">
                próximo <span className="text-brand font-semibold">treino.</span>
              </span>
            </h2>
            <p className="mt-7 text-base md:text-[17px] text-muted-foreground leading-[1.75] max-w-lg">
              Você treina no seu ritmo, com planilha individual no app e coach acompanhando cada passada. E uma vez por mês todo mundo se encontra no Treinão da equipe.
            </p>

            {/* Highlights inline (sem cards) */}
            <ul className="mt-9 grid grid-cols-2 gap-x-8 gap-y-4 max-w-md">
              {benefits.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm leading-tight">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Detalhe humano */}
            <div className="mt-9 flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[avatarLucas, avatarHelo, avatarDuo, avatarFund].map((fallback, i) => {
                  const src = siteSettings.images?.homeTeamAvatars?.[i] || fallback;
                  return (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-background overflow-hidden"
                    >
                      <img
                        src={src}
                        alt=""
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  );
                })}
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">
                <span className="text-foreground font-semibold">+120</span> corredores fazem parte da equipe
              </span>
            </div>

            <Link
              to="/sobre"
              className="group mt-9 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-brand transition-colors"
            >
              Conheça a equipe
              <span className="w-6 h-px bg-foreground/40 group-hover:w-12 group-hover:bg-brand transition-all duration-300" />
            </Link>
          </div>

          {/* Foto editorial valorizada */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle at 30% 30%, hsl(var(--brand) / 0.3), transparent 60%)" }}
            />
            <div className="relative aspect-[4/5] rounded-[1.75rem] overflow-hidden border border-border/40">
              <img
                src={resolveMediaUrl(siteSettings.images?.homeIntro) || quemSomosImg}
                alt="Equipe Corporação na largada"
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[6000ms] hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
                <div className="text-white">
                  <p className="text-[10px] tracking-[0.3em] uppercase text-brand-glow">A equipe</p>
                  <p className="font-display text-base font-semibold leading-tight">Treino real, gente real.</p>
                </div>
                <span className="text-[10px] tracking-[0.25em] uppercase px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white/80">
                  São Paulo
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DIRECIONAMENTO (3 caminhos) */}
      <PathwaysSection />

      {/* 3. TRAINING APP */}
      <TrainingPeaksSection />

      {/* 4. PLANS */}
      <PlansHomeSection />

      {/* 5. BENEFITS */}
      <BenefitsSection />

      {/* 6. TRAININGS */}
      <HomeTrainingsSection />

      {/* 7. EVENTS: agora exibido logo após o hero em <UpcomingRacesSection /> */}



      {/* PRODUCTS (loja) */}
      <section className="section-padding">
        <div className="container-page">
          <div className="flex flex-wrap gap-6 justify-between items-end mb-12">
            <SectionHeader
              eyebrow="Loja Corporação"
              title="Vista a equipe"
              subtitle="Itens oficiais da nossa comunidade. Leve e treine com identidade."
              align="left"
              className="!mx-0"
            />
            <Link
              to="/produtos"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-brand transition-colors"
            >
              Ver todos
              <span className="w-6 h-px bg-foreground/40 group-hover:w-12 group-hover:bg-brand transition-all duration-300" />
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </Link>
          </div>
          {/* Mobile: carrossel horizontal com auto-scroll */}
          <MobileAutoCarousel>
            {featuredProducts.map((p) => (
              <div key={p.id} data-card className="snap-start shrink-0 w-[60%] flex">
                <div className="w-full"><ProductCard product={p} /></div>
              </div>
            ))}
          </MobileAutoCarousel>
          {featuredProducts.length > 1 && (
            <p className="md:hidden mt-2 text-center text-[10px] text-muted-foreground/70 tracking-wider uppercase">
              Arraste para ver mais
            </p>
          )}

          {/* Desktop: grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {featuredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* 9. PHOTO EVENTS CTA */}
      <section className="section-padding">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-[#080808] text-white p-8 md:p-14 border border-white/10">
            <div
              aria-hidden
              className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-[0.18] blur-[140px]"
              style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
            />
            <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-8 md:gap-12">
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.32em] uppercase text-brand/90 mb-4">
                  <Camera className="w-3.5 h-3.5" /> Registros
                </span>
                <h3 className="font-display text-2xl md:text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em]">
                  Suas fotos das provas e treinos,
                  <span className="block font-light text-white/70">tudo em um só lugar.</span>
                </h3>
                <p className="mt-4 text-white/65 max-w-2xl leading-relaxed">
                  Acesse os links oficiais para encontrar suas fotos nos treinos, provas e eventos da equipe.
                </p>
              </div>
              <Link
                to="/fotos"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white hover:bg-brand hover:text-brand-foreground hover:border-brand transition-all shrink-0"
              >
                Ver fotos dos eventos <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative section-padding overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-[8%] w-[420px] h-[420px] rounded-full opacity-[0.06] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />

        <div className="container-page relative">
          <SectionHeader
            eyebrow="Histórias da equipe"
            title="Cada treino vira história."
            subtitle="Da primeira corrida à próxima medalha, cada aluno vive sua própria evolução."
          />
          {(() => {
            const renderCard = (t: typeof testimonials[number], i: number, isMobile: boolean) => (
              <article
                key={t.id}
                data-card={isMobile ? "" : undefined}
                className={`group relative flex flex-col ${
                  isMobile ? "snap-start shrink-0 w-[82%]" : i === 1 ? "md:translate-y-6" : ""
                }`}
              >
                <span aria-hidden className="font-display text-5xl leading-none text-brand/40 select-none">
                  "
                </span>

                <p className="mt-2 text-[17px] md:text-base text-foreground md:text-foreground/85 leading-[1.6] md:leading-[1.75] font-medium md:font-normal">
                  {t.text}
                </p>

                <div className="mt-7 pt-6 border-t border-border/50 flex items-center gap-3">
                  {t.avatar ? (
                    <img
                      src={t.avatar}
                      alt={t.name}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand/10 text-brand font-display font-semibold flex items-center justify-center shrink-0">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-foreground leading-tight text-sm">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-tight">{t.role}</p>
                  </div>
                </div>
              </article>
            );

            return (
              <>
                <div className="mt-16 hidden md:grid md:grid-cols-3 gap-x-8 gap-y-10">
                  {testimonials.map((t, i) => renderCard(t, i, false))}
                </div>
                <div className="mt-6 md:hidden">
                  <MobileAutoCarousel>
                    {testimonials.map((t, i) => renderCard(t, i, true))}
                  </MobileAutoCarousel>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Arraste para ver mais histórias
                  </p>
                </div>
              </>
            );
          })()}

        </div>
      </section>

      {/* PARCEIROS (demais) - clube de benefícios ao final */}
      <PartnersSection />

      {/* CTA FINAL */}
      <CTASection />
    </Layout>
  );
};

export default Index;

