import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Calendar, MapPin, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RaceEvent } from "@/data/events";
import { getEventBannerFallback } from "@/lib/eventBannerFallback";
import {
  CORP_PLATFORM_NAME,
  organizationAccent,
  organizationCtaVariant,
  partnerOrganizerPublicName,
  resolveOrganizationContext,
} from "@/lib/eventOrganizer";

const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

type Props = { events: RaceEvent[] };

/** Só carrega slide atual e vizinhos (±1); demais ficam de fora do DOM. */
const shouldLoadSlide = (i: number, index: number, len: number) => {
  if (len <= 3) return true;
  if (i === index) return true;
  if (i === (index - 1 + len) % len) return true;
  if (i === (index + 1) % len) return true;
  return false;
};

/** Arte preservada: blur da mesma URL + object-contain (sem 2ª requisição de rede). */
const BannerArt = ({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority: boolean;
}) => (
  <>
    <img
      src={src}
      alt=""
      aria-hidden
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      decoding="async"
      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
    />
    <img
      src={src}
      alt={alt}
      width={1200}
      height={675}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      decoding="async"
      className="relative z-[1] h-full w-full object-contain object-center"
    />
  </>
);

export const EventBannerCarousel = ({ events }: Props) => {
  const open = events.filter((e) => e.status === "open");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % open.length);
    }, 5000);
    return () => clearInterval(t);
  }, [open.length]);

  if (open.length === 0) return null;

  const current = open[index];
  const signupHref = current.internalSignup
    ? `/provas/${current.id}/inscricao`
    : current.registrationUrl || `/provas/${current.id}`;
  const signupExternal = !current.internalSignup && !!current.registrationUrl;

  const go = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + open.length) % open.length);

  const modalities =
    (current.distances ?? [])
      .map((d) => d.distance)
      .filter(Boolean)
      .join(" • ") || current.distance;

  const partnerName = partnerOrganizerPublicName(
    current.organizerId,
    current.organizer
  );
  const orgContext = resolveOrganizationContext(current.organizerId, current.organizer);
  const ctaVariant = organizationCtaVariant(orgContext);
  const accent = organizationAccent(orgContext);

  const renderSignup = () => (
    <Button asChild variant={ctaVariant} className="w-full md:w-auto">
      {signupExternal ? (
        <a href={signupHref} target="_blank" rel="noreferrer">
          Inscrever-se
        </a>
      ) : (
        <Link to={signupHref}>Inscrever-se</Link>
      )}
    </Button>
  );

  const renderDetails = () => (
    <Button asChild variant="outline" className="w-full md:w-auto">
      <Link to={`/provas/${current.id}`}>Ver detalhes</Link>
    </Button>
  );

  const infoBlock = (
    <div className="flex h-full flex-col justify-center gap-3 sm:gap-4">
      <span className="inline-flex w-fit items-center rounded-full bg-success px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
        Inscrições abertas
      </span>

      <h2 className="font-display text-balance text-[1.35rem] font-semibold leading-snug text-foreground sm:text-2xl lg:text-3xl">
        {current.name}
      </h2>

      {partnerName ? (
        <div className="space-y-1.5">
          <div className={cn("inline-flex max-w-full items-start gap-2.5 rounded-xl border px-3 py-2.5", accent.border, accent.bgSoft)}>
            <Building2 className={cn("mt-0.5 h-4 w-4 shrink-0", accent.icon)} aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Organizador
              </p>
              <p className={cn("text-sm font-semibold leading-snug break-words", accent.text)}>
                {partnerName}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pl-0.5">
            Inscrições pela {CORP_PLATFORM_NAME}
          </p>
        </div>
      ) : null}

      {modalities ? (
        <p className={cn("text-sm font-medium leading-snug", accent.text)}>
          {modalities}
        </p>
      ) : null}

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span>{formatDate(current.date)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="break-words">{current.city}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1 md:flex-row md:flex-wrap">
        {renderSignup()}
        {renderDetails()}
      </div>
    </div>
  );

  const dots = open.length > 1 && (
    <div className="flex justify-center gap-2 pt-1 md:justify-start">
      {open.map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Ir para slide ${i + 1}`}
          onClick={() => setIndex(i)}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === index ? "w-8 bg-brand" : "w-4 bg-border"
          )}
        />
      ))}
    </div>
  );

  return (
    <section className="relative">
      <div className="container-page pt-4 md:pt-12">
        {/* ── Mobile: banner inteiro → informações → CTAs ── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card md:hidden">
          <div className="relative aspect-[16/9] bg-[#0b0b0b]">
            {open.map((ev, i) => {
              if (!shouldLoadSlide(i, index, open.length)) return null;
              const bg =
                ev.bannerMobileImage ||
                ev.bannerImage ||
                ev.image ||
                getEventBannerFallback(ev.id);
              const active = i === index;
              return (
                <div
                  key={ev.id}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700",
                    active ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                  aria-hidden={!active}
                >
                  <BannerArt
                    src={bg}
                    alt={active ? `Banner ${ev.name}` : ""}
                    priority={active}
                  />
                </div>
              );
            })}

            {open.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Próximo"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            {infoBlock}
            {dots}
          </div>
        </div>

        {/* ── Desktop: ~35% info | ~65% arte limpa ── */}
        <div className="relative hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:grid md:h-[460px] md:grid-cols-[minmax(280px,35%)_minmax(0,65%)]">
          <div className="relative z-[2] flex flex-col justify-center border-r border-border/60 bg-card px-6 py-8 lg:px-10 lg:py-10">
            {infoBlock}
            {open.length > 1 ? <div className="mt-5">{dots}</div> : null}
          </div>

          <div className="relative min-h-0 bg-[#0b0b0b]">
            {open.map((ev, i) => {
              if (!shouldLoadSlide(i, index, open.length)) return null;
              const bg = ev.bannerImage || ev.image || getEventBannerFallback(ev.id);
              const active = i === index;
              return (
                <div
                  key={ev.id}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700",
                    active ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                  aria-hidden={!active}
                >
                  <BannerArt
                    src={bg}
                    alt={active ? `Banner ${ev.name}` : ""}
                    priority={active}
                  />
                </div>
              );
            })}

            {open.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                  className="absolute left-3 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Próximo"
                  onClick={() => go(1)}
                  className="absolute right-3 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
