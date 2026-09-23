import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link, useSearchParams } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import {
  computeEventStoreOrderKpis,
  computeEventStoreSeparation,
  eventStoreFulfillmentLabel,
  eventStoreOrderBuyerEmail,
  eventStoreOrderBuyerName,
  eventStoreOrderOriginLabel,
  mapEventStoreAdminOrderError,
  updateEventStoreOrderFulfillment,
  useEventStoreOrdersScoped,
  type EventStoreFulfillmentStatus,
  type EventStoreOrderRow,
} from "@/lib/eventStore";
import { downloadEventStoreOrdersXlsx } from "@/lib/exportEventStoreOrdersXlsx";
import { getSignupStatusInfo } from "@/lib/signupOperationalStatus";
import {
  readStoreOrdersUiSession,
  writeStoreOrdersUiSession,
  type StoreOrdersUiSession,
} from "@/lib/sessionDraft";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type EventMeta = {
  id: string;
  name: string;
  organizer_id: string | null;
};

type StatusFilter =
  | "all"
  | "pendente"
  | "pagamento_atrasado"
  | "confirmada"
  | "cancelada";
type OriginFilter = "all" | "signup_bundle" | "standalone";
type PickupFilter =
  | "all"
  | "aguardando_retirada"
  | "retirado"
  | "nao_retirado";

const PAGE_SIZE_OPTS = [50, 100, 0] as const; // 0 = todos

const parseStatus = (raw: string | null | undefined): StatusFilter => {
  const s = (raw || "").trim();
  if (
    s === "pendente" ||
    s === "pagamento_atrasado" ||
    s === "confirmada" ||
    s === "cancelada"
  ) {
    return s;
  }
  return "all";
};

const parseOrigin = (raw: string | null | undefined): OriginFilter => {
  const s = (raw || "").trim();
  if (s === "signup_bundle" || s === "standalone" || s === "inscricao") {
    return s === "inscricao" ? "signup_bundle" : (s as OriginFilter);
  }
  return "all";
};

const parsePickup = (raw: string | null | undefined): PickupFilter => {
  const s = (raw || "").trim();
  if (
    s === "aguardando_retirada" ||
    s === "retirado" ||
    s === "nao_retirado"
  ) {
    return s;
  }
  return "all";
};

/**
 * Hub operacional de pedidos da loja (admin + organizer).
 * Filtros em memória; uma query no escopo das provas permitidas.
 */
