import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans, useTrainings, useEvents, useProducts, useGallery, useTestimonials, useFaqs } from "@/hooks/useContent";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import { signupValue, type ExportSignup, type EventPricingRow } from "@/lib/exportSignupsXlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Trophy, Wallet, Clock, Percent, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttentionNeeded, type AttentionItem } from "@/components/site/AttentionNeeded";
import { EmptyState } from "@/components/site/EmptyState";
import { OrganizerActivationChecklist } from "@/components/admin/OrganizerActivationChecklist";
import { isOrganizerPaymentReady, useOrganizerPayment } from "@/lib/eventPayment";
import { statusOf } from "@/lib/rentalOrders";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const PERIODS = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

type AdminPricingRow = EventPricingRow & { organizer_id?: string | null };

const Kpi = ({
  icon: Icon,
  label,
  value,
  hint,
  hint2,
  accent,
  compact,
  to,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  hint2?: string;
  accent?: boolean;
  compact?: boolean;
  to?: string;
}) => {
  const className = cn(
    "rounded-xl border h-full flex flex-col text-left transition-colors",
    compact ? "p-3.5" : "p-4",
    accent ? "border-brand/40 bg-brand/10" : "border-border bg-card",
    to &&
      "hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 cursor-pointer"
  );

  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", accent && "text-brand")} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "font-display font-bold mt-2 tabular-nums leading-none",
          compact ? "text-2xl" : "text-[1.75rem] sm:text-3xl",
          accent && "text-brand"
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-2 leading-snug">{hint}</div>}
      {hint2 && <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{hint2}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
};

const SectionLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80", className)}>
    {children}
  </h2>
);

const MiniCard = ({ title, count, to }: { title: string; count: number; to: string }) => (
  <Link to={to} className="bg-card border border-border rounded-xl p-4 hover-lift block">
    <div className="text-xs text-muted-foreground">{title}</div>
    <div className="font-display text-2xl font-bold mt-1">{count}</div>
  </Link>
);

