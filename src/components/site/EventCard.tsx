import { Link } from "@/lib/router-compat";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { RaceEvent, eventStatusLabel } from "@/data/events";
import { cn } from "@/lib/utils";
import { getEventBannerFallback } from "@/lib/eventBannerFallback";
import { BannerFrame } from "@/components/site/BannerFrame";
import { currentPrice, isSeniorOnlyDistance } from "@/lib/eventPricing";
import { Button } from "@/components/ui/button";

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
  const banner =
    event.bannerMobileImage ||
    event.bannerImage ||
    event.image ||
    getEventBannerFallback(event.id);

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

      {/* Imagem: só selo de status por cima */}
      <BannerFrame
        src={banner}
        alt={`Banner ${event.name}`}
        className="aspect-[16/10] md:aspect-[16/9] transition-transform duration-[1200ms] ease-out"
        imgClassName={cn(
          "transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]",
          "object-cover object-center md:object-contain"
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent md:from-black/50"
        />
        <span
          className={cn(
            "absolute top-3 left-3 z-[1] inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1 rounded-full border backdrop-blur-sm",
            statusStyle[event.status]
          )}
        >
          {event.status === "open" && (
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          )}
          {eventStatusLabel[event.status]}
        </span>
      </BannerFrame>

      {/* Conteúdo em fundo sólido do card */}
      <div className="relative z-20 flex flex-1 flex-col p-4 sm:p-5 md:p-6 md:pointer-events-none">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-brand leading-snug">
            {modalities}
          </p>
          {minPrice != null && (
            <span className="shrink-0 inline-flex items-baseline gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-foreground/70">
              A partir de
              <strong className="text-sm tracking-normal normal-case text-brand">
                {minPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </span>
          )}
        </div>

        <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground leading-snug md:line-clamp-2 group-hover:text-brand transition-colors">
          {event.name}
        </h3>

        <div className="mt-3 md:mt-4 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-brand" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-brand" />
            <span className="break-words">{event.city}</span>
          </div>
        </div>

        {/* Mobile: CTAs empilhados em largura total */}
        <div className="mt-auto pt-4 flex flex-col gap-2 md:hidden">
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
            <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground text-center py-2">
              Inscrições encerradas
            </p>
          )}
        </div>

        {/* Desktop: CTA textual atual (clique via overlay) */}
        <div className="mt-5 hidden md:inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground">
          {closed ? "Inscrições encerradas" : "Ver detalhes"}
          {!closed && (
            <>
              <span className="w-5 h-px bg-foreground/40 group-hover:w-10 group-hover:bg-brand transition-all duration-300" />
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </>
          )}
        </div>
      </div>
    </article>
  );
};
