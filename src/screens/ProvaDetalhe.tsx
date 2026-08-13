import { useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type PublicSignup = { full_name: string; city: string; team_name: string; category: string; status: string; gender: string; age: number | null };
type GenderFilter = "all" | "F" | "M";

const normalizeGender = (g: string): "F" | "M" | "O" => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return "O";
};

// Extrai a distância (ex: "10K") da categoria "10K · Masculino"
const extractDistance = (category: string): string => {
  if (!category) return "Distância não informada";
  return category.split("·")[0].trim().toUpperCase() || "Distância não informada";
};

// Faixas etárias padrão (usadas quando o evento não tem age_brackets configurado)
const DEFAULT_AGE_BRACKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "14 A 24 ANOS", min: 14, max: 24 },
  { label: "25 A 34 ANOS", min: 25, max: 34 },
  { label: "35 A 44 ANOS", min: 35, max: 44 },
  { label: "45 A 54 ANOS", min: 45, max: 54 },
  { label: "55 A 64 ANOS", min: 55, max: 64 },
  { label: "65+ ANOS", min: 65, max: 200 },
];

const getAgeBracket = (age: number | null): string => {
  if (age == null) return "IDADE NÃO INFORMADA";
  const b = DEFAULT_AGE_BRACKETS.find((br) => age >= br.min && age <= br.max);
  return b ? b.label : "IDADE NÃO INFORMADA";
};


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
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  const { data: event, isLoading } = useQuery({
    queryKey: ["event_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: signupsCount = 0 } = useQuery({
    queryKey: ["event_signups_count", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_event_signups_public", { _event_id: id! });
      if (error) return 0;
      return (data ?? []).filter((s: PublicSignup) => s.status?.toLowerCase() !== "cancelada").length;
    },
  });

  const { data: signups = [], isLoading: loadingSignups } = useQuery({
    queryKey: ["event_signups_public", id],
    enabled: !!id && listOpen,
    queryFn: async (): Promise<PublicSignup[]> => {
      const { data, error } = await supabase.rpc("list_event_signups_public", { _event_id: id! });
      if (error) throw error;
      return (data ?? []) as PublicSignup[];
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
  const internal = event.internal_signup;
  const badge = statusBadge[event.status] ?? statusBadge.open;
  const slotsLeft = event.max_slots ? Math.max(event.max_slots - signupsCount, 0) : null;

  return (
    <Layout>
      <SEO title={`${event.name} | Provas`} description={event.description?.slice(0, 160)} />

      {/* HERO */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        {banner ? (
          <div className="absolute inset-0">
            <img
              src={banner}
              alt={`Banner ${event.name}`}
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.7) saturate(1.05)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-dark" />
        )}

        <div className="container-page relative pt-12 md:pt-20 pb-8">
          <Link
            to="/provas"
            className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-brand mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para provas
          </Link>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border backdrop-blur-sm",
                  badge.className
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {badge.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand backdrop-blur-sm">
                <Trophy className="w-3.5 h-3.5" /> {event.distance}
              </span>
              {signupsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-card/60 text-foreground/80 backdrop-blur-sm">
                  <Users className="w-3.5 h-3.5" /> {signupsCount} atletas inscritos
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight text-balance mb-4">
              {event.name}
            </h1>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/85">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand" /> {fmt(event.date)}
              </span>
              {event.start_time && (
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand" /> Largada {event.start_time}
                </span>
              )}
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" /> {event.city}
              </span>
            </div>

            <p className="mt-6 text-base md:text-lg text-foreground/80 max-w-2xl flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <span>Prova mapeada pela Corporação: planilha de preparação individual e orientação dos coaches pra você chegar pronto na largada.</span>
            </p>
          </div>
        </div>
      </section>

      {/* CONTEUDO */}
      <section className="pb-20">
        <div className="container-page">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {event.description && (
                <InfoBlock icon={Info} title="Sobre a prova">
                  <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
                </InfoBlock>
              )}

              {event.kit_info && (
                <InfoBlock icon={Shirt} title="Kit do atleta">
                  <p className="whitespace-pre-line leading-relaxed">{event.kit_info}</p>
                </InfoBlock>
              )}

              {event.kit_delivery && (
                <InfoBlock icon={Package} title="Entrega do kit">
                  <p className="whitespace-pre-line leading-relaxed">{event.kit_delivery}</p>
                </InfoBlock>
              )}

              {event.more_info && (
                <InfoBlock icon={Info} title="Informações importantes">
                  <p className="whitespace-pre-line leading-relaxed">{event.more_info}</p>
                </InfoBlock>
              )}

              {Array.isArray(event.documents) && event.documents.length > 0 && (
                <InfoBlock icon={FileText} title="Documentos de apoio">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {(event.documents as { label: string; url: string }[])
                      .filter((d) => d.url && d.label)
                      .map((d, i) => (
                        <a
                          key={i}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-background/50 hover:border-brand hover:bg-brand/5 hover:-translate-y-0.5 transition-all"
                        >
                          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-brand-foreground transition">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{d.label}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              Abrir documento <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        </a>
                      ))}
                  </div>
                </InfoBlock>
              )}

              {event.regulation_url && (
                <InfoBlock icon={ScrollText} title="Regulamento">
                  <p className="text-foreground/70 mb-3">
                    Leia o regulamento completo da prova antes de se inscrever.
                  </p>
                  <a
                    href={event.regulation_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-brand font-semibold hover:underline"
                  >
                    <FileText className="w-4 h-4" /> Abrir regulamento <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </InfoBlock>
              )}
            </div>

            {/* SIDEBAR PREMIUM */}
            <aside className="lg:col-span-1">
              <div className="sticky top-28 space-y-4">
                <div className="relative rounded-2xl p-6 border border-border/60 bg-card/80 backdrop-blur-md shadow-elegant overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-brand/20 blur-3xl pointer-events-none" />

                  <div className="relative space-y-5">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border",
                          badge.className
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {badge.label}
                      </span>
                    </div>

                    <div>
                      <h2 className="font-display text-2xl font-bold mb-1">Garanta sua vaga</h2>
                      <p className="text-sm text-muted-foreground">
                        {closed
                          ? "As inscrições para esta prova estão encerradas."
                          : event.status === "soon"
                          ? "As inscrições abrem em breve."
                          : "Treine e participe com a equipe."}
                      </p>
                    </div>

                    <ul className="space-y-2.5 text-sm">
                      {event.distance && (
                        <li className="flex items-center gap-2.5">
                          <Trophy className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-foreground/80">Distâncias: <strong className="text-foreground">{event.distance}</strong></span>
                        </li>
                      )}
                      {event.start_time && (
                        <li className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-foreground/80">Largada às <strong className="text-foreground">{event.start_time}</strong></span>
                        </li>
                      )}
                      {event.kit_info && (
                        <li className="flex items-center gap-2.5">
                          <Shirt className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-foreground/80">Kit do atleta incluso</span>
                        </li>
                      )}
                      {event.registration_deadline && (
                        <li className="flex items-center gap-2.5">
                          <Calendar className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-foreground/80">Inscrições até <strong className="text-foreground">{fmt(event.registration_deadline)}</strong></span>
                        </li>
                      )}
                      {slotsLeft !== null && (
                        <li className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                          <span className="text-foreground/80">
                            <strong className="text-foreground">{slotsLeft}</strong> vagas restantes
                          </span>
                        </li>
                      )}
                      <li className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-brand shrink-0" />
                        <span className="text-foreground/80">
                          <strong className="text-foreground">{signupsCount}</strong> atletas da equipe confirmados
                        </span>
                      </li>
                    </ul>

                    {Array.isArray(event.distances) && (event.distances as any[]).some((d) => (d.price && d.price > 0) || (d.price_lote2 && d.price_lote2 > 0)) && (
                      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                        <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
                          Valores da inscrição
                        </div>
                        <ul className="space-y-2 text-sm">
                          {(event.distances as any[])
                            .filter((d) => d.distance)
                            .map((d, i) => {
                              const today = new Date().toISOString().slice(0, 10);
                              const hasLote2 = d.price_lote2 && d.price_lote2 > 0 && d.lote2_starts_at;
                              const lote2Active = hasLote2 && today >= d.lote2_starts_at;
                              const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                              const fmtDate = (iso: string) => { const [y,m,dd] = iso.split("-"); return `${dd}/${m}/${y}`; };
                              return (
                                <li key={i} className="flex items-center justify-between gap-3">
                                  <span className="text-foreground/80">{d.distance}</span>
                                  <span className="text-right">
                                    <span className="font-semibold text-foreground">
                                      {fmt(lote2Active ? d.price_lote2 : (d.price ?? 0))}
                                    </span>
                                    {hasLote2 && (
                                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                                        {lote2Active
                                          ? `2º lote (desde ${fmtDate(d.lote2_starts_at)})`
                                          : `2º lote: ${fmt(d.price_lote2)} a partir de ${fmtDate(d.lote2_starts_at)}`}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                        {Array.isArray(event.kit_options) && (event.kit_options as { name: string; extra_price?: number }[]).some((k) => k.extra_price && k.extra_price > 0) && (
                          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                            Opções de kit podem ter valor adicional, calculado na inscrição.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      {internal ? (
                        <Button
                          asChild
                          variant={closed ? "outline" : "brand"}
                          size="lg"
                          className="w-full"
                          disabled={closed}
                        >
                          <Link
                            to={closed ? "#" : `/provas/${event.id}/inscricao`}
                            onClick={(e) => closed && e.preventDefault()}
                          >
                            {closed ? "Encerrado" : "Inscrever-se na prova"}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          variant={closed ? "outline" : "brand"}
                          size="lg"
                          className="w-full"
                          disabled={closed}
                        >
                          <a
                            href={event.registration_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => closed && e.preventDefault()}
                          >
                            {closed ? "Encerrado" : "Acessar inscrição"}{" "}
                            {!closed && <ExternalLink className="w-4 h-4" />}
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => setListOpen(true)}
                      >
                        <Users className="w-4 h-4" /> Ver lista de inscritos
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-5 border border-brand/20 bg-brand/5 text-sm text-foreground/85 leading-relaxed">
                  <p className="font-display font-semibold text-foreground mb-1">
                    Preparação sob medida.
                  </p>
                  <p>Sua planilha é ajustada com foco nessa prova e o coach acompanha sua evolução até a largada.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de inscritos, {event.name}</DialogTitle>
          </DialogHeader>
          {loadingSignups && <div className="py-8 text-center text-muted-foreground">Carregando...</div>}
          {!loadingSignups && signups.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">Nenhum inscrito até o momento.</div>
          )}
          {!loadingSignups && signups.length > 0 && (() => {
            const totals = signups.reduce(
              (acc, s) => {
                const g = normalizeGender(s.gender);
                if (g === "F") acc.F += 1;
                else if (g === "M") acc.M += 1;
                return acc;
              },
              { F: 0, M: 0 }
            );

            const filtered =
              genderFilter === "all"
                ? signups
                : signups.filter((s) => normalizeGender(s.gender) === genderFilter);

            // Agrupa por distância e depois por faixa etária
            const grouped: Record<string, Record<string, PublicSignup[]>> = {};
            for (const s of filtered) {
              const dist = extractDistance(s.category);
              const bracket = getAgeBracket(s.age);
              grouped[dist] = grouped[dist] || {};
              grouped[dist][bracket] = grouped[dist][bracket] || [];
              grouped[dist][bracket].push(s);
            }

            // Ordena distâncias (5K, 10K, 21K, 42K) e faixas etárias pela ordem padrão
            const distOrder = Object.keys(grouped).sort((a, b) => {
              const na = parseInt(a) || 999;
              const nb = parseInt(b) || 999;
              return na - nb;
            });
            const bracketOrder = (label: string) => {
              const idx = DEFAULT_AGE_BRACKETS.findIndex((b) => b.label === label);
              return idx === -1 ? 999 : idx;
            };

            const filterBtn = (value: GenderFilter, label: string, count?: number) => (
              <button
                key={value}
                type="button"
                onClick={() => setGenderFilter(value)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-all",
                  genderFilter === value
                    ? "bg-brand text-brand-foreground border-brand"
                    : "bg-transparent text-muted-foreground border-border hover:border-brand/50 hover:text-foreground"
                )}
              >
                {label}
                {typeof count === "number" && (
                  <span className="ml-1.5 opacity-70">({count})</span>
                )}
              </button>
            );

            return (
              <div className="space-y-6">
                {/* Filtros de sexo */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                    Filtrar:
                  </span>
                  {filterBtn("all", "Todos", signups.length)}
                  {filterBtn("F", "Feminino", totals.F)}
                  {filterBtn("M", "Masculino", totals.M)}
                </div>

                {distOrder.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum inscrito nesse filtro.
                  </div>
                )}

                {distOrder.map((dist) => {
                  const brackets = grouped[dist];
                  const total = Object.values(brackets).reduce((acc, arr) => acc + arr.length, 0);
                  const sortedBrackets = Object.keys(brackets).sort(
                    (a, b) => bracketOrder(a) - bracketOrder(b)
                  );

                  return (
                    <div key={dist} className="space-y-4">
                      {/* Cabeçalho da distância */}
                      <div className="flex items-baseline gap-2 pb-1 border-b border-brand/30">
                        <h2 className="font-display font-bold text-base uppercase tracking-wide text-brand">
                          {dist}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          ({total} {total === 1 ? "atleta" : "atletas"})
                        </span>
                      </div>

                      {sortedBrackets.map((bracket) => {
                        const list = brackets[bracket];
                        return (
                          <div key={bracket} className="space-y-2">
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-foreground/80">
                              {bracket} <span className="text-muted-foreground font-normal">({list.length})</span>
                            </h3>
                            <div className="border border-border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                                  <tr>
                                    <th className="text-left px-3 py-2">Nome</th>
                                    <th className="text-left px-3 py-2">Cidade</th>
                                    <th className="text-left px-3 py-2">Equipe</th>
                                    <th className="text-left px-3 py-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {list.map((s, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 capitalize">{s.full_name.toLowerCase()}</td>
                                      <td className="px-3 py-2 capitalize">{s.city.toLowerCase()}</td>
                                      <td className="px-3 py-2 capitalize">{s.team_name.toLowerCase()}</td>
                                      <td className="px-3 py-2 capitalize">{s.status.toLowerCase()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
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
