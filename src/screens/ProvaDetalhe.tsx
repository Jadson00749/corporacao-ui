import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { activeLote, currentPrice, formatBRL, isSeniorOnlyDistance } from "@/lib/eventPricing";
import { LoteBreakdown } from "@/components/site/LoteBreakdown";
import {
  Calendar,
  MapPin,
  Clock,
  FileText,
  ExternalLink,
  Trophy,
  Users,
  Shirt,
  Package,
  Info,
  ScrollText,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Timer,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BannerFrame } from "@/components/site/BannerFrame";
import { bannerAspectClass } from "@/lib/bannerAspect";
import { PublicSignupList, type PublicSignup } from "@/components/site/PublicSignupList";



const fmt = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const statusBadge: Record<string, { label: string; className: string }> = {
  open: {
    label: "Inscrições abertas",
    className: "bg-success/15 text-success border-success/40",
  },
  soon: {
    label: "Em breve",
    className: "bg-warning/15 text-warning border-warning/40",
  },
  closed: {
    label: "Inscrições encerradas",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const ProvaDetalhe = () => {
  const { id } = useParams();
  const [listOpen, setListOpen] = useState(false);
  

  const { data: event, isLoading } = useQuery({
    queryKey: ["event_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lista pública: somente inscrições confirmadas (pendentes/canceladas não aparecem)
  const isPublicVisible = (s: PublicSignup) => s.status?.toLowerCase() === "confirmada";

  const { data: signupsCount = 0 } = useQuery({
    queryKey: ["event_signups_count", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_event_signups_public", { _event_id: id! });
      if (error) return 0;
      return (data ?? []).filter(isPublicVisible).length;
    },
  });

  const { data: signups = [], isLoading: loadingSignups } = useQuery({
    queryKey: ["event_signups_public", id],
    enabled: !!id && listOpen,
    queryFn: async (): Promise<PublicSignup[]> => {
      const { data, error } = await supabase.rpc("list_event_signups_public", { _event_id: id! });
      if (error) throw error;
      return ((data ?? []) as PublicSignup[]).filter(isPublicVisible);
    },
  });

  if (isLoading)
    return (
      <Layout>
        <div className="section-padding pt-32 container-page">
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  if (!event)
    return (
      <Layout>
        <div className="section-padding pt-32 container-page">
          <p>Prova não encontrada.</p>
        </div>
      </Layout>
    );

  const closed = event.status === "closed";
  const banner = event.banner_image || event.image;
  const mobileBanner = (event as any).banner_mobile_image || banner;
  const bannerRatio = (event as any).banner_aspect_ratio as string | undefined;
  const internal = event.internal_signup;
  const badge = statusBadge[event.status] ?? statusBadge.open;
  const slotsLeft = event.max_slots ? Math.max(event.max_slots - signupsCount, 0) : null;

  const kits = (Array.isArray(event.kit_options) ? (event.kit_options as any[]) : []).filter((k) => k?.name);
  const prices = (Array.isArray(event.distances) ? (event.distances as any[]) : []).filter(
    (d) => d?.distance && !isSeniorOnlyDistance(d.distance)
  );
  const docs = (Array.isArray(event.documents) ? (event.documents as { label: string; url: string }[]) : []).filter(
    (d) => d.url && d.label
  );
  const mapsQuery = encodeURIComponent(`${event.city}`);

  const tabs = [
    { id: "sobre", label: "Sobre" },
    ...(kits.length || event.kit_info ? [{ id: "kit", label: "Kit" }] : []),
    ...(event.regulation_url ? [{ id: "regulamento", label: "Regulamento" }] : []),
    ...(event.registration_deadline ? [{ id: "prazos", label: "Prazos" }] : []),
    { id: "local", label: "Localização" },
  ];

  const ctaHref = internal ? `/provas/${event.id}/inscricao` : event.registration_url;

  return (
    <Layout>
      <SEO
        title={`${event.name} — Provas`}
        description={event.description?.slice(0, 160)}
        image={event.banner_image || undefined}
      />


      <div className={cn("pt-24", closed ? "pb-16" : "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-16")}>
        <div className="container-page">
          {/* BREADCRUMB */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground pt-4">
            <Link to="/provas" className="hover:text-foreground transition-colors">
              Descobrir
            </Link>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="text-foreground truncate">{event.name}</span>
          </nav>

          {/* TABS */}
          <SectionTabs tabs={tabs} />


          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
            {/* COLUNA PRINCIPAL */}
            <div className="min-w-0 space-y-8">
              {/* BANNER */}
              <div className="rounded-2xl overflow-hidden border border-border/60 bg-card">
                {banner ? (
                  <>
                    {/* Mobile: usa arte específica quando existir */}
                    <BannerFrame
                      src={mobileBanner}
                      alt={`Banner ${event.name}`}
                      loading="eager"
                      className={cn("md:hidden", bannerAspectClass(bannerRatio))}
                    />
                    {/* Desktop: proporção natural da arte, encaixada no card */}
                    <img
                      src={banner}
                      alt={`Banner ${event.name}`}
                      loading="eager"
                      className="hidden md:block w-full h-auto"
                    />

                  </>
                ) : (
                  <div className="w-full aspect-[16/9] md:aspect-[21/9] bg-gradient-dark" />
                )}

                <div className="p-5 md:p-7">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border backdrop-blur-sm",
                      badge.className
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {badge.label.toUpperCase()}
                  </span>
                  <h1 className="mt-3 font-display text-2xl md:text-4xl font-bold leading-tight text-balance">
                    {event.name}
                  </h1>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                    {event.distance}
                  </p>
                </div>
              </div>


              {/* SOBRE */}
              {event.description && (
                <Block id="sobre" title="Sobre a prova">
                  <p className="whitespace-pre-line leading-relaxed text-sm text-foreground/80">{event.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-brand" /> {fmt(event.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-brand" /> {event.city}
                    </span>
                    {event.start_time && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-brand" /> Largada {event.start_time}
                      </span>
                    )}
                  </div>
                </Block>
              )}

              {/* KIT */}
              {(kits.length > 0 || event.kit_info) && (
                <Block id="kit" title="Kit do atleta">
                  {kits.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {kits.map((k, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-border/60 bg-card/60 p-4 hover:border-brand/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-brand shrink-0" />
                            <span className="font-semibold text-sm">{k.name}</span>
                          </div>
                          {k.description && (
                            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{k.description}</p>
                          )}
                          {k.extra_price > 0 && (
                            <p className="mt-1.5 text-xs text-brand font-semibold">
                              + {Number(k.extra_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-line leading-relaxed text-sm text-foreground/80">{event.kit_info}</p>
                  )}
                  {event.kit_delivery && (
                    <p className="mt-4 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      <strong className="text-foreground/80">Entrega do kit:</strong> {event.kit_delivery}
                    </p>
                  )}
                </Block>
              )}

              {/* VALORES */}
              {prices.some((d) => (d.price && d.price > 0) || (d.price_lote2 && d.price_lote2 > 0) || (d.price_lote3 && d.price_lote3 > 0)) && (
                <Block id="valores" title="Valores">
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {prices.map((d, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-border/60 bg-card/60 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-foreground/80">{d.distance}</span>
                          <span className="text-right">
                            <span className="font-semibold text-sm">{formatBRL(currentPrice(d))}</span>
                            <span className="block text-[10px] text-success font-semibold uppercase tracking-wide">
                              {activeLote(d)}º lote — atual
                            </span>
                          </span>
                        </div>
                        <LoteBreakdown distance={d} className="mt-2" />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Atletas com 60 anos ou mais têm 50% de desconto aplicado automaticamente na
                    inscrição, conforme a data de nascimento do cadastro.
                  </p>
                </Block>

              )}

              {/* REGULAMENTO + DOCUMENTOS */}
              {(event.regulation_url || docs.length > 0) && (
                <Block id="regulamento" title="Regulamento">
                  <div className="flex flex-wrap gap-3">
                    {event.regulation_url && (
                      <a
                        href={event.regulation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm font-medium hover:border-brand hover:text-brand transition-colors"
                      >
                        <FileText className="w-4 h-4" /> Acessar regulamento
                      </a>
                    )}
                    {docs.map((d, i) => (
                      <a
                        key={i}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm font-medium hover:border-brand hover:text-brand transition-colors"
                      >
                        <FileText className="w-4 h-4" /> {d.label} <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </a>
                    ))}
                  </div>
                </Block>
              )}

              {/* PRAZOS / INFOS */}
              {(event.registration_deadline || event.more_info) && (
                <Block id="prazos" title="Prazos e informações">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {event.registration_deadline && (
                      <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Calendar className="w-4 h-4 text-brand" /> Inscrições
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">até {fmt(event.registration_deadline)}</p>
                      </div>
                    )}
                    {slotsLeft !== null && (
                      <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-brand" /> Vagas restantes
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{slotsLeft} de {event.max_slots}</p>
                      </div>
                    )}
                  </div>
                  {event.more_info && (
                    <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/75">
                      {event.more_info}
                    </p>
                  )}
                </Block>
              )}

              {/* LOCALIZACAO */}
              <Block id="local" title="Localização">
                <p className="flex items-center gap-2 text-sm text-foreground/80">
                  <MapPin className="w-4 h-4 text-brand shrink-0" /> {event.city}
                </p>
                <div className="mt-3 rounded-xl overflow-hidden border border-border/60">
                  <iframe
                    title="Mapa da prova"
                    src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                    className="w-full h-[240px] border-0"
                    loading="lazy"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                >
                  Abrir no Google Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Block>
            </div>

            {/* SIDEBAR */}
            <aside className="lg:sticky lg:top-24 space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-4 shadow-elegant">
                <dl className="divide-y divide-border/50 text-sm">
                  <Row icon={Calendar} label="Data" value={fmt(event.date).toUpperCase()} />
                  <Row icon={MapPin} label="Local" value={event.city} />
                  {event.start_time && <Row icon={Clock} label="Largada" value={event.start_time} />}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      <Timer className="w-4 h-4" /> Faltam
                    </span>
                    <Countdown date={event.date} time={event.start_time} />
                  </div>
                </dl>

                <div className="mt-4 space-y-2">
                  <Button asChild variant={closed ? "outline" : "brand"} size="lg" className="w-full" disabled={closed}>
                    {internal ? (
                      <Link to={closed ? "#" : ctaHref} onClick={(e) => closed && e.preventDefault()}>
                        {closed ? "Encerrado" : "Inscrever-se"} {!closed && <ArrowRight className="w-4 h-4" />}
                      </Link>
                    ) : (
                      <a href={ctaHref} target="_blank" rel="noreferrer" onClick={(e) => closed && e.preventDefault()}>
                        {closed ? "Encerrado" : "Inscrever-se"} {!closed && <ExternalLink className="w-4 h-4" />}
                      </a>
                    )}
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="w-3 h-3" /> Pagamento seguro · Pix
                  </p>
                </div>
              </div>

              {event.registration_deadline && (
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
                  <Clock className="w-3 h-3" /> Inscrições até {fmt(event.registration_deadline)}
                </p>
              )}

              <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <p className="font-display font-semibold text-sm">Já fez sua inscrição?</p>
                <p className="text-xs text-muted-foreground mb-3">Alguns links rápidos:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setListOpen(true)}
                    className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-brand hover:text-brand transition-colors"
                  >
                    Lista de inscritos
                  </button>
                  <Link
                    to="/minha-conta"
                    className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-brand hover:text-brand transition-colors"
                  >
                    Minhas inscrições
                  </Link>
                  <Link
                    to="/contato"
                    className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs hover:border-brand hover:text-brand transition-colors"
                  >
                    Central de ajuda
                  </Link>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5 text-brand" /> {signupsCount} atletas confirmados
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>


      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de inscritos, {event.name}</DialogTitle>
          </DialogHeader>
          {loadingSignups && <div className="py-8 text-center text-muted-foreground">Carregando...</div>}
          {!loadingSignups && signups.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">Nenhum inscrito até o momento.</div>
          )}
          {!loadingSignups && (
            <PublicSignupList
              signups={signups}
              distances={prices.map((d: any) => String(d.distance))}
              genders={Array.isArray(event.genders) ? (event.genders as string[]) : null}
              ageBrackets={event.age_brackets}
            />
          )}


        </DialogContent>
      </Dialog>

      {/* CTA fixo no mobile */}
      {!closed && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {internal ? (
            <Button asChild variant="brand" size="lg" className="w-full">
              <Link to={ctaHref}>Inscrever-se</Link>
            </Button>
          ) : (
            <Button asChild variant="brand" size="lg" className="w-full">
              <a href={ctaHref} target="_blank" rel="noreferrer">Inscrever-se</a>
            </Button>
          )}
        </div>
      )}
    </Layout>
  );
};

const SectionTabs = ({ tabs }: { tabs: { id: string; label: string }[] }) => {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      let current = tabs[0]?.id;
      for (const t of tabs) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top - 170 <= 0) current = t.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tabs]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
    if (history.replaceState) history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="sticky top-[86px] z-30 -mx-4 px-4 mt-5 bg-background/95 backdrop-blur-md border-b border-border/60">
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-7 min-w-max">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => go(e, t.id)}
              className={cn(
                "relative py-3 text-sm font-medium whitespace-nowrap transition-colors",
                active === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {active === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand rounded-full" />}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

const Block = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-36">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">{title}</h2>
    {children}
  </section>
);

const Row = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      <Icon className="w-4 h-4" /> {label}
    </span>
    <span className="text-sm font-semibold text-right truncate">{value}</span>
  </div>
);

const Countdown = ({ date, time }: { date: string; time?: string | null }) => {
  const target = new Date(`${date}T${time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "07:00"}:00`).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(target - now, 0);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  const cell = (v: number, u: string) => (
    <span className="rounded-md bg-background/60 border border-border/60 px-1.5 py-1 text-xs font-bold tabular-nums">
      {String(v).padStart(2, "0")}
      <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">{u}</span>
    </span>
  );
  return (
    <div className="flex items-center gap-1">
      {cell(d, "d")}
      {cell(h, "h")}
      {cell(m, "m")}
      {cell(sec, "s")}
    </div>
  );
};

const InfoBlock = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-7 shadow-card">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
    </div>
    <div className="text-foreground/80 text-sm md:text-base">{children}</div>
  </div>
);

export default ProvaDetalhe;