const AdminDashboard = () => {
  const { user, isAdmin, organizerId } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("30");

  const { data: plans = [] } = usePlans();
  const { data: trainings = [] } = useTrainings();
  const { data: eventsList = [] } = useEvents();
  const { data: products = [] } = useProducts();
  const { data: gallery = [] } = useGallery();
  const { data: testimonials = [] } = useTestimonials();
  const { data: faqs = [] } = useFaqs();

  const { data: pricing = [] } = useQuery({
    queryKey: ["admin_events_pricing", isAdmin ? "all" : organizerId],
    queryFn: async (): Promise<AdminPricingRow[]> => {
      let q = supabase.from("events").select("id,name,date,distances,organizer_id");
      if (!isAdmin && organizerId) q = q.eq("organizer_id" as any, organizerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: isAdmin || !!organizerId,
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin_members_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: organizers = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin_dashboard_organizers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("organizers")
        .select("id,name,commission_percentage");
      if (error) throw error;
      return ((data ?? []) as unknown) as { id: string; name: string; commission_percentage: number | null }[];
    },
  });

  const { data: signups = [], isLoading: loadingSignups, isError: signupsError, refetch: refetchSignups } = useQuery({
    queryKey: ["admin_signups_metrics", isAdmin ? "all" : organizerId, pricing.map((e) => e.id).join(",")],
    enabled: isAdmin || !!organizerId,
    queryFn: async (): Promise<ExportSignup[]> => {
      const ids = pricing.map((e) => e.id);
      let sq = supabase
        .from("event_signups")
        .select("*, events(id,name,date,city)")
        .order("created_at", { ascending: false });
      if (!isAdmin) {
        if (!ids.length) return [];
        sq = sq.in("event_id", ids);
      }
      const { data, error } = await sq;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,full_name,cpf,email,whatsapp,team_name,city,state,gender,birth_date")
          .in("user_id", userIds);
        const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => {
          r.profiles = map.get(r.user_id) ?? null;
        });
      }
      return rows as ExportSignup[];
    },
  });

  const { data: organizerPayment } = useOrganizerPayment(!isAdmin ? organizerId : null);

  const { data: rentalRows = [] } = useQuery({
    queryKey: ["admin_dashboard_rentals", isAdmin ? "all" : organizerId],
    enabled: isAdmin || !!organizerId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("rental_orders")
        .select("id,status,event_name,event_date,organizer_id")
        .neq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (!isAdmin && organizerId) q = q.eq("organizer_id", organizerId);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as { id: string; status: string; event_name: string | null; event_date: string | null; organizer_id: string }[];
    },
  });

  const loading = (isAdmin && loadingMembers) || loadingSignups;

  const organizerMap = useMemo(
    () => new Map(organizers.map((o) => [o.id, o])),
    [organizers]
  );

  const since = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    return d;
  }, [period]);

  const inPeriod = (iso?: string | null) => {
    if (!since) return true;
    if (!iso) return false;
    return new Date(iso) >= since;
  };

  const metrics = useMemo(() => {
    const priceMap = new Map(pricing.map((e) => [e.id, e]));
    const rows = signups.filter((s) => inPeriod(s.created_at));

    let confirmed = 0;
    let pending = 0;
    let canceled = 0;
    let revenue = 0;
    let pendingRevenue = 0;
    let revenueCorporate = 0;
    let revenueOrganizers = 0;
    let pendingRevenueCorporate = 0;
    let pendingRevenueOrganizers = 0;
    let estimatedCommission = 0;

    const byEvent = new Map<
      string,
      {
        name: string;
        count: number;
        pending: number;
        revenue: number;
        organizerId?: string | null;
        organizerName?: string;
        isCorp?: boolean;
      }
    >();
    const touch = (id: string, name: string) =>
      byEvent.get(id) ?? { name: name || "Prova", count: 0, pending: 0, revenue: 0 };

    const eventOrgInfo = (eventId: string) => {
      const event = priceMap.get(eventId);
      const orgId = (event as AdminPricingRow)?.organizer_id;
      if (!orgId) return { isCorp: true, name: "Corporação Assessoria Esportiva" };
      const org = organizerMap.get(orgId);
      if (org && isMainOrg(org.name)) return { isCorp: true, name: "Corporação Assessoria Esportiva" };
      return { isCorp: false, name: org?.name || "Organizador" };
    };

    for (const s of rows) {
      const status = (s.status || "").toLowerCase();
      const value = signupValue(s, priceMap.get(s.event_id)) ?? 0;
      const org = eventOrgInfo(s.event_id);

      if (status === "cancelada") {
        canceled += 1;
        continue;
      }
      if (status === "confirmada") {
        confirmed += 1;
        revenue += value;
        if (org.isCorp) revenueCorporate += value;
        else revenueOrganizers += value;

        if (!org.isCorp) {
          const orgId = (priceMap.get(s.event_id) as AdminPricingRow)?.organizer_id;
          const orgData = orgId ? organizerMap.get(orgId) : null;
          const pct = Number(orgData?.commission_percentage ?? 0);
          if (pct > 0) estimatedCommission += (value * pct) / 100;
        }

        const cur = touch(s.event_id, s.events?.name || "");
        cur.count += 1;
        cur.revenue += value;
        cur.organizerId = (priceMap.get(s.event_id) as AdminPricingRow)?.organizer_id;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        byEvent.set(s.event_id, cur);
      } else {
        pending += 1;
        pendingRevenue += value;
        if (org.isCorp) pendingRevenueCorporate += value;
        else pendingRevenueOrganizers += value;

        const cur = touch(s.event_id, s.events?.name || "");
        cur.pending += 1;
        cur.organizerId = (priceMap.get(s.event_id) as AdminPricingRow)?.organizer_id;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        byEvent.set(s.event_id, cur);
      }
    }

    const total = confirmed + pending;
    const newMembers = members.filter((m: any) => inPeriod(m.created_at)).length;
    const buyers = new Set(
      rows.filter((s) => (s.status || "").toLowerCase() === "confirmada").map((s) => (s as any).user_id)
    ).size;

    return {
      confirmed,
      pending,
      canceled,
      revenue,
      pendingRevenue,
      revenueCorporate,
      revenueOrganizers,
      pendingRevenueCorporate,
      pendingRevenueOrganizers,
      estimatedCommission,
      total,
      conversion: total ? (confirmed / total) * 100 : 0,
      ticket: confirmed ? revenue / confirmed : 0,
      newMembers,
      totalMembers: members.length,
      adherence: members.length ? (buyers / members.length) * 100 : 0,
      topEvents: Array.from(byEvent.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    };
  }, [signups, members, pricing, since, organizerMap]);

  const maxRevenue = Math.max(1, ...metrics.topEvents.map((e) => e.revenue));

  const eventsWithoutConfig = useMemo(
    () =>
      (pricing as AdminPricingRow[]).filter((e) => {
        const d = (e as any).distances;
        return !Array.isArray(d) || d.length === 0;
      }),
    [pricing]
  );

  const upcomingOrgEvents = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return (pricing as AdminPricingRow[]).filter((e: any) => {
      if (!e.date) return false;
      return new Date(e.date + "T12:00:00") >= start;
    }).length;
  }, [pricing]);

  const rentalsNeedingAction = useMemo(
    () =>
      rentalRows.filter((r) => {
        const s = statusOf(r.status);
        return s === "requested" || s === "under_review";
      }),
    [rentalRows]
  );

  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];
    if (!isAdmin && !isOrganizerPaymentReady(organizerPayment)) {
      items.push({
        id: "pay",
        title: "Dados de pagamento incompletos",
        description: "Configure PIX e WhatsApp para receber das suas provas.",
        to: "/admin/payment-settings",
      });
    }
    if (!isAdmin && eventsWithoutConfig.length > 0) {
      items.push({
        id: "event-config",
        title:
          eventsWithoutConfig.length === 1
            ? "Uma prova sem configuração essencial"
            : `${eventsWithoutConfig.length} provas sem configuração essencial`,
        description: "Defina modalidades e valores para abrir inscrições.",
        to: "/admin/events",
      });
    }
    if (metrics.pending > 0) {
      items.push({
        id: "pending-signups",
        title:
          metrics.pending === 1
            ? "1 inscrição aguardando tratamento"
            : `${metrics.pending} inscrições aguardando tratamento`,
        description: "Confira pagamentos e confirme inscritos.",
        to: "/admin/event-signups?status=pendente",
      });
    }
    if (rentalsNeedingAction.length > 0) {
      items.push({
        id: "rentals",
        title:
          rentalsNeedingAction.length === 1
            ? "1 solicitação de estrutura em aberto"
            : `${rentalsNeedingAction.length} solicitações de estrutura em aberto`,
        description: "Pedidos solicitados ou em análise.",
        to: "/admin/rental-orders?status=requested",
      });
    }
    if (!isAdmin && upcomingOrgEvents > 0) {
      items.push({
        id: "upcoming",
        title:
          upcomingOrgEvents === 1
            ? "1 prova próxima"
            : `${upcomingOrgEvents} provas próximas`,
        description: "Revise banner, lotes e dados de pagamento.",
        to: "/admin/events",
      });
    }
    return items;
  }, [
    isAdmin,
    organizerPayment,
    eventsWithoutConfig.length,
    metrics.pending,
    rentalsNeedingAction.length,
    upcomingOrgEvents,
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">Olá, {user?.email?.split("@")[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">Resultados da plataforma em tempo real.</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1 shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                period === p.key ? "bg-brand text-brand-foreground" : "text-foreground/70 hover:bg-background/60"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <AttentionNeeded items={attentionItems} className="mt-6" />

      {!isAdmin && organizerId && (
        <OrganizerActivationChecklist
          organizerId={organizerId}
          payment={organizerPayment}
          events={pricing as any}
          signupCount={signups.length}
        />
      )}

      {signupsError ? (
        <div className="mt-8">
          <EmptyState
            title="Não foi possível carregar os indicadores"
            description="Verifique sua conexão e tente novamente. Os dados do período selecionado não foram carregados."
            actionLabel="Tentar novamente"
            onAction={() => refetchSignups()}
          />
        </div>
      ) : loading ? (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      ) : isAdmin ? (
        <>
          {/* Financeiro */}
          <section className="mt-8">
            <SectionLabel className="mb-2.5">Financeiro</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Kpi
                icon={Wallet}
                label="Receita confirmada"
                value={brl(metrics.revenue)}
                hint={`${metrics.confirmed} inscrições pagas`}
                hint2={`Corp. ${brl(metrics.revenueCorporate)} · Org. ${brl(metrics.revenueOrganizers)}`}
                accent
              />
              <Kpi
                icon={Clock}
                label="Receita em aberto"
                value={brl(metrics.pendingRevenue)}
                hint={`${metrics.pending} pendentes`}
                hint2={`Corp. ${brl(metrics.pendingRevenueCorporate)} · Org. ${brl(metrics.pendingRevenueOrganizers)}`}
                to="/admin/event-signups?status=pendente"
              />
              <Kpi
                icon={TrendingUp}
                label="Ticket médio"
                value={brl(metrics.ticket)}
                hint="Por inscrição confirmada"
              />
              <Kpi
                icon={Wallet}
                label="Comissão estimada"
                value={brl(metrics.estimatedCommission)}
                hint="Sobre confirmadas de parceiros"
                to="/admin/organizers"
              />
            </div>
          </section>

          {/* Operação */}
          <section className="mt-6">
            <SectionLabel className="mb-2.5">Operação</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Kpi
                icon={Trophy}
                label="Inscrições vendidas"
                value={String(metrics.confirmed)}
                hint={`${metrics.total} no total · ${metrics.canceled} canceladas`}
                compact
                to="/admin/event-signups?status=confirmada"
              />
              <Kpi
                icon={Users}
                label="Novos cadastros"
                value={String(metrics.newMembers)}
                hint={`${metrics.totalMembers} atletas na base`}
                compact
              />
              <Kpi
                icon={Percent}
                label="Conversão de inscrições"
                value={`${metrics.conversion.toFixed(0)}%`}
                hint={`Aderência da base: ${metrics.adherence.toFixed(1)}%`}
                compact
              />
            </div>
          </section>

          {/* Desempenho por prova */}
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <SectionLabel>Desempenho por prova</SectionLabel>
              <Button asChild variant="ghost" size="sm" className="-mt-1">
                <Link to="/admin/event-signups">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {metrics.topEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Nenhuma inscrição no período selecionado.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {metrics.topEvents.map((e) => {
                  const totalInsc = e.count + e.pending;
                  return (
                    <div
                      key={`${e.name}-${e.organizerName}`}
                      className="px-4 py-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4"
                    >
                      <div className="min-w-0 lg:w-[28%] lg:shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{e.name}</span>
                          <span
                            className={cn(
                              "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              e.isCorp ? "bg-brand/15 text-brand" : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {e.isCorp ? "Corp." : "Org."}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {e.organizerName}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:contents text-center lg:text-left">
                        <div className="lg:w-20 lg:shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inscritos</div>
                          <div className="text-sm font-semibold tabular-nums">{totalInsc}</div>
                        </div>
                        <div className="lg:w-20 lg:shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aprovados</div>
                          <div className="text-sm font-semibold tabular-nums">{e.count}</div>
                        </div>
                        <div className="lg:w-20 lg:shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendentes</div>
                          <div className="text-sm font-semibold tabular-nums">{e.pending}</div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="min-w-[5.5rem] shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Receita</div>
                          <div className="text-sm font-semibold tabular-nums">{brl(e.revenue)}</div>
                        </div>
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden min-w-[4rem]">
                          <div
                            className={cn("h-full rounded-full", e.isCorp ? "bg-brand" : "bg-muted-foreground/40")}
                            style={{ width: `${(e.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                      </div>

                      <Button asChild variant="ghost" size="sm" className="shrink-0 self-start lg:self-center">
                        <Link to="/admin/event-signups">
                          Ver inscrições <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi
              icon={Wallet}
              label="Receita confirmada"
              value={brl(metrics.revenue)}
              hint={`${metrics.confirmed} inscrições pagas`}
              hint2={`Corporação: ${brl(metrics.revenueCorporate)} • Organizadores: ${brl(metrics.revenueOrganizers)}`}
              accent
              to="/admin/event-signups?status=confirmada"
            />
            <Kpi
              icon={Clock}
              label="Receita em aberto"
              value={brl(metrics.pendingRevenue)}
              hint={`${metrics.pending} inscrições pendentes`}
              hint2={`Corporação: ${brl(metrics.pendingRevenueCorporate)} • Organizadores: ${brl(metrics.pendingRevenueOrganizers)}`}
              to="/admin/event-signups?status=pendente"
            />
            <Kpi
              icon={TrendingUp}
              label="Ticket médio"
              value={brl(metrics.ticket)}
              hint="Por inscrição confirmada"
            />
            <Kpi
              icon={Trophy}
              label="Inscrições vendidas"
              value={String(metrics.confirmed)}
              hint={`${metrics.total} no total • ${metrics.canceled} canceladas`}
              to="/admin/event-signups?status=confirmada"
            />
            <Kpi
              icon={Users}
              label="Total de inscrições"
              value={String(metrics.total)}
              hint={`${metrics.confirmed} aprovadas • ${metrics.pending} pendentes`}
              to="/admin/event-signups"
            />
          </div>

          {metrics.topEvents.length === 0 && (
            <div className="mt-6">
              <EmptyState
                icon={Trophy}
                title="Nenhuma inscrição no período"
                description="Quando houver inscrições nas suas provas, o desempenho aparece aqui."
                actionLabel="Ver minhas provas"
                actionTo="/admin/events"
              />
            </div>
          )}

          {metrics.topEvents.length > 0 && (
          <div className="mt-8 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Desempenho por prova</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/event-signups">
                  Ver inscrições <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
              <div className="mt-4 space-y-4">
                {metrics.topEvents.map((e) => (
                  <div key={e.name}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{e.name}</span>
                          <span
                            className={cn(
                              "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              e.isCorp
                                ? "bg-brand/15 text-brand"
                                : "bg-blue-500/10 text-blue-500"
                            )}
                          >
                            {e.isCorp ? "Corporação" : "Organizador"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {e.organizerName}
                        </div>
                      </div>
                      <span className="tabular-nums text-sm shrink-0">{brl(e.revenue)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{e.count + e.pending} insc.</span>
                      <span>{e.count} aprov.</span>
                      <span>{e.pending} pend.</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary mt-1.5 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          e.isCorp ? "bg-brand" : "bg-blue-500"
                        )}
                        style={{ width: `${(e.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
          </div>
          )}
        </>
      )}

      {isAdmin && (
        <>
          <h2 className="font-display text-lg font-bold mt-10">Conteúdo do site</h2>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniCard title="Planos" count={plans.length} to="/admin/plans" />
            <MiniCard title="Treinos" count={trainings.length} to="/admin/trainings" />
            <MiniCard title="Provas" count={eventsList.length} to="/admin/events" />
            <MiniCard title="Produtos" count={products.length} to="/admin/products" />
            <MiniCard title="Fotos" count={gallery.length} to="/admin/gallery" />
            <MiniCard title="Depoimentos" count={testimonials.length} to="/admin/testimonials" />
            <MiniCard title="FAQs" count={faqs.length} to="/admin/faqs" />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
