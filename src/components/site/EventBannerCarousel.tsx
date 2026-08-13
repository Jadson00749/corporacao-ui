import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RaceEvent } from "@/data/events";
import { getEventBannerFallback } from "@/lib/eventBannerFallback";

const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

type Props = { events: RaceEvent[] };

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
  const banner = current.bannerImage || current.image || getEventBannerFallback(current.id);
  const signupHref = current.internalSignup
    ? `/provas/${current.id}/inscricao`
    : current.registrationUrl || `/provas/${current.id}`;
  const signupExternal = !current.internalSignup && !!current.registrationUrl;

  const go = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + open.length) % open.length);

  return (
    <section className="relative">
      <div className="container-page pt-8 md:pt-12">
        <div className="relative rounded-2xl overflow-hidden shadow-card border border-border h-[420px] md:h-[480px]">
          {open.map((ev, i) => {
            const bg = ev.bannerImage || ev.image || getEventBannerFallback(ev.id);
            return (
              <img
                key={ev.id}
                src={bg}
                alt={`Banner ${ev.name}`}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
                  i === index ? "opacity-100" : "opacity-0"
                )}
              />
            );
          })}

          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />

          <div className="relative h-full flex flex-col justify-end p-6 md:p-12 max-w-3xl">
            <span className="inline-block w-fit text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full bg-success text-white mb-4">
              Inscrições abertas
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white text-balance">
              {current.name}
            </h2>
            <p className="mt-2 text-brand-glow font-semibold">{current.distance}</p>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-glow" />
                <span>{formatDate(current.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-glow" />
                <span>{current.city}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="brand">
                {signupExternal ? (
                  <a href={signupHref} target="_blank" rel="noreferrer">
                    Inscrever-se
                  </a>
                ) : (
                  <Link to={signupHref}>Inscrever-se</Link>
                )}
              </Button>
              <Button asChild variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
                <Link to={`/provas/${current.id}`}>Ver detalhes</Link>
              </Button>
            </div>
          </div>

          {open.length > 1 && (
            <>
              <button
                aria-label="Anterior"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                aria-label="Próximo"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 right-6 flex gap-2">
                {open.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Ir para slide ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === index ? "bg-brand-glow w-8" : "bg-white/40 w-4 hover:bg-white/70"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
