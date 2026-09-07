import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import { signupValue, type ExportSignup, type EventPricingRow } from "@/lib/exportSignupsXlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionNeeded, type AttentionItem } from "@/components/site/AttentionNeeded";
import { EmptyState } from "@/components/site/EmptyState";
import { OrganizerActivationChecklist } from "@/components/admin/OrganizerActivationChecklist";
import { isOrganizerPaymentReady, useOrganizerPayment } from "@/lib/eventPayment";
import { statusOf } from "@/lib/rentalOrders";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { DashboardQuickActions, type QuickAction } from "@/components/admin/dashboard/DashboardQuickActions";
import { DashboardFinancialStats } from "@/components/admin/dashboard/DashboardFinancialStats";
import { DashboardRecentSignups, type RecentSignupRow } from "@/components/admin/dashboard/DashboardRecentSignups";
import { DashboardSignupTrend, type TrendPoint } from "@/components/admin/dashboard/DashboardSignupTrend";
import {
  DashboardEventPerformance,
  type EventPerformanceRow,
} from "@/components/admin/dashboard/DashboardEventPerformance";

const PERIODS = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

type AdminPricingRow = EventPricingRow & {
  organizer_id?: string | null;
  date?: string | null;
  city?: string | null;
  status?: string | null;
  banner_image?: string | null;
  image?: string | null;
  /** Campo oficial Ativa/Inativa do Admin de provas (mesmo do site público). */
  active?: boolean | null;
};