export default function AdminStoreOrders() {
  const { isAdmin, organizerId } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useMemo(() => readStoreOrdersUiSession(), []);

  const urlHas = (key: string) => searchParams.has(key);

  const [search, setSearch] = useState(() =>
    urlHas("q") ? searchParams.get("q") || "" : session?.search || "",
  );
  const [eventFilter, setEventFilter] = useState(() =>
    urlHas("event")
      ? searchParams.get("event") || "all"
      : session?.eventFilter || "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    urlHas("status")
      ? parseStatus(searchParams.get("status"))
      : parseStatus(session?.statusFilter),
  );
  const [originFilter, setOriginFilter] = useState<OriginFilter>(() =>
    urlHas("origin")
      ? parseOrigin(searchParams.get("origin"))
      : parseOrigin(session?.originFilter),
  );
  const [pickupFilter, setPickupFilter] = useState<PickupFilter>(() =>
    urlHas("pickup")
      ? parsePickup(searchParams.get("pickup"))
      : parsePickup(session?.pickupFilter),
  );
  const [orgFilter, setOrgFilter] = useState(() =>
    isAdmin
      ? urlHas("organizer")
        ? searchParams.get("organizer") || "all"
        : session?.orgFilter || "all"
      : "all",
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Number(session?.page) || 1),
  );
  const [pageSize, setPageSize] = useState(() => {
    const n = Number(session?.pageSize);
    if (n === 0 || n === 50 || n === 100) return n;
    return 50;
  });
  const [exporting, setExporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // URL explícita sobrescreve ao montar / deep-link
  useEffect(() => {
    if (urlHas("event")) setEventFilter(searchParams.get("event") || "all");
    if (urlHas("status")) setStatusFilter(parseStatus(searchParams.get("status")));
    if (urlHas("origin")) setOriginFilter(parseOrigin(searchParams.get("origin")));
    if (urlHas("pickup")) setPickupFilter(parsePickup(searchParams.get("pickup")));
    if (urlHas("q")) setSearch(searchParams.get("q") || "");
    if (isAdmin && urlHas("organizer")) {
      setOrgFilter(searchParams.get("organizer") || "all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Persistência sessão + URL (params principais)
  useEffect(() => {
    const payload: StoreOrdersUiSession = {
      search,
      eventFilter,
      statusFilter,
      originFilter,
      pickupFilter,
      orgFilter: isAdmin ? orgFilter : undefined,
      page,
      pageSize,
    };
    writeStoreOrdersUiSession(payload);

    const next = new URLSearchParams(searchParams);
    const setOrDel = (key: string, value: string, isDefault: boolean) => {
      if (isDefault || !value) next.delete(key);
      else next.set(key, value);
    };
    setOrDel("event", eventFilter, eventFilter === "all");
    setOrDel("status", statusFilter, statusFilter === "all");
    setOrDel("origin", originFilter, originFilter === "all");
    setOrDel("pickup", pickupFilter, pickupFilter === "all");
    setOrDel("q", search.trim(), !search.trim());
    if (isAdmin) setOrDel("organizer", orgFilter, orgFilter === "all");
    else next.delete("organizer");

    const cur = searchParams.toString();
    const neu = next.toString();
    if (cur !== neu) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    eventFilter,
    statusFilter,
    originFilter,
    pickupFilter,
    orgFilter,
    page,
    pageSize,
    isAdmin,
  ]);

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["admin_store_orders_events", isAdmin ? "all" : organizerId],
    staleTime: 5 * 60_000,
    enabled: isAdmin || !!organizerId,
    queryFn: async (): Promise<EventMeta[]> => {
      let q = supabase
        .from("events")
        .select("id,name,organizer_id")
        .order("date", { ascending: false });
      if (!isAdmin && organizerId) q = q.eq("organizer_id" as any, organizerId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((e) => ({
        id: e.id as string,
        name: String(e.name || "Prova"),
        organizer_id: (e.organizer_id as string | null) ?? null,
      }));
    },
  });

  const { data: organizers = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin_store_orders_organizers"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("organizers" as any)
        .select("id,name")
        .order("name");
      return ((data ?? []) as any[]).map((o) => ({
        id: o.id as string,
        name: String(o.name || ""),
      }));
    },
  });

  const partnerOrganizers = useMemo(
    () => organizers.filter((o) => !isMainOrg(o.name)),
    [organizers],
  );
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const eventNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) m.set(e.id, e.name);
    return m;
  }, [events]);

  const scopeIds: string[] | "all" | null = isAdmin
    ? "all"
    : eventIds.length
      ? eventIds
      : null;

  const {
    data: orders = [],
    isLoading: loadingOrders,
    refetch,
  } = useEventStoreOrdersScoped(scopeIds);

  const isLoading = loadingEvents || loadingOrders;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, eventFilter, statusFilter, originFilter, pickupFilter, orgFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (eventFilter !== "all" && o.event_id !== eventFilter) return false;

      if (isAdmin && orgFilter !== "all") {
        const ev = events.find((e) => e.id === o.event_id);
        if (!ev || ev.organizer_id !== orgFilter) return false;
      }

      if (statusFilter !== "all") {
        const st = (o.status || "").toLowerCase();
        if (statusFilter === "pendente") {
          if (st !== "pendente") return false;
        } else if (st !== statusFilter) return false;
      }

      if (originFilter !== "all") {
        const ot = o.order_type || "signup_bundle";
        if (ot !== originFilter) return false;
      }

      if (pickupFilter !== "all") {
        const ful = (o.fulfillment_status || "aguardando_retirada") as string;
        if (ful !== pickupFilter) return false;
      }

      if (q) {
        const buyer = eventStoreOrderBuyerName(o).toLowerCase();
        const email = eventStoreOrderBuyerEmail(o).toLowerCase();
        const products = (o.event_store_order_items ?? [])
          .map(
            (i) =>
              `${i.product_name_snapshot} ${i.variant_name_snapshot || ""}`,
          )
          .join(" ")
          .toLowerCase();
        const eventName = (eventNameById.get(o.event_id) || "").toLowerCase();
        if (
          !buyer.includes(q) &&
          !email.includes(q) &&
          !products.includes(q) &&
          !eventName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    orders,
    eventFilter,
    statusFilter,
    originFilter,
    pickupFilter,
    orgFilter,
    search,
    isAdmin,
    events,
    eventNameById,
  ]);

  const kpis = useMemo(
    () => computeEventStoreOrderKpis(filteredOrders),
    [filteredOrders],
  );
  const separation = useMemo(
    () => computeEventStoreSeparation(filteredOrders),
    [filteredOrders],
  );
  const flatRows = useMemo(
    () => flattenOrderRows(filteredOrders, eventNameById),
    [filteredOrders, eventNameById],
  );

  const pageCount =
    pageSize === 0 ? 1 : Math.max(1, Math.ceil(flatRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    if (pageSize === 0) return flatRows;
    const start = (safePage - 1) * pageSize;
    return flatRows.slice(start, start + pageSize);
  }, [flatRows, pageSize, safePage]);

  const exportEventName = useMemo(() => {
    if (eventFilter !== "all") {
      return eventNameById.get(eventFilter) || "prova";
    }
    return "pedidos-produtos";
  }, [eventFilter, eventNameById]);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadEventStoreOrdersXlsx({
        eventName: exportEventName,
        orders: filteredOrders,
        includeEventColumn: eventFilter === "all",
        eventNameById,
      });
      toast.success("Excel gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  };

  const setFulfillment = async (
    order: EventStoreOrderRow,
    status: EventStoreFulfillmentStatus,
  ) => {
    if (order.status === "cancelada") {
      toast.error("Pedido cancelado não pode ser marcado como retirado.");
      return;
    }
    if (order.status !== "confirmada") {
      toast.error("Só é possível controlar a retirada de pedidos aprovados.");
      return;
    }
    setUpdatingId(order.id);
    try {
      await updateEventStoreOrderFulfillment({
        orderId: order.id,
        fulfillmentStatus: status,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin_event_store_orders_scoped"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin_event_store_orders"],
      });
      toast.success(eventStoreFulfillmentLabel(status));
    } catch (e: any) {
      toast.error(
        mapEventStoreAdminOrderError(e ?? {}) ||
          e?.message ||
          "Não foi possível atualizar a retirada.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand shrink-0" />
            <h1 className="font-display text-2xl md:text-3xl font-bold">
              Pedidos de produtos
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Acompanhe os itens vendidos, organize a separação e controle a
            retirada no dia da prova.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            Atualizar
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={exporting || isLoading}
            onClick={() => void onExport()}
          >
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Pedidos confirmados" value={String(kpis.confirmedOrders)} />
        <Kpi label="Pedidos pendentes" value={String(kpis.pendingOrders)} />
        <Kpi
          label="Em atraso"
          value={String(kpis.overdueOrders)}
          emphasize={kpis.overdueOrders > 0}
        />
        <Kpi label="Unidades confirmadas" value={String(kpis.confirmedUnits)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <div className="sm:col-span-2 xl:col-span-2">
          <Input
            placeholder="Buscar nome, e-mail ou produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Prova" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as provas</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Em andamento</SelectItem>
            <SelectItem value="pagamento_atrasado">Em atraso</SelectItem>
            <SelectItem value="confirmada">Aprovado</SelectItem>
            <SelectItem value="cancelada">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={originFilter}
          onValueChange={(v) => setOriginFilter(v as OriginFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="signup_bundle">Inscrição</SelectItem>
            <SelectItem value="standalone">Compra avulsa</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={pickupFilter}
          onValueChange={(v) => setPickupFilter(v as PickupFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Retirada" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aguardando_retirada">
              Aguardando retirada
            </SelectItem>
            <SelectItem value="retirado">Retirado</SelectItem>
            <SelectItem value="nao_retirado">Não retirado</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin ? (
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Organizador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os organizadores</SelectItem>
              {partnerOrganizers.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Separação para o dia da prova
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : separation.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item pendente ou confirmado para separar ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Variação</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Confirmados
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Pendentes</th>
                </tr>
              </thead>
              <tbody>
                {separation.map((row) => (
                  <tr
                    key={`${row.product}||${row.variant}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2.5 font-medium">{row.product}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.variant}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.confirmed}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.pending}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Pedidos detalhados
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {flatRows.length}{" "}
              {flatRows.length === 1 ? "linha" : "linhas"}
            </span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "Todos" : n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : flatRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido encontrado com os filtros atuais.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[64rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Prova</th>
                    <th className="px-3 py-2 font-medium">Comprador</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium">Produto</th>
                    <th className="px-3 py-2 font-medium">Variação</th>
                    <th className="px-3 py-2 font-medium text-right">Qtd</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                    <th className="px-3 py-2 font-medium">Pagamento</th>
                    <th className="px-3 py-2 font-medium">Retirada</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((r) => (
                    <OrderTableRow
                      key={r.key}
                      r={r}
                      updatingId={updatingId}
                      onFulfillment={setFulfillment}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {pagedRows.map((r) => (
                <OrderMobileCard
                  key={r.key}
                  r={r}
                  updatingId={updatingId}
                  onFulfillment={setFulfillment}
                />
              ))}
            </div>

            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  Página {safePage} de {pageCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount}
                    onClick={() =>
                      setPage((p) => Math.min(pageCount, p + 1))
                    }
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

type FlatRow = ReturnType<typeof flattenOrderRows>[number];

function OrderTableRow({
  r,
  updatingId,
  onFulfillment,
}: {
  r: FlatRow;
  updatingId: string | null;
  onFulfillment: (
    order: EventStoreOrderRow,
    status: EventStoreFulfillmentStatus,
  ) => void;
}) {
  return (
    <tr className="border-b border-border/40 last:border-0 align-top">
      <td className="px-3 py-2.5 text-muted-foreground max-w-[9rem] truncate">
        {r.eventName}
      </td>
      <td className="px-3 py-2.5 font-medium max-w-[10rem] truncate">
        {r.buyer}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {r.origin}
      </td>
      <td className="px-3 py-2.5">{r.product}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{r.variant}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{r.quantity}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {brl(r.lineTotal)}
      </td>
      <td className="px-3 py-2.5">
        <PaymentCell r={r} />
      </td>
      <td className="px-3 py-2.5">
        <FulfillmentCell
          r={r}
          updatingId={updatingId}
          onFulfillment={onFulfillment}
        />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {r.date}
      </td>
    </tr>
  );
}

function OrderMobileCard({
  r,
  updatingId,
  onFulfillment,
}: {
  r: FlatRow;
  updatingId: string | null;
  onFulfillment: (
    order: EventStoreOrderRow,
    status: EventStoreFulfillmentStatus,
  ) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2">
      <div>
        <p className="font-semibold text-sm text-foreground">{r.buyer}</p>
        <p className="text-xs text-muted-foreground">{r.eventName}</p>
      </div>
      <p className="text-sm text-foreground">
        {r.product}
        <span className="text-muted-foreground"> · {r.variant}</span>
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Qtd. <span className="font-semibold text-foreground">{r.quantity}</span>
        </span>
        <span className="font-semibold text-foreground">{brl(r.lineTotal)}</span>
        <span>{r.origin}</span>
      </div>
      <div className="space-y-1.5 pt-1 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground">Pagamento</p>
        <PaymentCell r={r} />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">Retirada</p>
        <FulfillmentCell
          r={r}
          updatingId={updatingId}
          onFulfillment={onFulfillment}
        />
      </div>
    </div>
  );
}

function PaymentCell({ r }: { r: FlatRow }) {
  return (
    <div className="space-y-1.5 min-w-[9rem]">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          r.op.badgeClassName,
        )}
      >
        {r.op.overdue ? <Clock className="w-3 h-3 shrink-0" /> : null}
        {r.op.label}
      </span>
      {r.op.overdueHint ? (
        <p className="text-[10px] leading-snug text-amber-800/90 dark:text-amber-300/90 max-w-[12rem]">
          {r.op.overdueHint}
        </p>
      ) : null}
      {r.showManagePaymentLink ? (
        <Link
          to={r.managePaymentHref}
          className="inline-block pt-0.5 text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Gerenciar pagamento
        </Link>
      ) : null}
    </div>
  );
}

function FulfillmentCell({
  r,
  updatingId,
  onFulfillment,
}: {
  r: FlatRow;
  updatingId: string | null;
  onFulfillment: (
    order: EventStoreOrderRow,
    status: EventStoreFulfillmentStatus,
  ) => void;
}) {
  return (
    <div className="space-y-1.5 min-w-[9rem]">
      <p className="text-xs text-foreground/90">{r.fulfillmentLabel}</p>
      {r.canMarkFulfillment ? (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={updatingId === r.orderId}
            onClick={() => void onFulfillment(r.order, "retirado")}
          >
            Marcar como retirado
          </Button>
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline text-left"
            disabled={updatingId === r.orderId}
            onClick={() => void onFulfillment(r.order, "nao_retirado")}
          >
            Marcar como não retirado
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 px-3 py-2.5",
        emphasize ? "border-amber-500/40" : "border-border/60",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function flattenOrderRows(
  orders: EventStoreOrderRow[],
  eventNameById: Map<string, string>,
) {
  const rows: {
    key: string;
    orderId: string;
    order: EventStoreOrderRow;
    eventName: string;
    origin: string;
    buyer: string;
    product: string;
    variant: string;
    quantity: number;
    lineTotal: number;
    op: ReturnType<typeof getSignupStatusInfo>;
    fulfillmentLabel: string;
    canMarkFulfillment: boolean;
    showManagePaymentLink: boolean;
    managePaymentHref: string;
    date: string;
  }[] = [];

  for (const order of orders) {
    const buyer = eventStoreOrderBuyerName(order);
    const op = getSignupStatusInfo({
      status: order.status || order.event_signups?.status,
    });
    const canMarkFulfillment = order.status === "confirmada";
    const pendingPayment =
      order.status === "pendente" || order.status === "pagamento_atrasado";
    const showManagePaymentLink = pendingPayment;
    const params = new URLSearchParams({
      tab: "pagamentos",
      event: order.event_id,
    });
    if (order.status === "pagamento_atrasado") {
      params.set("status", "pagamento_atrasado");
    } else if (order.status === "pendente") {
      params.set("status", "pendente");
    }
    if (buyer && buyer !== "—") params.set("q", buyer);
    const managePaymentHref = `/admin/event-signups?${params.toString()}`;
    const eventName = eventNameById.get(order.event_id) || "Prova";

    const items = order.event_store_order_items ?? [];
    items.forEach((item, idx) => {
      rows.push({
        key: item.id,
        orderId: order.id,
        order,
        eventName,
        origin: eventStoreOrderOriginLabel(order.order_type),
        buyer,
        product: item.product_name_snapshot || "Produto",
        variant: item.variant_name_snapshot?.trim() || "Padrão",
        quantity: item.quantity,
        lineTotal: Number(item.line_total) || 0,
        op,
        fulfillmentLabel: eventStoreFulfillmentLabel(order.fulfillment_status),
        canMarkFulfillment: canMarkFulfillment && idx === 0,
        showManagePaymentLink: showManagePaymentLink && idx === 0,
        managePaymentHref,
        date: formatDateTime(order.created_at),
      });
    });
  }
  return rows;
}
