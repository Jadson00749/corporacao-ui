import { useEffect, useState } from "react";
import { ArrowRight, Users, Target, HeartPulse, Trophy, Calendar, Camera, Clock, MapPin } from "lucide-react";
import { Link } from "@/lib/router-compat";

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
import { useSettings, useSettingsLoaded, useWhatsappLink } from "@/contexts/SettingsContext";
import {
  useTrainings,
  useEvents,
  useProducts,
  useTestimonials,
} from "@/hooks/useContent";
import heroAsset from "@/assets/hero-corporacao-portico.jpg.asset.json";
const heroImg = heroAsset.url;
import quemSomosBg from "@/assets/quem-somos-duo.jpg.asset.json";
import avatarLucas from "@/assets/coach-lucas.jpg";
import avatarHelo from "@/assets/coach-helo.jpg";
import avatarDuo from "@/assets/coaches-duo.jpg";
import avatarFund from "@/assets/fundadores.jpg";

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
  const settingsLoaded = useSettingsLoaded();
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
      <section className="relative min-h-[86svh] sm:min-h-[100svh] flex items-end overflow-hidden bg-[#070707]">
        {/* Imagem de fundo: leve blur no mobile p/ legibilidade */}
        <div className="absolute inset-0 overflow-hidden">
          {(settingsLoaded || !siteSettings.hero.image) && (
            <img
              key={siteSettings.hero.image || "fallback-hero"}
              src={siteSettings.hero.image || heroImg}
              alt="Equipe da Corporação Assessoria Esportiva correndo em grupo"
              fetchPriority="high"
              decoding="sync"
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover object-[68%_center] animate-hero-zoom [filter:contrast(1.14)_saturate(1.04)_brightness(0.92)_blur(1.5px)] md:[filter:contrast(1.05)_saturate(1.08)] animate-fade-in"
              width={1920}
              height={1280}
            />
          )}
        </div>



        {/* Overlay base no mobile + gradiente lateral no desktop */}
        <div aria-hidden className="absolute inset-0 bg-black/50 md:hidden" />
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
        {/* Cinematic overlay localizado atrás do texto (mobile) */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "radial-gradient(130% 75% at 18% 62%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 40%, rgba(0,0,0,0.3) 72%, transparent 100%)",
          }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/55 to-transparent md:from-black/45 md:via-black/10 md:h-48" />


        {/* Halo verde discreto, lateral */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-32 w-[55vw] h-[55vw] max-w-[680px] max-h-[680px] rounded-full opacity-[0.22] blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
        />

        {/* Linhas de rota GPS abstratas (desktop) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.10] mix-blend-screen hidden md:block"
          preserveAspectRatio="none"
          viewBox="0 0 1600 900"
        >
          <path d="M-50,720 C260,640 420,820 720,700 C1020,580 1240,820 1700,640" stroke="hsl(var(--brand))" strokeWidth="1.2" fill="none" strokeDasharray="2 6" />
          <path d="M-50,180 C300,140 520,260 820,200 C1120,140 1300,300 1700,220" stroke="hsl(var(--brand))" strokeWidth="0.9" fill="none" />
        </svg>

        {/* Indicador esportivo (desktop) */}
        <div className="hidden md:flex absolute top-28 right-10 lg:right-16 flex-col items-end gap-2 text-white/55 z-10">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase">
            <span className="relative flex">
              <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-brand" />
            </span>
            São Paulo, BR
          </div>
          <div className="text-[10px] tracking-[0.28em] uppercase text-white/35">
            Pace 5ʹ20ʺ/km
          </div>
        </div>

        <div className="container-page relative pt-20 sm:pt-32 pb-14 sm:pb-24 md:pb-28 z-10">
          <div className="relative max-w-2xl text-white animate-fade-up [animation-fill-mode:both]">
            {/* Selo lateral vertical (desktop) */}
            <div className="hidden md:flex flex-col items-start gap-3 absolute -left-10 top-2 bottom-2">
              <span className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand-glow [writing-mode:vertical-rl] rotate-180">
                Est. 2017
              </span>
              <span className="flex-1 w-px bg-gradient-to-b from-brand/60 via-white/15 to-transparent" />
            </div>

            {/* Eyebrow refinado */}
            <span className="inline-flex items-center gap-2.5 text-[10px] sm:text-[11px] font-semibold tracking-[0.28em] sm:tracking-[0.32em] uppercase text-white/70 mb-3.5 sm:mb-7">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-60" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
              </span>
              {siteSettings.hero.eyebrow}
            </span>

            <h1 className="font-display font-semibold leading-[1.02] tracking-[-0.025em] text-balance [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] sm:[text-shadow:none] text-[1.7rem] sm:text-[2.6rem] md:text-[3.4rem] lg:text-[4.2rem]">
              {siteSettings.hero.title}
              <span className="block mt-1.5 sm:mt-3 font-light text-white/90 sm:text-white/80 text-[1.25rem] sm:text-[2.6rem] md:text-[3.4rem] lg:text-[4.2rem] leading-[1.15]">
                {siteSettings.hero.titleAccent}
              </span>
            </h1>

            <p className="mt-3.5 sm:mt-7 text-[14px] sm:text-[15px] md:text-[16px] text-white/80 sm:text-white/70 max-w-[34ch] sm:max-w-[460px] leading-[1.6] sm:leading-[1.7] [text-shadow:0_1px_10px_rgba(0,0,0,0.6)] sm:[text-shadow:none] line-clamp-3 sm:line-clamp-none">
              {siteSettings.hero.subtitle}
            </p>


            <div className="mt-5 sm:mt-10 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3 items-center sm:items-center">
              <Button
                asChild
                variant="brand"
                size="lg"
                className="rounded-full px-6 w-full sm:w-auto h-12 text-[14.5px] font-semibold shadow-[0_10px_28px_-10px_hsl(var(--brand)/0.55)] hover:shadow-[0_14px_36px_-10px_hsl(var(--brand)/0.7)] active:scale-[0.98] transition-all"
              >
                <a href={whatsappLink("Olá! Quero treinar com a Corporação Assessoria Esportiva.")} target="_blank" rel="noreferrer">
                  {siteSettings.hero.primaryCta} <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <a
                href="#proximas-provas"
                onClick={scrollToProvas}
                className="md:hidden group inline-flex items-center justify-center sm:justify-start gap-1.5 h-10 sm:h-auto px-4 sm:px-0 rounded-full border border-white/15 sm:border-0 bg-white/[0.06] sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-0 text-[13px] sm:text-[13.5px] font-medium text-white/80 hover:text-white transition-colors"
              >
                Ver próximas provas
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
              <Link
                to="/provas"
                className="hidden md:inline-flex items-center justify-start gap-1.5 h-auto px-0 text-[13.5px] font-medium text-white/80 hover:text-white transition-colors group"
              >
                Ver próximas provas
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Prova social humana (mobile + desktop) */}
            <div className="mt-5 sm:mt-9 flex items-center gap-2.5 sm:gap-3">
              <div className="flex -space-x-2">
                {[avatarLucas, avatarHelo, avatarDuo, avatarFund].map((fallback, i) => {
                  const src = siteSettings.images?.homeTeamAvatars?.[i] || fallback;
                  return (
                    <div
                      key={i}
                      className="w-8 h-8 sm:w-8 sm:h-8 rounded-full border-2 border-black/60 overflow-hidden ring-1 ring-white/10"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  );
                })}
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-white/70 leading-snug">
                <span className="text-white font-semibold">+120 atletas</span> treinando com a Corporação
              </p>
            </div>

            {/* Stats mobile: bloco glass único */}
            <div className="mt-5 sm:hidden rounded-2xl border border-white/[0.09] bg-black/55 backdrop-blur-xl px-1 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-28px_rgba(0,0,0,0.85)]">
              <div className="grid grid-cols-3 divide-x divide-white/[0.08]">
                {(siteSettings.hero?.stats ?? []).map((s, i) => {
                  const Icon = [Users, Calendar, Trophy][i] ?? Users;
                  const mobileLabels = ["atletas", "anos de estrada", "provas"];
                  const label = mobileLabels[i] ?? s.label;
                  return (
                    <div key={i} className="min-w-0 px-3 text-center">
                      <Icon className="mx-auto w-[13px] h-[13px] text-white/35" strokeWidth={1.75} />
                      <div className="mt-2 font-display text-[1.5rem] font-semibold text-white tracking-[-0.035em] leading-none">
                        {s.value}
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-white/55 leading-tight tracking-[-0.005em]">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>





            {/* Stats desktop: editorial premium */}
            <div className="hidden sm:grid mt-14 grid-cols-3 gap-px max-w-2xl bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06] backdrop-blur-sm">
              {(siteSettings.hero?.stats ?? []).map((s, i) => (
                <div
                  key={i}
                  className="bg-black/30 px-6 py-5 transition-colors duration-300 hover:bg-black/10 animate-fade-up"
                  style={{ animationDelay: `${120 + i * 90}ms`, animationFillMode: "both" }}
                >
                  <div className="text-[10px] font-semibold tracking-[0.28em] uppercase text-brand-glow/80">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-3 font-display text-3xl md:text-[2.25rem] font-semibold text-white tracking-[-0.03em] leading-none">
                    {s.value}
                  </div>
                  <div className="mt-2 text-[12px] md:text-[12.5px] text-white/55 leading-snug max-w-[180px]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* CTA Sticky Mobile: aparece após scroll, compacto e elegante */}
        <div
          className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-5 pointer-events-none transition-all duration-300 ${
            showStickyCta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="pointer-events-auto mx-auto max-w-xs">
            <a
              href={whatsappLink("Olá! Quero treinar com a Corporação Assessoria Esportiva.")}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 w-full h-11 rounded-full bg-brand/95 backdrop-blur-md text-brand-foreground font-semibold text-[13.5px] shadow-[0_14px_36px_-12px_hsl(var(--brand)/0.7),0_0_0_1px_hsl(var(--brand)/0.3)] active:scale-[0.97] transition-transform"
            >
              {siteSettings.hero.primaryCta}
              <ArrowRight className="w-3.5 h-3.5" />
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
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
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
                src={siteSettings.images?.homeIntro || quemSomosBg.url}
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

