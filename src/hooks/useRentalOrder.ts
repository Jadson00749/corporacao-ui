/**
 * Persistência da "Minha Estrutura" do organizador.
 *
 * A seleção deixa de viver só em memória: existe no máximo um rental_order
 * em rascunho por organizador + prova (garantido por índice único parcial no
 * banco), e os itens escolhidos são espelhados em rental_order_items.
 *
 * As tabelas de locação ainda não estão nos tipos gerados do Supabase, por
 * isso o acesso segue o padrão já usado no projeto com `supabase as any`.
 */

import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_COLUMNS,
  ORDER_COLUMNS_WITH_REQUESTED,
  ORDER_ITEM_COLUMNS,
  configLabelOf,
  configPayload,
  isClosedStatus,
  num,
  statusOf,
  type RentalOrder,
  type RentalOrderItem,
} from "@/lib/rentalOrders";

const db = supabase as any;

/** Lê pedidos preferindo requested_at; se a migration ainda não rodou, cai no select sem ela. */
const selectOrders = async (build: (cols: string) => Promise<{ data: any; error: any }>) => {
  const withReq = await build(ORDER_COLUMNS_WITH_REQUESTED);
  if (!withReq.error) return withReq;
  if (/requested_at/i.test(withReq.error.message || "")) {
    return build(ORDER_COLUMNS);
  }
  return withReq;
};

export type RentalEvent = { id: string; name: string; date: string; city: string | null };

/** Uma linha da estrutura como o organizador escolheu na tela. */
export type DesiredLine = {
  rental_item_id: string;
  item_name: string;
  unit_type: string | null;
  unit_label: string | null;
  quantity: number;
  unit_price: number;
  /** Sempre objeto; item sem opção usa {}. */
  configuration: Record<string, unknown>;
};

