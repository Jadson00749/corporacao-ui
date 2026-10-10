import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import { type ExportSignup, type EventPricingRow } from "@/lib/exportSignupsXlsx";
import { resolveSignupMoney } from "@/lib/adminPayments";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionNeeded, type AttentionItem } from "@/components/site/AttentionNeeded";
import { EmptyState } from "@/components/site/EmptyState";
import { OrganizerActivationChecklist } from "@/components/admin/OrganizerActivationChecklist";
import { isOrganizerPaymentReady, useOrganizerPayment } from "@/lib/eventPayment";
import { statusOf } from "@/lib/rentalOrders";
import { cn } from "@/lib/utils";
import { Trophy, ChevronDown, Check } from "lucide-react";
import { DashboardQuickActions, type QuickAction } from "@/components/admin/dashboard/DashboardQuickActions";
import {
  DashboardFinancialStats,
  type PartnerFinancialView,
} from "@/components/admin/dashboard/DashboardFinancialStats";
import { DashboardRecentSignups, type RecentSignupRow } from "@/components/admin/dashboard/DashboardRecentSignups";
import { DashboardSignupTrend, type TrendPoint } from "@/components/admin/dashboard/DashboardSignupTrend";
import {
  DashboardEventPerformance,
  type EventPerformanceRow,
} from "@/components/admin/dashboard/DashboardEventPerformance";
import { DashboardPartnerHeader } from "@/components/admin/dashboard/DashboardPartnerHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODS = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

