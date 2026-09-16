import { Link } from "@/lib/router-compat";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { RaceEvent, eventStatusLabel } from "@/data/events";
import { cn } from "@/lib/utils";
import { pickEventBannerDesktop, pickEventBannerMobile } from "@/lib/eventBannerFallback";
import { BannerFrame } from "@/components/site/BannerFrame";
import { currentPrice, isSeniorOnlyDistance } from "@/lib/eventPricing";
import { Button } from "@/components/ui/button";
import { partnerOrganizerPublicName } from "@/lib/eventOrganizer";

const statusStyle: Record<RaceEvent["status"], string> = {
  open: "bg-success/15 text-success border-success/30",
  soon: "bg-warning/15 text-warning border-warning/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export const EventCard = ({ event }: { event: RaceEvent }) => {
  const closed = event.status === "closed";
  const sources = {
    id: event.id,
    bannerImage: event.bannerImage,
    bannerMobileImage: event.bannerMobileImage,
    image: event.image,
  };
  const desktopBanner = pickEventBannerDesktop(sources);
  const mobileBanner = pickEventBannerMobile(sources);

  const modalities =
    (event.distances ?? [])
      .map((d) => d.distance)
      .filter(Boolean)
      .join(" • ") || event.distance;

  const signupHref = event.internalSignup
    ? `/provas/${event.id}/inscricao`
    : event.registrationUrl || `/provas/${event.id}`;
  const signupExternal = !event.internalSignup && !!event.registrationUrl;
  const detailsHref = `/provas/${event.id}`;

  const prices = (event.distances ?? [])
    .filter((d) => !isSeniorOnlyDistance(d.distance))
    .map((d) => currentPrice(d))
    .filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const partnerName = partnerOrganizerPublicName(event.organizerId, event.organizer);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden transition-all duration-500 hover:border-brand/40 hover:-translate-y-1",
        closed && "opacity-70"
      )}
    >
      {/* Desktop: card inteiro clicável (comportamento anterior) */}
      {!closed && (
        <Link
          to={detailsHref}
          className="absolute inset-0 z-10 hidden md:block"
          aria-label={`Ver detalhes de ${event.name}`}
        />
      )}

      <BannerFrame
        src={desktopBanner}
        mobileSrc={mobileBanner}
        alt={`Banner ${event.name}`}
        className="aspect-[16/9] shrink-0"
        imgClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.02]"
      />

      {/* Conteúdo — badge abaixo da imagem, sem cobrir a arte */}
      <div className="relative z-20 flex flex-1 flex-col p-4 sm:p-5 md:p-6 md:pointer-events-none">
        <span
          className={cn(
            "mb-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
            statusStyle[event.status]
          )}
        >
          {event.status === "open" && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          )}
          {eventStatusLabel[event.status]}
        </span>

        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.28em] text-brand">
            {modalities}
          </p>
          {minPrice != null && (
            <span className="inline-flex shrink-0 items-baseline gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/70">
              A partir de
              <strong className="text-sm font-semibold normal-case tracking-normal text-brand">
                {minPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </span>
          )}
        </div>

        <h3 className="font-display text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-brand sm:text-xl md:line-clamp-2">
          {event.name}
        </h3>

        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground md:mt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="break-words">{event.city}</span>
          </div>
          {partnerName ? (
            <p className="pt-0.5 text-xs text-muted-foreground/90">
              Organizador: <span className="font-medium text-foreground/75">{partnerName}</span>
            </p>
          ) : null}
        </div>

        {/* Mobile: CTAs empilhados */}
        <div className="mt-auto flex flex-col gap-2 pt-4 md:hidden">
          {!closed ? (
            <>
              <Button asChild variant="brand" className="w-full">
                {signupExternal ? (
                  <a href={signupHref} target="_blank" rel="noreferrer">
                    Inscrever-se
                  </a>
                ) : (
                  <Link to={signupHref}>Inscrever-se</Link>
                )}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={detailsHref}>Ver detalhes</Link>
              </Button>
            </>
          ) : (
            <p className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inscrições encerradas
            </p>
          )}
        </div>

        {/* Desktop: CTA textual */}
        <div className="mt-5 hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground md:inline-flex">
          {closed ? "Inscrições encerradas" : "Ver detalhes"}
          {!closed && (
            <>
              <span className="h-px w-5 bg-foreground/40 transition-all duration-300 group-hover:w-10 group-hover:bg-brand" />
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
            </>
          )}
        </div>
      </div>
    </article>
  );
};