const AdminDashboard = () => {
  const { user, isAdmin, organizerId } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("30");

  const { data: pricing = [] } = useQuery({
    queryKey: ["admin_events_pricing", isAdmin ? "all" : organizerId],
    queryFn: async (): Promise<AdminPricingRow[]> => {
      let q = supabase
        .from("events")
        .select("id,name,date,city,status,distances,organizer_id,banner_image,image,active");
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
      return (data ?? []) as {
        id: string;
        status: string;
        event_name: string | null;
        event_date: string | null;
        organizer_id: string;
      }[];
    },
  });

  const loading = (isAdmin && loadingMembers) || loadingSignups;

  const organizerMap = useMemo(
    () => new Map(organizers.map((o) => [o.id, o])),
    [organizers]
  );

  /** Escopo operacional da Visão Geral = provas com `active === true` (regra do Admin/site). */
  const activePricing = useMemo(
    () => (pricing as AdminPricingRow[]).filter((e) => e.active === true),
    [pricing]
  );
  const activeEventIds = useMemo(() => new Set(activePricing.map((e) => e.id)), [activePricing]);

  const since = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [period]);

  const inPeriod = (iso?: string | null) => {
    if (!since) return true;
    if (!iso) return false;
    return new Date(iso) >= since;
  };

  const eventOrgInfo = (eventId: string) => {
    const event = pricing.find((e) => e.id === eventId);
    const orgId = event?.organizer_id;
    if (!orgId) return { isCorp: true, name: "Corporação Assessoria Esportiva", orgId: null as string | null };
    const org = organizerMap.get(orgId);
    if (org && isMainOrg(org.name)) {
      return { isCorp: true, name: "Corporação Assessoria Esportiva", orgId };
    }
    return { isCorp: false, name: org?.name || "Organizador", orgId };
  };

  const metrics = useMemo(() => {
    const priceMap = new Map(activePricing.map((e) => [e.id, e]));
    const rows = signups.filter((s) => activeEventIds.has(s.event_id) && inPeriod(s.created_at));

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
        eventId: string;
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
      byEvent.get(id) ?? { eventId: id, name: name || "Prova", count: 0, pending: 0, revenue: 0 };

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
          const orgId = priceMap.get(s.event_id)?.organizer_id;
          const orgData = orgId ? organizerMap.get(orgId) : null;
          const pct = Number(orgData?.commission_percentage ?? 0);
          if (pct > 0) estimatedCommission += (value * pct) / 100;
        }

        const cur = touch(s.event_id, s.events?.name || "");
        cur.count += 1;
        cur.revenue += value;
        cur.organizerId = priceMap.get(s.event_id)?.organizer_id;
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
        cur.organizerId = priceMap.get(s.event_id)?.organizer_id;
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
      topEvents: Array.from(byEvent.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    };
  }, [signups, members, activePricing, activeEventIds, since, organizerMap, pricing]);

  const eventsWithoutConfig = useMemo(
    () =>
      activePricing.filter((e) => {
        const d = (e as any).distances;
        return !Array.isArray(d) || d.length === 0;
      }),
    [activePricing]
  );

  const upcomingOrgEventsCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return activePricing.filter((e: any) => {
      if (!e.date) return false;
      return new Date(e.date + "T12:00:00") >= start;
    }).length;
  }, [activePricing]);

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
    if (!isAdmin && upcomingOrgEventsCount > 0) {
      items.push({
        id: "upcoming",
        title:
          upcomingOrgEventsCount === 1
            ? "1 prova próxima"
            : `${upcomingOrgEventsCount} provas próximas`,
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
    upcomingOrgEventsCount,
  ]);

  const recentRows = useMemo((): RecentSignupRow[] => {
    const priceMap = new Map(activePricing.map((e) => [e.id, e]));
    return signups
      .filter((s) => activeEventIds.has(s.event_id) && (s.status || "").toLowerCase() !== "cancelada")
      .slice(0, 5)
      .map((s) => ({
        signup: s,
        value: signupValue(s, priceMap.get(s.event_id)),
      }));
  }, [signups, activePricing, activeEventIds]);

  const trendPoints = useMemo((): TrendPoint[] => {
    const rows = signups.filter((s) => activeEventIds.has(s.event_id) && inPeriod(s.created_at));
    const byDay = new Map<string, number>();

    for (const s of rows) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }

    const keys: string[] = [];
    if (period === "all") {
      keys.push(...Array.from(byDay.keys()).sort());
    } else {
      const days = Number(period);
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() - (days - 1));
      for (let i = 0; i < days; i++) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        keys.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return keys.map((date) => {
      const [, m, d] = date.split("-");
      return {
        date,
        label: `${d}/${m}`,
        count: byDay.get(date) || 0,
      };
    });
  }, [signups, since, period, activeEventIds]);

  const performanceRows = useMemo(
    (): EventPerformanceRow[] =>
      metrics.topEvents.map((e) => ({
        eventId: e.eventId,
        name: e.name,
        organizerName: e.organizerName,
        isCorp: e.isCorp,
        confirmed: e.count,
        pending: e.pending,
        revenue: e.revenue,
      })),
    [metrics.topEvents]
  );

  const quickActions = useMemo((): QuickAction[] => {
    if (isAdmin) {
      return [
        { id: "new-event", label: "Nova prova", to: "/admin/events", icon: "new" },
        { id: "signups", label: "Ver inscrições", to: "/admin/event-signups", icon: "signups" },
        { id: "events", label: "Ver provas", to: "/admin/events", icon: "events" },
      ];
    }
    return [
      { id: "new-event", label: "Nova prova", to: "/admin/events", icon: "new" },
      { id: "signups", label: "Minhas inscrições", to: "/admin/event-signups", icon: "signups" },
      { id: "events", label: "Minhas provas", to: "/admin/events", icon: "events" },
      { id: "structure", label: "Estruturas", to: "/admin/rental-orders", icon: "structure" },
    ];
  }, [isAdmin]);

  const firstName = user?.email?.split("@")[0] || "olá";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Olá, {firstName} 👋</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Resumo da operação hoje.</p>
          <DashboardQuickActions actions={quickActions} className="mt-2.5" />
        </div>
        <div className="flex shrink-0 gap-1 rounded-lg bg-secondary p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                period === p.key ? "bg-brand text-brand-foreground" : "text-foreground/70 hover:bg-background/60"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <AttentionNeeded items={attentionItems} compact className="mt-3" />

      {!isAdmin && organizerId && (
        <OrganizerActivationChecklist
          organizerId={organizerId}
          payment={organizerPayment}
          events={pricing as any}
          signupCount={signups.length}
        />
      )}

      {signupsError ? (
        <div className="mt-5">
          <EmptyState
            title="Não foi possível carregar os indicadores"
            description="Verifique sua conexão e tente novamente. Os dados do período selecionado não foram carregados."
            actionLabel="Tentar novamente"
            onAction={() => refetchSignups()}
          />
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-12">
            <Skeleton className="h-72 rounded-xl lg:col-span-4" />
            <Skeleton className="h-72 rounded-xl lg:col-span-8" />
          </div>
        </div>
      ) : (
        <>
          <DashboardFinancialStats metrics={metrics} isAdmin={isAdmin} className="mt-3" />

          <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-12">
            <DashboardRecentSignups rows={recentRows} className="lg:col-span-4" />
            <DashboardSignupTrend
              points={trendPoints}
              className="lg:col-span-8"
              kpis={
                isAdmin
                  ? [
                      { label: "Vendidas", value: String(metrics.confirmed) },
                      { label: "Novos cadastros", value: String(metrics.newMembers) },
                      { label: "Ticket", value: metrics.ticket ? metrics.ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—" },
                    ]
                  : [
                      { label: "Vendidas", value: String(metrics.confirmed) },
                      { label: "Total", value: String(metrics.total) },
                      { label: "Pendentes", value: String(metrics.pending) },
                    ]
              }
            />
          </div>

          {performanceRows.length === 0 && !isAdmin ? (
            <div className="mt-3.5">
              <EmptyState
                icon={Trophy}
                title="Nenhuma inscrição no período"
                description="Quando houver inscrições nas suas provas ativas, o desempenho aparece aqui."
                actionLabel="Ver minhas provas"
                actionTo="/admin/events"
              />
            </div>
          ) : (
            <DashboardEventPerformance
              rows={performanceRows}
              showOrganizer={isAdmin}
              className="mt-3.5"
            />
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