/** Sentinela do seletor de contexto (Radix Select não aceita value=""). */
const GENERAL_VIEW = "__general__";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [eventFilterOpen, setEventFilterOpen] = useState(false);
  const eventFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (eventFilterOpen && !eventFilterRef.current?.contains(e.target as Node)) {
        setEventFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [eventFilterOpen]);

  /** Visão do Parceiro: só filtro de leitura via search param (?organizer=UUID). */
  const selectedPartnerId = isAdmin ? searchParams.get("organizer") : null;
  const selectPartner = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("organizer", id);
    else next.delete("organizer");
    setSearchParams(next, { replace: true });
  };

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
        .select("id,name,commission_percentage,status");
      if (error) throw error;
      return ((data ?? []) as unknown) as {
        id: string;
        name: string;
        commission_percentage: number | null;
        status: string | null;
      }[];
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

  type StandaloneDashOrder = {
    id: string;
    event_id: string;
    organizer_id: string | null;
    status: string;
    total_amount: number;
    created_at: string;
    items_qty: number;
  };

  const { data: standaloneOrders = [] } = useQuery({
    queryKey: [
      "admin_dashboard_standalone_orders",
      isAdmin ? "all" : organizerId,
      pricing.map((e) => e.id).join(","),
    ],
    enabled: isAdmin || !!organizerId,
    staleTime: 60_000,
    queryFn: async (): Promise<StandaloneDashOrder[]> => {
      const ids = pricing.map((e) => e.id);
      let q = supabase
        .from("event_store_orders")
        .select(
          `
          id, event_id, organizer_id, status, total_amount, created_at, order_type,
          event_store_order_items ( quantity )
        `,
        )
        .eq("order_type", "standalone");
      if (!isAdmin) {
        if (!ids.length) return [];
        q = q.in("event_id", ids);
      }
      const { data, error } = await q;
      if (error) {
        if (/order_type|column|relation/i.test(error.message)) return [];
        throw error;
      }
      return ((data ?? []) as any[]).map((o) => {
        const items = Array.isArray(o.event_store_order_items)
          ? o.event_store_order_items
          : [];
        const items_qty = items.reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 0),
          0,
        );
        return {
          id: o.id as string,
          event_id: o.event_id as string,
          organizer_id: (o.organizer_id as string | null) ?? null,
          status: String(o.status || "").toLowerCase(),
          total_amount: Number(o.total_amount) || 0,
          created_at: o.created_at as string,
          items_qty,
        };
      });
    },
  });

  /** Pedidos confirmados (signup_bundle + standalone) com itens — qty filtrada no período. */
  type ConfirmedStoreOrderDash = {
    id: string;
    event_id: string;
    created_at: string;
    order_type: string;
    items_qty: number;
  };

  const { data: confirmedStoreOrders = [] } = useQuery({
    queryKey: [
      "admin_dashboard_confirmed_store_orders",
      isAdmin ? "all" : organizerId,
      pricing.map((e) => e.id).join(","),
    ],
    enabled: isAdmin || !!organizerId,
    staleTime: 60_000,
    queryFn: async (): Promise<ConfirmedStoreOrderDash[]> => {
      const ids = pricing.map((e) => e.id);
      let q = supabase
        .from("event_store_orders")
        .select(
          `
          id, event_id, created_at, order_type, status,
          event_store_order_items ( quantity )
        `,
        )
        .eq("status", "confirmada");
      if (!isAdmin) {
        if (!ids.length) return [];
        q = q.in("event_id", ids);
      }
      const { data, error } = await q;
      if (error) {
        if (/relation|column|order_type/i.test(error.message)) return [];
        throw error;
      }
      return ((data ?? []) as any[]).map((o) => {
        const items = Array.isArray(o.event_store_order_items)
          ? o.event_store_order_items
          : [];
        const items_qty = items.reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 0),
          0,
        );
        return {
          id: o.id as string,
          event_id: o.event_id as string,
          created_at: o.created_at as string,
          order_type: String(o.order_type || "signup_bundle"),
          items_qty,
        };
      });
    },
  });
  const { data: organizerPayment } = useOrganizerPayment(!isAdmin ? organizerId : null);

  const { data: currentOrganizer } = useQuery({
    enabled: !isAdmin && !!organizerId,
    queryKey: ["current_organizer_commission", organizerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("organizers")
        .select("commission_percentage")
        .eq("id", organizerId)
        .maybeSingle();
      if (error) return null;
      return data as { commission_percentage: number | null } | null;
    },
  });

  const commissionPct = !isAdmin ? Number(currentOrganizer?.commission_percentage ?? 0) : 0;

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

  const pricingWithMock = pricing as AdminPricingRow[];

  /** Escopo operacional da Visão Geral = provas com `active === true` (regra do Admin/site). */
  const activePricing = useMemo(
    () => pricingWithMock.filter((e) => e.active === true),
    [pricingWithMock]
  );
  const activeEventIds = useMemo(() => new Set(activePricing.map((e) => e.id)), [activePricing]);

  const effectiveEventIds = useMemo(
    () => (!isAdmin && selectedEventIds.length > 0 ? new Set(selectedEventIds) : activeEventIds),
    [isAdmin, selectedEventIds, activeEventIds]
  );

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
    const rows = signups.filter((s) => effectiveEventIds.has(s.event_id) && inPeriod(s.created_at));
    const standaloneRows = standaloneOrders.filter(
      (o) => effectiveEventIds.has(o.event_id) && inPeriod(o.created_at),
    );

    let confirmed = 0;
    let pending = 0;
    let canceled = 0;
    let revenue = 0;
    let pendingRevenue = 0;
    let revenueCorporate = 0;
    let revenueOrganizers = 0;
    let pendingRevenueCorporate = 0;
    let pendingRevenueOrganizers = 0;
    let confirmedCorporate = 0;
    let confirmedPartners = 0;
    let estimatedCommission = 0;
    let revenueRegistration = 0;
    let revenueProducts = 0;
    let pendingSignupCount = 0;
    let pendingStandaloneCount = 0;
    let pendingSignupRevenue = 0;
    let pendingStandaloneRevenue = 0;

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
        commissionPct?: number;
        commission?: number;
      }
    >();
    const touch = (id: string, name: string) =>
      byEvent.get(id) ?? {
        eventId: id,
        name: name || "Prova",
        count: 0,
        pending: 0,
        revenue: 0,
        commissionPct: 0,
        commission: 0,
      };

    const byPartner = new Map<
      string,
      {
        organizerId: string;
        name: string;
        approvedValue: number;
        commissionPct: number;
        commission: number;
        confirmed: number;
        pending: number;
        pendingRevenue: number;
      }
    >();
    const touchPartner = (orgId: string, name: string, pct: number) => {
      const cur =
        byPartner.get(orgId) ?? {
          organizerId: orgId,
          name,
          approvedValue: 0,
          commissionPct: pct,
          commission: 0,
          confirmed: 0,
          pending: 0,
          pendingRevenue: 0,
        };
      cur.name = name;
      cur.commissionPct = pct;
      return cur;
    };

    for (const s of rows) {
      const status = (s.status || "").toLowerCase();
      const money = resolveSignupMoney(s as any, priceMap.get(s.event_id));
      const value = money.total;
      const org = eventOrgInfo(s.event_id);
      const eventOrgId = priceMap.get(s.event_id)?.organizer_id ?? null;
      const orgData = eventOrgId ? organizerMap.get(eventOrgId) : null;
      const commissionPct = !org.isCorp ? Number(orgData?.commission_percentage ?? 0) : 0;

      if (status === "cancelada") {
        canceled += 1;
        continue;
      }
      if (status === "confirmada") {
        confirmed += 1;
        revenue += value;
        revenueRegistration += money.registration;
        revenueProducts += money.products;
        if (org.isCorp) {
          revenueCorporate += value;
          confirmedCorporate += 1;
        } else {
          revenueOrganizers += value;
          confirmedPartners += 1;
          if (commissionPct > 0) estimatedCommission += (value * commissionPct) / 100;

          if (eventOrgId) {
            const existing = touchPartner(eventOrgId, org.name, commissionPct);
            existing.approvedValue += value;
            existing.confirmed += 1;
            existing.commission = (existing.approvedValue * commissionPct) / 100;
            byPartner.set(eventOrgId, existing);
          }
        }

        const cur = touch(s.event_id, s.events?.name || "");
        cur.count += 1;
        cur.revenue += value;
        cur.organizerId = eventOrgId;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        cur.commissionPct = commissionPct;
        cur.commission = org.isCorp ? 0 : (cur.revenue * commissionPct) / 100;
        byEvent.set(s.event_id, cur);
      } else {
        // pendente + pagamento_atrasado
        pending += 1;
        pendingSignupCount += 1;
        pendingRevenue += value;
        pendingSignupRevenue += value;
        if (org.isCorp) {
          pendingRevenueCorporate += value;
        } else {
          pendingRevenueOrganizers += value;
          if (eventOrgId) {
            const existing = touchPartner(eventOrgId, org.name, commissionPct);
            existing.pending += 1;
            existing.pendingRevenue += value;
            byPartner.set(eventOrgId, existing);
          }
        }

        const cur = touch(s.event_id, s.events?.name || "");
        cur.pending += 1;
        cur.organizerId = eventOrgId;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        cur.commissionPct = commissionPct;
        byEvent.set(s.event_id, cur);
      }
    }

    // Compras avulsas (standalone) — nunca somar signup_bundle aqui.
    for (const o of standaloneRows) {
      const value = o.total_amount || 0;
      const org = eventOrgInfo(o.event_id);
      const eventOrgId =
        o.organizer_id ?? priceMap.get(o.event_id)?.organizer_id ?? null;
      const orgData = eventOrgId ? organizerMap.get(eventOrgId) : null;
      const commissionPct = !org.isCorp ? Number(orgData?.commission_percentage ?? 0) : 0;
      const eventName = priceMap.get(o.event_id)?.name || "Prova";

      if (o.status === "cancelada") continue;

      if (o.status === "confirmada") {
        revenue += value;
        revenueProducts += value;
        if (org.isCorp) {
          revenueCorporate += value;
        } else {
          revenueOrganizers += value;
          if (commissionPct > 0) estimatedCommission += (value * commissionPct) / 100;
          if (eventOrgId) {
            const existing = touchPartner(eventOrgId, org.name, commissionPct);
            existing.approvedValue += value;
            existing.commission = (existing.approvedValue * commissionPct) / 100;
            byPartner.set(eventOrgId, existing);
          }
        }
        const cur = touch(o.event_id, eventName);
        cur.revenue += value;
        cur.organizerId = eventOrgId;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        cur.commissionPct = commissionPct;
        cur.commission = org.isCorp ? 0 : (cur.revenue * commissionPct) / 100;
        byEvent.set(o.event_id, cur);
      } else if (o.status === "pendente" || o.status === "pagamento_atrasado") {
        pending += 1;
        pendingStandaloneCount += 1;
        pendingRevenue += value;
        pendingStandaloneRevenue += value;
        if (org.isCorp) {
          pendingRevenueCorporate += value;
        } else {
          pendingRevenueOrganizers += value;
          if (eventOrgId) {
            const existing = touchPartner(eventOrgId, org.name, commissionPct);
            existing.pending += 1;
            existing.pendingRevenue += value;
            byPartner.set(eventOrgId, existing);
          }
        }
        const cur = touch(o.event_id, eventName);
        cur.pending += 1;
        cur.organizerId = eventOrgId;
        cur.organizerName = org.name;
        cur.isCorp = org.isCorp;
        cur.commissionPct = commissionPct;
        byEvent.set(o.event_id, cur);
      }
    }

    // Todo parceiro cadastrado fica selecionável, mesmo sem movimento no período.
    for (const o of organizers) {
      if (isMainOrg(o.name)) continue;
      if (byPartner.has(o.id)) continue;
      byPartner.set(o.id, {
        organizerId: o.id,
        name: o.name,
        approvedValue: 0,
        commissionPct: Number(o.commission_percentage ?? 0),
        commission: 0,
        confirmed: 0,
        pending: 0,
        pendingRevenue: 0,
      });
    }

    const partners = Array.from(byPartner.values()).sort((a, b) => {
      if (b.commission !== a.commission) return b.commission - a.commission;
      if (b.approvedValue !== a.approvedValue) return b.approvedValue - a.approvedValue;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const partnerEventsWithMovement = Array.from(byEvent.values()).filter(
      (e) => e.isCorp === false && (e.count > 0 || e.revenue > 0)
    ).length;

    const total = confirmed + pending;
    const newMembers = members.filter((m: any) => inPeriod(m.created_at)).length;
    const buyers = new Set(
      rows.filter((s) => (s.status || "").toLowerCase() === "confirmada").map((s) => (s as any).user_id)
    ).size;

    // Qty de produtos no MESMO período da receita de produtos:
    // itens de pedidos confirmados (signup_bundle + standalone) com created_at no período.
    // Não duplica: cada order entra uma vez (bundle e standalone são pedidos distintos).
    let productsSoldQty = 0;
    for (const o of confirmedStoreOrders) {
      if (!effectiveEventIds.has(o.event_id) || !inPeriod(o.created_at)) continue;
      productsSoldQty += o.items_qty || 0;
    }

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
      confirmedCorporate,
      confirmedPartners,
      ticketCorporate: confirmedCorporate ? revenueCorporate / confirmedCorporate : 0,
      partnerEventsWithMovement,
      estimatedCommission,
      partners,
      total,
      conversion: total ? (confirmed / total) * 100 : 0,
      ticket: confirmed ? revenue / confirmed : 0,
      newMembers,
      totalMembers: members.length,
      adherence: members.length ? (buyers / members.length) * 100 : 0,
      eventRows: Array.from(byEvent.values()),
      topEvents: Array.from(byEvent.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
      revenueRegistration: Math.round(revenueRegistration * 100) / 100,
      revenueProducts: Math.round(revenueProducts * 100) / 100,
      pendingSignupCount,
      pendingStandaloneCount,
      pendingSignupRevenue: Math.round(pendingSignupRevenue * 100) / 100,
      pendingStandaloneRevenue: Math.round(pendingStandaloneRevenue * 100) / 100,
      productsSoldQty,
    };
  }, [
    signups,
    members,
    activePricing,
    activeEventIds,
    effectiveEventIds,
    since,
    organizerMap,
    pricing,
    organizers,
    standaloneOrders,
    confirmedStoreOrders,
  ]);
  const partnerOptions = useMemo(
    () => (isAdmin ? metrics.partners : []),
    [isAdmin, metrics.partners]
  );
  const selectedPartner = useMemo(
    () => partnerOptions.find((p) => p.organizerId === selectedPartnerId) ?? null,
    [partnerOptions, selectedPartnerId]
  );
  const partnerMode = isAdmin && !!selectedPartner;

  /**
   * Escopo do parceiro = TODAS as provas do organizer_id, independente do status
   * de publicação (open/closed/inactive). Status de publicação não apaga histórico.
   */
  const partnerEventIds = useMemo(
    () =>
      new Set(
        (pricing as AdminPricingRow[])
          .filter((e) => selectedPartner && e.organizer_id === selectedPartner.organizerId)
          .map((e) => e.id)
      ),
    [pricing, selectedPartner]
  );
  const scopeEventIds = partnerMode ? partnerEventIds : effectiveEventIds;

  /**
   * Analytics do parceiro selecionado sobre o histórico completo (todas as provas
   * dele no período), sem depender de active === true. Regras financeiras inalteradas:
   * valor aprovado/comissão/confirmadas = confirmada; receita em aberto = pendente;
   * cancelada nunca entra.
   */
  const partnerMetrics = useMemo(() => {
    if (!selectedPartner) return null;
    const priceMap = new Map((pricing as AdminPricingRow[]).map((e) => [e.id, e]));
    const rows = signups.filter(
      (s) => partnerEventIds.has(s.event_id) && inPeriod(s.created_at)
    );
    const standaloneRows = standaloneOrders.filter(
      (o) => partnerEventIds.has(o.event_id) && inPeriod(o.created_at),
    );

    let approvedValue = 0;
    let confirmed = 0;
    let pending = 0;
    let pendingRevenue = 0;
    const byEvent = new Map<
      string,
      { eventId: string; name: string; confirmed: number; pending: number; revenue: number }
    >();

    for (const s of rows) {
      const status = (s.status || "").toLowerCase();
      if (status === "cancelada") continue;
      const ev = priceMap.get(s.event_id);
      const value = resolveSignupMoney(s as any, ev).total;
      const cur =
        byEvent.get(s.event_id) ?? {
          eventId: s.event_id,
          name: ev?.name || s.events?.name || "Prova",
          confirmed: 0,
          pending: 0,
          revenue: 0,
        };
      if (status === "confirmada") {
        confirmed += 1;
        approvedValue += value;
        cur.confirmed += 1;
        cur.revenue += value;
      } else {
        pending += 1;
        pendingRevenue += value;
        cur.pending += 1;
      }
      byEvent.set(s.event_id, cur);
    }

    for (const o of standaloneRows) {
      if (o.status === "cancelada") continue;
      const value = o.total_amount || 0;
      const ev = priceMap.get(o.event_id);
      const cur =
        byEvent.get(o.event_id) ?? {
          eventId: o.event_id,
          name: ev?.name || "Prova",
          confirmed: 0,
          pending: 0,
          revenue: 0,
        };
      if (o.status === "confirmada") {
        approvedValue += value;
        cur.revenue += value;
      } else if (o.status === "pendente" || o.status === "pagamento_atrasado") {
        pending += 1;
        pendingRevenue += value;
        cur.pending += 1;
      }
      byEvent.set(o.event_id, cur);
    }

    const pct = selectedPartner.commissionPct;
    return {
      approvedValue,
      commissionPct: pct,
      commission: (approvedValue * pct) / 100,
      confirmed,
      pending,
      pendingRevenue,
      events: byEvent,
    };
  }, [selectedPartner, pricing, signups, partnerEventIds, since, standaloneOrders]);
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
    // Mapa completo (inclui provas históricas). Preferência snapshot; fallback signupValue.
    const priceMap = new Map((pricing as AdminPricingRow[]).map((e) => [e.id, e]));
    return signups
      .filter((s) => scopeEventIds.has(s.event_id) && (s.status || "").toLowerCase() !== "cancelada")
      .slice(0, 5)
      .map((s) => ({
        signup: s,
        value: resolveSignupMoney(s as any, priceMap.get(s.event_id)).total,
      }));
  }, [signups, pricing, scopeEventIds]);
  const trendPoints = useMemo((): TrendPoint[] => {
    const rows = signups.filter((s) => {
      if (!scopeEventIds.has(s.event_id) || !inPeriod(s.created_at)) return false;
      // Visão do Parceiro: curva de inscrições ATIVAS (pendente + confirmada).
      if (partnerMode && (s.status || "").toLowerCase() === "cancelada") return false;
      return true;
    });
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
  }, [signups, since, period, scopeEventIds, partnerMode]);

  // Visão Geral: foco nas provas da Corporação (parceiros ficam na visão do parceiro).
  const overviewPerformanceRows = useMemo(
    (): EventPerformanceRow[] =>
      metrics.topEvents
        .filter((e) => e.isCorp !== false)
        .map((e) => ({
          eventId: e.eventId,
          name: e.name,
          organizerName: e.organizerName,
          isCorp: e.isCorp,
          confirmed: e.count,
          pending: e.pending,
          revenue: e.revenue,
          commissionPct: e.commissionPct,
          commission: e.commission,
        })),
    [metrics.topEvents]
  );

  /**
   * Visão do Parceiro lista as provas dele com histórico no período (mesmo
   * desativadas/encerradas) e as ativas sem movimento. Badge de status quando aplicável.
   */
  const partnerPerformanceRows = useMemo((): EventPerformanceRow[] => {
    if (!selectedPartner || !partnerMetrics) return [];
    const pct = selectedPartner.commissionPct;
    const statBadge = (e: AdminPricingRow): string | undefined => {
      if (e.active === false) return "Desativada";
      if ((e.status || "").toLowerCase() === "closed") return "Encerrada";
      return undefined;
    };
    return (pricing as AdminPricingRow[])
      .filter((e) => e.organizer_id === selectedPartner.organizerId)
      .map((e) => {
        const st = partnerMetrics.events.get(e.id);
        const revenue = st?.revenue ?? 0;
        const confirmed = st?.confirmed ?? 0;
        const pending = st?.pending ?? 0;
        // Mantém provas com movimento no período ou ainda ativas; oculta antigas sem nada.
        const keep = confirmed > 0 || pending > 0 || e.active === true;
        if (!keep) return null;
        return {
          eventId: e.id,
          name: e.name || "Prova",
          isCorp: false,
          confirmed,
          pending,
          revenue,
          commissionPct: pct,
          commission: (revenue * pct) / 100,
          statusBadge: statBadge(e),
        } as EventPerformanceRow;
      })
      .filter((r): r is EventPerformanceRow => r !== null)
      .sort((a, b) => b.revenue - a.revenue || b.confirmed - a.confirmed);
  }, [selectedPartner, partnerMetrics, pricing]);

  const performanceRows = partnerMode ? partnerPerformanceRows : overviewPerformanceRows;

  const partnerView = useMemo((): PartnerFinancialView | undefined => {
    if (!selectedPartner || !partnerMetrics) return undefined;
    return {
      approvedValue: partnerMetrics.approvedValue,
      commissionPct: partnerMetrics.commissionPct,
      commission: partnerMetrics.commission,
      confirmed: partnerMetrics.confirmed,
      pendingRevenue: partnerMetrics.pendingRevenue,
      pending: partnerMetrics.pending,
    };
  }, [selectedPartner, partnerMetrics]);

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
          {partnerMode && selectedPartner ? (
            <DashboardPartnerHeader
              name={selectedPartner.name}
              commissionPct={selectedPartner.commissionPct}
            />
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Olá, {firstName} 👋</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Resumo da operação hoje.</p>
            </>
          )}
          <DashboardQuickActions actions={quickActions} className="mt-2.5" />
        </div>

        <div className="flex flex-col items-end gap-2">
          {isAdmin && partnerOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Visão
              </span>
              <Select
                value={selectedPartnerId ?? GENERAL_VIEW}
                onValueChange={(v) => selectPartner(v === GENERAL_VIEW ? null : v)}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 w-48 sm:w-56",
                    partnerMode && "border-blue-500/50 text-blue-600 dark:text-blue-400"
                  )}
                >
                  <SelectValue placeholder="Visão Geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL_VIEW}>Visão Geral</SelectItem>
                  {partnerOptions.map((p) => {
                    const inactive =
                      (organizerMap.get(p.organizerId)?.status || "").toLowerCase() === "inactive";
                    return (
                      <SelectItem key={p.organizerId} value={p.organizerId}>
                        {p.name}
                        {inactive ? " · Inativo" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex shrink-0 gap-1 rounded-lg bg-secondary p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  period === p.key
                    ? partnerMode
                      ? "bg-blue-500 text-white"
                      : "bg-brand text-brand-foreground"
                    : "text-foreground/70 hover:bg-background/60"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
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
          {!isAdmin && pricingWithMock.length > 0 && (
            <div ref={eventFilterRef} className="relative mt-3 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Filtrar por prova:</span>
              <button
                type="button"
                onClick={() => setEventFilterOpen((v) => !v)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-secondary/60",
                  selectedEventIds.length > 0 && "border-brand/50 text-brand"
                )}
              >
                <span>
                  {selectedEventIds.length === 0
                    ? "Todas as provas"
                    : selectedEventIds.length === 1
                    ? (pricingWithMock.find((e) => e.id === selectedEventIds[0])?.name ?? "1 prova")
                    : `${selectedEventIds.length} provas selecionadas`}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", eventFilterOpen && "rotate-180")} />
              </button>
              {selectedEventIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEventIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
              <div className={cn(
                "absolute left-0 top-10 z-50 w-max min-w-48 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-md border border-input bg-popover shadow-md transition-all duration-200 origin-top",
                eventFilterOpen ? "opacity-100 scale-y-100 pointer-events-auto" : "opacity-0 scale-y-95 pointer-events-none"
              )}>
                  <button
                    type="button"
                    onClick={() => { setSelectedEventIds([]); setEventFilterOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60",
                      selectedEventIds.length === 0 && "text-brand font-medium"
                    )}
                  >
                    Todas as provas
                  </button>
                  <div className="my-1 border-t border-input" />
                  {pricingWithMock.map((e) => {
                    const checked = selectedEventIds.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() =>
                          setSelectedEventIds((prev) =>
                            prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                          )
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60"
                      >
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all duration-200", checked ? "border-brand bg-brand text-brand-foreground scale-100" : "border-brand/40 bg-transparent")}>
                          <Check className={cn("h-3 w-3 transition-all duration-200", checked ? "opacity-100 scale-100" : "opacity-0 scale-50")} />
                        </span>
                        <span className="truncate text-left">{e.name || "Prova"}</span>
                      </button>
                    );
                  })}
                </div>
            </div>
          )}

          <DashboardFinancialStats
            metrics={metrics}
            isAdmin={isAdmin}
            commissionPct={commissionPct}
            partnerView={partnerMode ? partnerView : undefined}
            onOpenPartners={
              isAdmin && !partnerMode && partnerOptions.length > 0
                ? () => selectPartner(partnerOptions[0].organizerId)
                : undefined
            }
            className="mt-3"
          />

          <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-12">
            <DashboardRecentSignups rows={recentRows} className="lg:col-span-4" />
            <DashboardSignupTrend
              points={trendPoints}
              className="lg:col-span-8"
              tone={partnerMode ? "blue" : "brand"}
              kpis={
                partnerMode && partnerMetrics
                  ? [
                      { label: "Confirmadas", value: String(partnerMetrics.confirmed) },
                      { label: "Pendentes", value: String(partnerMetrics.pending) },
                      {
                        label: "Comissão",
                        value: partnerMetrics.commission.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }),
                      },
                    ]
                  : isAdmin
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

          {performanceRows.length === 0 && (!isAdmin || partnerMode) ? (
            <div className="mt-3.5">
              <EmptyState
                icon={Trophy}
                title={partnerMode ? "Nenhuma prova ativa deste parceiro" : "Nenhuma inscrição no período"}
                description={
                  partnerMode
                    ? "Quando este parceiro tiver provas ativas, o desempenho aparece aqui."
                    : "Quando houver inscrições nas suas provas ativas, o desempenho aparece aqui."
                }
                actionLabel={partnerMode ? "Ver provas" : "Ver minhas provas"}
                actionTo="/admin/events"
              />
            </div>
          ) : (
            <DashboardEventPerformance
              rows={performanceRows}
              showOrganizer={isAdmin && !partnerMode}
              partnerScoped={partnerMode}
              className="mt-3.5"
            />
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
