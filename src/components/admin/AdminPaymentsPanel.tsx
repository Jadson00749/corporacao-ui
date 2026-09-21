import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import {
  getSignupStatusInfo,
  matchesSignupStatusFilter,
  signupStatusLabel,
  type SignupStatusFilter,
} from "@/lib/signupOperationalStatus";
import {
  computePaymentKpis,
  paymentOriginLabel,
  signupToPaymentRow,
  standaloneOrderToPaymentRow,
  type PaymentOrigin,
  type PaymentRow,
} from "@/lib/adminPayments";
import {
  mapEventStoreAdminOrderError,
  updateEventStoreStandalonePaymentStatus,
} from "@/lib/eventStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchParams } from "@/lib/router-compat";
import {
  readSignupsUiSession,
  writeSignupsUiSession,
} from "@/lib/sessionDraft";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const PAGE_SIZE = 50;

type EventOpt = {
  id: string;
  name: string;
  distances?: unknown;
  organizer_id?: string | null;
};

type SignupLike = Parameters<typeof signupToPaymentRow>[0]["signup"] & {
  event_id: string;
  events?: { id: string; name: string; date?: string; city?: string } | null;
};

type OriginFilter = "all" | PaymentOrigin;

type Props = {
  isAdmin: boolean;
  organizerId: string | null;
  events: EventOpt[];
  eventIds: string[];
  organizers: { id: string; name: string }[];
  signups: SignupLike[];
  signupsLoading: boolean;
  initialStatusFilter?: SignupStatusFilter;
  initialEventFilter?: string;
  initialSearch?: string;
  initialOriginFilter?: OriginFilter;
  initialOwnership?: "all" | "corp" | "external";
  initialOrgFilter?: string;
  /** Quando true, espelha filtros importantes na URL (debounced) */
  syncUrl?: boolean;
  onApproveSignup: (id: string) => Promise<void>;
  onCancelSignup: (id: string) => Promise<void>;
};

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AdminPaymentsPanel({
  isAdmin,
  organizerId,
  events,
  eventIds,
  organizers,
  signups,
  signupsLoading,
  initialStatusFilter = "all",
  initialEventFilter = "all",
  initialSearch = "",
  initialOriginFilter = "all",
  initialOwnership = "all",
  initialOrgFilter = "all",
  syncUrl = false,
  onApproveSignup,
  onCancelSignup,
}: Props) {
  const qc = useQueryClient();
  const [, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search);
  const [eventFilter, setEventFilter] = useState(initialEventFilter);
  const [statusFilter, setStatusFilter] = useState<SignupStatusFilter>(initialStatusFilter);
  const [originFilter, setOriginFilter] = useState<OriginFilter>(initialOriginFilter);
  const [ownership, setOwnership] = useState<"all" | "corp" | "external">(initialOwnership);
  const [orgFilter, setOrgFilter] = useState(initialOrgFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  /**
   * Persistência / URL DEPOIS do clique.
   * State local atualiza na hora → 0 chamadas Supabase por filtro.
   * setSearchParams é adiado (~350ms) para não competir com o paint do filtro.
   */
  const persistTimer = useRef<number | null>(null);
  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const prev = readSignupsUiSession() ?? {};
      writeSignupsUiSession({
        ...prev,
        tab: "pagamentos",
        payments: {
          search,
          eventFilter,
          statusFilter,
          originFilter,
          ownership,
          orgFilter,
        },
      });

      if (!syncUrl) return;
      const next = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const setOrDel = (key: string, value: string, isDefault: boolean) => {
        if (isDefault) next.delete(key);
        else next.set(key, value);
      };
      next.set("tab", "pagamentos");
      setOrDel("event", eventFilter, eventFilter === "all");
      setOrDel("status", statusFilter, statusFilter === "all");
      setOrDel("q", search, !search.trim());
      setOrDel("ownership", ownership, ownership === "all" || !isAdmin);
      setOrDel("organizer", orgFilter, orgFilter === "all" || !isAdmin);
      setOrDel("payOrigin", originFilter, originFilter === "all");
      setSearchParams(next, { replace: true });
    }, 350);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [
    search,
    eventFilter,
    statusFilter,
    originFilter,
    ownership,
    orgFilter,
    syncUrl,
    isAdmin,
    setSearchParams,
  ]);

  useEffect(() => {
    setPage(0);
  }, [deferredSearch, eventFilter, statusFilter, originFilter, ownership, orgFilter]);

  const eventMap = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );
  const organizerMap = useMemo(
    () => new Map(organizers.map((o) => [o.id, o])),
    [organizers],
  );

  const standaloneKey = useMemo(
    () =>
      [
        "admin_payment_standalone_orders",
        isAdmin ? "all" : organizerId ?? "",
        // eventIds já vem memoizado do parent; join estável
        eventIds.join(","),
      ] as const,
    [isAdmin, organizerId, eventIds],
  );

  const {
    data: standaloneOrders = [],
    isLoading: standaloneLoading,
    refetch: refetchStandalone,
  } = useQuery({
    queryKey: standaloneKey,
    enabled: isAdmin || (!!organizerId && eventIds.length > 0),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      let q = supabase
        .from("event_store_orders")
        .select(
          `
          id, event_id, organizer_id, status, total_amount, products_amount,
          created_at, order_type,
          buyer_name_snapshot, buyer_email_snapshot, buyer_phone_snapshot,
          events ( id, name )
        `,
        )
        .eq("order_type", "standalone")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        if (!eventIds.length) return [];
        q = q.in("event_id", eventIds);
      }

      const { data, error } = await q;
      if (error) {
        if (/order_type|column/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as any[];
    },
  });

  const allRows = useMemo(() => {
    const rows: PaymentRow[] = [];

    for (const s of signups) {
      const ev = eventMap.get(s.event_id);
      rows.push(
        signupToPaymentRow({
          signup: s,
          event: ev,
          organizerId: ev?.organizer_id ?? null,
        }),
      );
    }

    for (const o of standaloneOrders) {
      rows.push(standaloneOrderToPaymentRow({ order: o }));
    }

    rows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return rows;
  }, [signups, standaloneOrders, eventMap]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");

    return allRows.filter((r) => {
      if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
      if (!matchesSignupStatusFilter(r, statusFilter)) return false;
      if (originFilter !== "all" && r.origin !== originFilter) return false;

      if (isAdmin) {
        const org = r.organizerId
          ? organizerMap.get(r.organizerId)
          : null;
        const corp = !r.organizerId || isMainOrg(org?.name);
        if (ownership === "corp" && !corp) return false;
        if (ownership === "external" && corp) return false;
        if (orgFilter !== "all") {
          if (orgFilter === "corp") {
            if (!corp) return false;
          } else if (r.organizerId !== orgFilter) {
            return false;
          }
        }
      }

      if (!q) return true;
      const blob = `${r.customerName} ${r.email} ${r.cpf} ${r.eventName}`.toLowerCase();
      if (blob.includes(q)) return true;
      if (qDigits && r.cpf.replace(/\D/g, "").includes(qDigits)) return true;
      return false;
    });
  }, [
    allRows,
    deferredSearch,
    eventFilter,
    statusFilter,
    originFilter,
    isAdmin,
    ownership,
    orgFilter,
    organizerMap,
  ]);

  const kpis = useMemo(() => computePaymentKpis(filtered), [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const setStatusQuick = useCallback((next: SignupStatusFilter) => {
    setStatusFilter((prev) => (prev === next ? "all" : next));
  }, []);

  const approve = useCallback(
    async (row: PaymentRow) => {
      setBusyId(row.id);
      try {
        if (row.entityType === "signup") {
          await onApproveSignup(row.id);
        } else {
          await updateEventStoreStandalonePaymentStatus({
            orderId: row.id,
            status: "confirmada",
          });
          await qc.invalidateQueries({ queryKey: ["admin_payment_standalone_orders"] });
          toast.success("Pagamento aprovado");
        }
      } catch (e: any) {
        toast.error(
          mapEventStoreAdminOrderError(e ?? {}) ||
            e?.message ||
            "Não foi possível aprovar.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [onApproveSignup, qc],
  );

  const cancel = useCallback(
    async (row: PaymentRow) => {
      setBusyId(row.id);
      try {
        if (row.entityType === "signup") {
          await onCancelSignup(row.id);
        } else {
          await updateEventStoreStandalonePaymentStatus({
            orderId: row.id,
            status: "cancelada",
          });
          await qc.invalidateQueries({ queryKey: ["admin_payment_standalone_orders"] });
          toast.success("Pedido cancelado");
        }
      } catch (e: any) {
        toast.error(
          mapEventStoreAdminOrderError(e ?? {}) ||
            e?.message ||
            "Não foi possível cancelar.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [onCancelSignup, qc],
  );

  const loading = signupsLoading || standaloneLoading;
  const partnerOrganizers = useMemo(
    () => organizers.filter((o) => !isMainOrg(o.name)),
    [organizers],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Aprove pagamentos de inscrições e compras avulsas em um só lugar.
            Inscrição + produtos aparece como uma linha (um PIX).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetchStandalone()}
        >
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi
          label="A receber"
          value={brl(kpis.aReceber)}
          hint={`${kpis.countReceber} ${kpis.countReceber === 1 ? "pagamento" : "pagamentos"}`}
          onClick={() => setStatusQuick("pendente")}
          active={statusFilter === "pendente"}
        />
        <Kpi
          label="Em atraso"
          value={brl(kpis.emAtraso)}
          hint={`${kpis.countAtraso} ${kpis.countAtraso === 1 ? "pagamento" : "pagamentos"}`}
          onClick={() => setStatusQuick("pagamento_atrasado")}
          active={statusFilter === "pagamento_atrasado"}
          emphasize={kpis.emAtraso > 0}
        />
        <Kpi
          label="Recebido"
          value={brl(kpis.recebido)}
          hint={`${kpis.countRecebido} ${kpis.countRecebido === 1 ? "pagamento" : "pagamentos"}`}
          onClick={() => setStatusQuick("confirmada")}
          active={statusFilter === "confirmada"}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Buscar">
          <Input
            placeholder="Buscar nome, e-mail, CPF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
        <FilterField label="Prova">
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
        </FilterField>
        <FilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as SignupStatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Em andamento</SelectItem>
              <SelectItem value="pagamento_atrasado">Em atraso</SelectItem>
              <SelectItem value="confirmada">Aprovados</SelectItem>
              <SelectItem value="cancelada">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Origem">
          <Select
            value={originFilter}
            onValueChange={(v) => setOriginFilter(v as OriginFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="registration">Inscrição</SelectItem>
              <SelectItem value="registration_with_products">
                Inscrição + produtos
              </SelectItem>
              <SelectItem value="product">Produto</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
            Organizador
          </span>
          {(
            [
              ["all", "Todas"],
              ["corp", "Corporação"],
              ["external", "Organizadores externos"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setOwnership(k);
                setOrgFilter("all");
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                ownership === k
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {ownership === "external" && partnerOrganizers.length > 0 ? (
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="h-8 w-[11rem] text-xs">
                <SelectValue placeholder="Organizador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os externos</SelectItem>
                {partnerOrganizers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum pagamento neste filtro.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {filtered.length}{" "}
              {filtered.length === 1 ? "pagamento" : "pagamentos"}
              {pageCount > 1 ? ` · página ${safePage + 1} de ${pageCount}` : ""}
            </span>
            {pageCount > 1 ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 md:hidden">
            {pagedRows.map((r) => (
              <PaymentMobileCard
                key={`${r.entityType}:${r.id}`}
                row={r}
                busy={busyId === r.id}
                onApprove={approve}
                onCancel={cancel}
              />
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Prova</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <PaymentDesktopRow
                    key={`${r.entityType}:${r.id}`}
                    row={r}
                    busy={busyId === r.id}
                    onApprove={approve}
                    onCancel={cancel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  onClick,
  active,
  emphasize,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
  active?: boolean;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-brand bg-brand/10"
          : emphasize
            ? "border-amber-500/40 bg-card/40"
            : "border-border/60 bg-card/40 hover:border-border",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const info = getSignupStatusInfo({ status });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        info.badgeClassName,
      )}
    >
      {info.overdue ? <Clock className="w-3 h-3 shrink-0" /> : null}
      {signupStatusLabel(status)}
    </span>
  );
}

function PaymentActions({
  row,
  busy,
  onApprove,
  onCancel,
  compact,
}: {
  row: PaymentRow;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const st = row.status;
  if (st === "confirmada") {
    return (
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Aprovado
      </span>
    );
  }
  if (st === "cancelada") {
    return (
      <span className="text-xs font-medium text-muted-foreground">Cancelado</span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", compact && "w-full")}>
      <Button
        type="button"
        variant="brand"
        size="sm"
        className={cn("h-9", compact && "flex-1")}
        disabled={busy}
        onClick={onApprove}
      >
        Aprovar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 px-0"
            disabled={busy}
            aria-label="Mais ações"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onCancel}
          >
            Cancelar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const PaymentDesktopRow = memo(function PaymentDesktopRow({
  row,
  busy,
  onApprove,
  onCancel,
}: {
  row: PaymentRow;
  busy: boolean;
  onApprove: (row: PaymentRow) => void;
  onCancel: (row: PaymentRow) => void;
}) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-3 py-2.5">
        <p className="font-medium truncate max-w-[12rem]">{row.customerName}</p>
        {row.email ? (
          <p className="text-[11px] text-muted-foreground truncate max-w-[12rem]">
            {row.email}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground max-w-[10rem] truncate">
        {row.eventName}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
        {paymentOriginLabel(row.origin)}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
        {brl(row.amount)}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {formatDate(row.createdAt)}
      </td>
      <td className="px-3 py-2.5">
        <PaymentActions
          row={row}
          busy={busy}
          onApprove={() => onApprove(row)}
          onCancel={() => onCancel(row)}
        />
      </td>
    </tr>
  );
});

const PaymentMobileCard = memo(function PaymentMobileCard({
  row,
  busy,
  onApprove,
  onCancel,
}: {
  row: PaymentRow;
  busy: boolean;
  onApprove: (row: PaymentRow) => void;
  onCancel: (row: PaymentRow) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{row.customerName}</p>
          <p className="text-xs text-muted-foreground truncate">{row.eventName}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {paymentOriginLabel(row.origin)}
          </p>
          <p className="text-base font-semibold text-brand tabular-nums">
            {brl(row.amount)}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {formatDate(row.createdAt)}
        </p>
      </div>
      <PaymentActions
        row={row}
        busy={busy}
        onApprove={() => onApprove(row)}
        onCancel={() => onCancel(row)}
        compact
      />
    </div>
  );
});
