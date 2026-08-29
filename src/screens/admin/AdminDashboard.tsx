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
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  hint2?: string;
  accent?: boolean;
}) => (
  <div
    className={cn(
      "rounded-2xl border p-5",
      accent ? "border-brand/40 bg-brand/10" : "border-border bg-card"
    )}
  >
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className={cn("w-4 h-4", accent && "text-brand")} />
      {label}
    </div>
    <div className="font-display text-3xl font-bold mt-2 tabular-nums">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    {hint2 && <div className="text-xs text-muted-foreground/80 mt-1">{hint2}</div>}
  </div>
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
      let q = supabase.from("events").select("id,name,distances,organizer_id");
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

  const { data: signups = [], isLoading: loadingSignups } = useQuery({
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Olá, {user?.email?.split("@")[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">Resultados da plataforma em tempo real.</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
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

      {loading ? (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Kpi
              icon={Wallet}
              label="Receita confirmada"
              value={brl(metrics.revenue)}
              hint={`${metrics.confirmed} inscrições pagas`}
              hint2={`Corporação: ${brl(metrics.revenueCorporate)} • Organizadores: ${brl(metrics.revenueOrganizers)}`}
              accent
            />
            <Kpi
              icon={Clock}
              label="Receita em aberto"
              value={brl(metrics.pendingRevenue)}
              hint={`${metrics.pending} inscrições pendentes`}
              hint2={`Corporação: ${brl(metrics.pendingRevenueCorporate)} • Organizadores: ${brl(metrics.pendingRevenueOrganizers)}`}
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
            />
            {isAdmin ? (
              <>
                <Kpi
                  icon={Users}
                  label="Novos cadastros"
                  value={String(metrics.newMembers)}
                  hint={`${metrics.totalMembers} atletas na base`}
                />
                <Kpi
                  icon={Percent}
                  label="Conversão de inscrições"
                  value={`${metrics.conversion.toFixed(0)}%`}
                  hint={`Aderência da base: ${metrics.adherence.toFixed(1)}%`}
                />
                <Kpi
                  icon={Wallet}
                  label="Comissão estimada dos organizadores"
                  value={brl(metrics.estimatedCommission)}
                  hint="Sobre inscrições confirmadas de parceiros"
                />
              </>
            ) : (
              <Kpi
                icon={Users}
                label="Total de inscrições"
                value={String(metrics.total)}
                hint={`${metrics.confirmed} aprovadas • ${metrics.pending} pendentes`}
              />
            )}
          </div>

          <div className="mt-8 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">{isAdmin ? "Receita por prova" : "Desempenho por prova"}</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/event-signups">
                  Ver inscrições <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            {metrics.topEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-4">
                Nenhuma inscrição no período selecionado.
              </p>
            ) : (
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
            )}
          </div>
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
