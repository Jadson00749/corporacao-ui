import { Link } from "@/lib/router-compat";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { useEvents } from "@/hooks/useContent";
import { getEventBannerFallback } from "@/lib/eventBannerFallback";
import { eventStatusLabel, type RaceEvent } from "@/data/events";
import { cn } from "@/lib/utils";
import { BannerFrame } from "@/components/site/BannerFrame";


const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusStyle: Record<RaceEvent["status"], string> = {
  open: "bg-brand/20 text-brand border-brand/40",
  soon: "bg-warning/15 text-warning border-warning/30",
  closed: "bg-white/10 text-white/60 border-white/15",
};

const RaceCard = ({ event }: { event: RaceEvent }) => {
  const closed = event.status === "closed";
  const banner = event.bannerImage || event.image || getEventBannerFallback(event.id);
  const distances = (event.distances ?? [])
    .map((d: any) => d?.label ?? d?.distance ?? d?.name)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <Link
      to={closed ? "#" : `/provas/${event.id}`}
      onClick={(e) => closed && e.preventDefault()}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl transition-all duration-500 hover:border-brand/40 hover:-translate-y-1",
        closed && "opacity-70 pointer-events-none"
      )}
    >
      <BannerFrame src={banner} alt={`Banner ${event.name}`} className="aspect-[16/9]" imgClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] backdrop-blur-md",
            statusStyle[event.status]
          )}
        >
          {event.status === "open" && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
          {eventStatusLabel[event.status]}
        </span>
      </BannerFrame>


      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[1.05rem] sm:text-xl font-semibold leading-snug text-white line-clamp-2 group-hover:text-brand transition-colors">
          {event.name}
        </h3>

        <div className="mt-3 space-y-1.5 text-[12.5px] text-white/65">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0 text-brand" />
            <span className="truncate">{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-brand" />
            <span className="truncate">{event.city}</span>
          </div>
        </div>

        {(distances.length > 0 || event.distance) && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {(distances.length ? distances : [event.distance]).map((d, i) => (
              <span
                key={i}
                className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-medium text-white/70"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">
          <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            {closed ? "Inscrições encerradas" : event.status === "open" ? "Inscreva-se" : "Ver prova"}
            {!closed && <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />}
          </span>
        </div>
      </div>
    </Link>
  );
};

export const UpcomingRacesSection = () => {
  const { data: events = [] } = useEvents();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.status !== "closed" && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const list = upcoming.length ? upcoming : events.filter((e) => e.status !== "closed").slice(0, 6);

  if (!list.length) return null;

  return (
    <section
      id="proximas-provas"
      aria-label="Próximas provas"
      className="relative overflow-hidden bg-[#070707] py-14 sm:py-20"
    >
      {/* transição suave vinda do hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-60px] w-[380px] h-[380px] rounded-full opacity-[0.10] blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />

      <div className="container-page relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
              Próximas provas
            </span>
            <h2 className="mt-3 font-display text-[1.6rem] sm:text-4xl font-semibold tracking-[-0.02em] text-white">
              Qual vai ser a sua próxima?
            </h2>
          </div>
          <Link
            to="/provas"
            className="group hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-brand transition-colors"
          >
            Ver todas as provas
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Mobile: carrossel por swipe */}
        <div className="md:hidden -mx-5 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 no-scrollbar [scroll-padding-left:1.25rem]">
          {list.map((e) => (
            <div key={e.id} className="snap-start shrink-0 w-[84%] flex">
              <RaceCard event={e} />
            </div>
          ))}
        </div>

        {/* Desktop: grid */}
        <div className="mt-9 hidden md:grid md:grid-cols-3 gap-6">
          {list.slice(0, 3).map((e) => (
            <RaceCard key={e.id} event={e} />
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Link
            to="/provas"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-[13px] font-semibold text-white/85 backdrop-blur-sm transition-colors hover:text-brand"
          >
            Ver todas as provas
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* transição suave para a próxima seção */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};