/** Provas do organizador autenticado; a locação sempre se vincula a uma delas. */
export const useOrganizerEvents = (organizerId?: string | null) =>
  useQuery({
    queryKey: ["organizer_rental_events", organizerId],
    enabled: !!organizerId,
    queryFn: async (): Promise<RentalEvent[]> => {
      const { data, error } = await db
        .from("events")
        .select("id,name,date,city")
        .eq("organizer_id", organizerId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RentalEvent[];
    },
  });

export const useRentalOrder = (
  organizerId?: string | null,
  event?: RentalEvent | null,
  responsible?: { name?: string | null; phone?: string | null }
) => {
  const qc = useQueryClient();
  const eventId = event?.id ?? null;

  const orderQ = useQuery({
    queryKey: ["rental_order", organizerId, eventId],
    enabled: !!organizerId && !!eventId,
    queryFn: async (): Promise<RentalOrder | null> => {
      const { data, error } = await selectOrders((cols) =>
        db
          .from("rental_orders")
          .select(cols)
          .eq("organizer_id", organizerId)
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      // O pedido em andamento é o mais recente que ainda não foi encerrado.
      return ((data ?? []) as RentalOrder[]).find((o) => !isClosedStatus(o.status)) ?? null;
    },
  });

  const order = orderQ.data ?? null;
  const orderId = order?.id ?? null;

  const itemsQ = useQuery({
    queryKey: ["rental_order_items", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<RentalOrderItem[]> => {
      const { data, error } = await db
        .from("rental_order_items")
        .select(ORDER_ITEM_COLUMNS)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RentalOrderItem[];
    },
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["rental_order", organizerId, eventId] });
    qc.invalidateQueries({ queryKey: ["rental_order_items"] });
  }, [qc, organizerId, eventId]);

  /**
   * Cria o rascunho na primeira adição. Se duas abas tentarem ao mesmo tempo,
   * o índice único parcial barra a segunda e nós reaproveitamos a existente.
   */
  const ensureDraft = async (): Promise<RentalOrder | null> => {
    if (order) return order;
    if (!organizerId || !event) return null;

    const { data, error } = await selectOrders((cols) =>
      db
        .from("rental_orders")
        .insert({
          organizer_id: organizerId,
          event_id: event.id,
          event_name: event.name,
          event_date: event.date,
          event_location: event.city ?? null,
          responsible_name: responsible?.name ?? null,
          responsible_phone: responsible?.phone ?? null,
          status: "draft",
          subtotal: 0,
          total: 0,
        })
        .select(cols)
        .maybeSingle()
    );

    if (!error && data) return data as RentalOrder;

    const { data: existing } = await selectOrders((cols) =>
      db
        .from("rental_orders")
        .select(cols)
        .eq("organizer_id", organizerId)
        .eq("event_id", event.id)
        .eq("status", "draft")
        .maybeSingle()
    );
    if (existing) return existing as RentalOrder;

    throw error ?? new Error("Não foi possível iniciar o rascunho.");
  };

  const persist = async (desired: DesiredLine[]) => {
    if (!organizerId || !event) return;
    // Sem itens e sem pedido não há o que gravar: evita rascunho vazio.
    if (!desired.length && !order) return;

    const target = await ensureDraft();
    if (!target) return;
    // Pedido já solicitado não é editado em silêncio.
    if (statusOf(target.status) !== "draft") return;

    const { data: existingRaw, error: readError } = await db
      .from("rental_order_items")
      .select(ORDER_ITEM_COLUMNS)
      .eq("order_id", target.id);
    if (readError) throw readError;
    const existing = (existingRaw ?? []) as RentalOrderItem[];

    const byItem = new Map(
      existing.filter((e) => e.rental_item_id).map((e) => [e.rental_item_id as string, e])
    );
    const wanted = new Set(desired.map((d) => d.rental_item_id));

    const staleIds = existing
      .filter((e) => !e.rental_item_id || !wanted.has(e.rental_item_id))
      .map((e) => e.id);
    if (staleIds.length) {
      const { error } = await db.from("rental_order_items").delete().in("id", staleIds);
      if (error) throw error;
    }

    const inserts: Record<string, unknown>[] = [];
    for (const d of desired) {
      const row = {
        order_id: target.id,
        rental_item_id: d.rental_item_id,
        item_name: d.item_name,
        unit_type: d.unit_type,
        unit_label: d.unit_label,
        quantity: d.quantity,
        unit_price: d.unit_price,
        // jsonb NOT NULL DEFAULT '{}': nunca null/undefined
        configuration: configPayload(configLabelOf(d.configuration)),
      };
      const current = byItem.get(d.rental_item_id);
      if (!current) {
        inserts.push(row);
        continue;
      }
      const changed =
        num(current.quantity) !== d.quantity ||
        num(current.unit_price) !== d.unit_price ||
        configLabelOf(current.configuration) !== configLabelOf(d.configuration);
      if (changed) {
        const { error } = await db.from("rental_order_items").update(row).eq("id", current.id);
        if (error) throw error;
      }
    }
    if (inserts.length) {
      const { error } = await db.from("rental_order_items").insert(inserts);
      if (error) throw error;
    }

    // line_total é gerada no banco; subtotal e total ficam no pedido.
    const total = desired.reduce((sum, d) => sum + d.quantity * d.unit_price, 0);
    const { error: totalError } = await db
      .from("rental_orders")
      .update({ subtotal: total, total, updated_at: new Date().toISOString() })
      .eq("id", target.id);
    if (totalError) throw totalError;

    invalidate();
  };

  // Cliques rápidos no stepper podem se sobrepor: uma sincronização por vez,
  // e a última seleção pedida durante a execução roda em seguida.
  const running = useRef(false);
  const queued = useRef<DesiredLine[] | null>(null);

  const sync = useCallback(
    async (desired: DesiredLine[]) => {
      if (running.current) {
        queued.current = desired;
        return;
      }
      running.current = true;
      try {
        await persist(desired);
        while (queued.current) {
          const next = queued.current;
          queued.current = null;
          await persist(next);
        }
      } finally {
        running.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizerId, eventId, order?.id, order?.status]
  );

  const request = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Adicione itens antes de solicitar.");
      const now = new Date().toISOString();
      const { error } = await db
        .from("rental_orders")
        .update({ status: "requested", requested_at: now, updated_at: now })
        .eq("id", orderId)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async () => {
      if (!orderId) return;
      const { error } = await db
        .from("rental_orders")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("status", "requested");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    order,
    items: itemsQ.data ?? [],
    isLoading: orderQ.isLoading || (!!orderId && itemsQ.isLoading),
    isDraft: !order || statusOf(order.status) === "draft",
    sync,
    request,
    reopen,
  };
};
