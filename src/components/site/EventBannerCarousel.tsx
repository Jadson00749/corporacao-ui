import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
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

/** Só carrega slide atual e vizinhos (±1); demais ficam de fora do DOM. */
const shouldLoadSlide = (i: number, index: number, len: number) => {
  if (len <= 3) return true;
  if (i === index) return true;
  if (i === (index - 1 + len) % len) return true;
  if (i === (index + 1) % len) return true;
  return false;
};

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

  const renderSignup = (fullWidth: boolean) => (
    <Button asChild variant="brand" className={fullWidth ? "w-full" : undefined}>
      {signupExternal ? (
        <a href={signupHref} target="_blank" rel="noreferrer">
          Inscrever-se
        </a>
      ) : (
        <Link to={signupHref}>Inscrever-se</Link>
      )}
    </Button>
  );

  const renderDetails = (variant: "mobile" | "desktop") => (
    <Button
      asChild
      variant="outline"
      className={
        variant === "mobile"
          ? "w-full"
          : "bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white"
      }
    >
      <Link to={`/provas/${current.id}`}>Ver detalhes</Link>
    </Button>
  );

  return (
    <section className="relative">
      <div className="container-page pt-4 md:pt-12">
        {/* ── Mobile: card vertical (imagem → conteúdo sólido) ── */}
        <div className="md:hidden rounded-2xl overflow-hidden border border-border bg-card shadow-card">
          <div className="relative aspect-[16/10] bg-[#0b0b0b]">
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
                  <img
                    src={bg}
                    alt={active ? `Banner ${ev.name}` : ""}
                    width={800}
                    height={500}
                    loading={active ? "eager" : "lazy"}
                    fetchPriority={active ? "high" : "low"}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </div>
              );
            })}

            <span className="absolute top-3 left-3 z-[1] inline-block w-fit text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-success text-white shadow-sm">
              Inscrições abertas
            </span>

            {open.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-[1] w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Próximo"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-[1] w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <h2 className="font-display text-[1.35rem] font-semibold text-foreground leading-snug text-balance">
              {current.name}
            </h2>

            {modalities && (
              <p className="text-sm font-medium text-brand leading-snug">{modalities}</p>
            )}

            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-brand" />
                <span>{formatDate(current.date)}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-brand" />
                <span className="break-words">{current.city}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {renderSignup(true)}
              {renderDetails("mobile")}
            </div>

            {open.length > 1 && (
              <div className="flex justify-center gap-2 pt-1">
                {open.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ir para slide ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === index ? "bg-brand w-8" : "bg-border w-4"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop: composição atual preservada ── */}
        <div className="relative hidden md:block rounded-2xl overflow-hidden shadow-card border border-border bg-[#0b0b0b] aspect-[21/9]">
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
                <img
                  src={bg}
                  alt=""
                  aria-hidden
                  loading={active ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                />
                <img
                  src={bg}
                  alt={active ? `Banner ${ev.name}` : ""}
                  loading={active ? "eager" : "lazy"}
                  decoding="async"
                  className="relative w-full h-full object-contain"
                />
              </div>
            );
          })}

          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />

          <div className="relative h-full flex flex-col justify-end p-12 max-w-3xl">
            <span className="inline-block w-fit text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full bg-success text-white mb-4">
              Inscrições abertas
            </span>
            <h2 className="font-display text-5xl font-bold text-white text-balance">
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
              {renderSignup(false)}
              {renderDetails("desktop")}
            </div>
          </div>

          {open.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
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
                    type="button"
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
