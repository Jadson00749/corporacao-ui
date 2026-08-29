import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signupValue, type ExportSignup, type EventPricingRow } from "@/lib/exportSignupsXlsx";

const db = supabase as any;

export type OrganizerRow = {
  id: string;
  user_id: string;
  name: string;
  status: string | null;
  commission_percentage: number | null;
};

export type OrganizerProfile = { user_id: string; full_name: string | null; email: string | null };

export type EventRow = {
  id: string;
  name: string;
  date: string | null;
  status: string | null;
  organizer_id: string | null;
  active?: boolean | null;
  distances?: any;
};

export type Stats = {
  events: number;
  activeEvents: number;
  signups: number;
  approved: number;
  pending: number;
  approvedValue: number;
  commission: number;
};

const emptyStats = (): Stats => ({
  events: 0,
  activeEvents: 0,
  signups: 0,
  approved: 0,
  pending: 0,
  approvedValue: 0,
  commission: 0,
});

export const brl = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** Regra única para diferenciar a organização principal dos parceiros externos. */
export const isMainOrg = (name?: string | null) => /corpora[çc][ãa]o/i.test(name || "");


/** Agrega provas, inscrições e comissões por organizador (visão do ADMIN). */
export const useOrganizerStats = (enabled = true) => {
  const organizersQ = useQuery({
    enabled,
    queryKey: ["admin_organizers"],
    queryFn: async (): Promise<OrganizerRow[]> => {
      const { data, error } = await db
        .from("organizers")
        .select("id,user_id,name,status,commission_percentage")
        .order("name");
      if (error) throw error;
      return (data ?? []) as OrganizerRow[];
    },
  });

  const eventsQ = useQuery({
    enabled,
    queryKey: ["admin_org_events"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await db
        .from("events")
        .select("id,name,date,status,organizer_id,active,distances")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const signupsQ = useQuery({
    enabled,
    queryKey: ["admin_org_signups"],
    queryFn: async (): Promise<ExportSignup[]> => {
      const { data, error } = await db
        .from("event_signups")
        .select("*, events(id,name,date,city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExportSignup[];
    },
  });

  const owners = useQuery({
    enabled: enabled && (organizersQ.data?.length ?? 0) > 0,
    queryKey: ["admin_org_owners", (organizersQ.data ?? []).map((o) => o.user_id).join(",")],
    queryFn: async (): Promise<OrganizerProfile[]> => {
      const { data } = await db
        .from("profiles")
        .select("user_id,full_name,email")
        .in("user_id", (organizersQ.data ?? []).map((o) => o.user_id));
      return (data ?? []) as OrganizerProfile[];
    },
  });

  const organizers = organizersQ.data ?? [];
  const events = eventsQ.data ?? [];
  const signups = signupsQ.data ?? [];

  const computed = useMemo(() => {
    const priceMap = new Map<string, EventPricingRow>(
      events.map((e) => [e.id, { id: e.id, name: e.name, distances: e.distances }])
    );
    const commissionOf = new Map(organizers.map((o) => [o.id, Number(o.commission_percentage ?? 0)]));

    const byEvent = new Map<string, Stats>();
    events.forEach((e) => byEvent.set(e.id, { ...emptyStats(), events: 1, activeEvents: e.active === false ? 0 : 1 }));

    for (const s of signups) {
      const st = byEvent.get(s.event_id);
      if (!st) continue;
      const status = (s.status || "").toLowerCase();
      if (status === "cancelada") continue;
      st.signups += 1;
      if (status === "confirmada") {
        st.approved += 1;
        st.approvedValue += signupValue(s, priceMap.get(s.event_id)) ?? 0;
      } else {
        st.pending += 1;
      }
    }

    events.forEach((e) => {
      const st = byEvent.get(e.id)!;
      const pct = e.organizer_id ? commissionOf.get(e.organizer_id) ?? 0 : 0;
      st.commission = (st.approvedValue * pct) / 100;
    });

    const byOrganizer = new Map<string, Stats>();
    organizers.forEach((o) => byOrganizer.set(o.id, emptyStats()));
    events.forEach((e) => {
      if (!e.organizer_id) return;
      const agg = byOrganizer.get(e.organizer_id);
      const st = byEvent.get(e.id)!;
      if (!agg) return;
      agg.events += 1;
      agg.activeEvents += st.activeEvents;
      agg.signups += st.signups;
      agg.approved += st.approved;
      agg.pending += st.pending;
      agg.approvedValue += st.approvedValue;
      agg.commission += st.commission;
    });

    const corporate = emptyStats();
    events.forEach((e) => {
      if (e.organizer_id) return;
      const st = byEvent.get(e.id)!;
      corporate.events += 1;
      corporate.activeEvents += st.activeEvents;
      corporate.signups += st.signups;
      corporate.approved += st.approved;
      corporate.pending += st.pending;
      corporate.approvedValue += st.approvedValue;
    });

    const totals = emptyStats();
    byOrganizer.forEach((s) => {
      totals.events += s.events;
      totals.activeEvents += s.activeEvents;
      totals.signups += s.signups;
      totals.approved += s.approved;
      totals.pending += s.pending;
      totals.approvedValue += s.approvedValue;
      totals.commission += s.commission;
    });

    return { byEvent, byOrganizer, totals, corporate };
  }, [organizers, events, signups]);

  return {
    organizers,
    events,
    signups,
    ownerMap: useMemo(
      () => new Map((owners.data ?? []).map((p) => [p.user_id, p])),
      [owners.data]
    ),
    organizerMap: useMemo(() => new Map(organizers.map((o) => [o.id, o])), [organizers]),
    ...computed,
    statsFor: (id: string | null | undefined) =>
      (id && computed.byOrganizer.get(id)) || emptyStats(),
    eventStats: (id: string) => computed.byEvent.get(id) ?? emptyStats(),
    isLoading: organizersQ.isLoading || eventsQ.isLoading || signupsQ.isLoading,
    refetch: () => {
      organizersQ.refetch();
      eventsQ.refetch();
      signupsQ.refetch();
    },
  };
};
