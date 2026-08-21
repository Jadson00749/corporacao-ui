import { Link } from "@/lib/router-compat";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { RaceEvent, eventStatusLabel } from "@/data/events";
import { cn } from "@/lib/utils";
import { getEventBannerFallback } from "@/lib/eventBannerFallback";
import { BannerFrame } from "@/components/site/BannerFrame";
import { currentPrice, isSeniorOnlyDistance } from "@/lib/eventPricing";


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
  const banner = event.bannerImage || event.image || getEventBannerFallback(event.id);
  return (
    <Link
      to={closed ? "#" : `/provas/${event.id}`}
      onClick={(e) => closed && e.preventDefault()}
      className={cn(
        "group block rounded-2xl border border-border/60 bg-card overflow-hidden transition-all duration-500 hover:border-brand/40 hover:-translate-y-1",
        closed && "opacity-70 pointer-events-none"
      )}
    >
      <BannerFrame
        src={banner}
        alt={`Banner ${event.name}`}
        className="aspect-[16/9] transition-transform duration-[1200ms] ease-out"
        imgClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
      >
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] uppercase px-2.5 py-1 rounded-full border backdrop-blur-sm",
            statusStyle[event.status]
          )}
        >
          {event.status === "open" && (
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          )}
          {eventStatusLabel[event.status]}
        </span>
      </BannerFrame>


      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-brand">
            {event.distance}
          </p>
          {(() => {
            const prices = (event.distances ?? [])
              .filter((d: any) => !isSeniorOnlyDistance(d?.distance))
              .map((d: any) => currentPrice(d))
              .filter((p: number) => p > 0);
            if (!prices.length) return null;
            const min = Math.min(...prices);
            return (
              <span className="shrink-0 inline-flex items-baseline gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-foreground/70">
                A partir de
                <strong className="text-sm tracking-normal normal-case text-brand">
                  {min.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </span>
            );
          })()}
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-brand transition-colors">
          {event.name}
        </h3>

        <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-brand" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-brand" />
            <span>{event.city}</span>
          </div>
        </div>

        <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-foreground">
          {closed ? "Inscrições encerradas" : "Ver detalhes"}
          {!closed && (
            <>
              <span className="w-5 h-px bg-foreground/40 group-hover:w-10 group-hover:bg-brand transition-all duration-300" />
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </>
          )}
        </div>
      </div>
    </Link>
  );
};
