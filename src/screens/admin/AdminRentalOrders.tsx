import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardList, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OrganizersTabs } from "@/components/admin/OrganizersTabs";
import { brl } from "@/hooks/useOrganizerStats";
import { cn } from "@/lib/utils";
import { useSearchParams } from "@/lib/router-compat";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  RENTAL_TIMELINE_STEPS,
  StatusTimeline,
  rentalTimelineIndex,
} from "@/components/site/StatusTimeline";
import {
  ORDER_COLUMNS,
  ORDER_COLUMNS_WITH_REQUESTED,
  ORDER_ITEM_COLUMNS,
  RENTAL_STATUSES,
  RENTAL_STATUS_CLASS,
  RENTAL_STATUS_LABEL,
  canAdminDeleteRentalOrder,
  configLabelOf,
  lineTotalOf,
  mapDeleteRentalOrderError,
  num,
  statusOf,
  sumItems,
  type RentalOrder,
  type RentalOrderItem,
  type RentalOrderStatus,
} from "@/lib/rentalOrders";

const db = supabase as any;

type AdminOrder = RentalOrder & { organizer_name?: string };

const ADMIN_STATUSES = RENTAL_STATUSES.filter((s) => s !== "draft");

const dateBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
};

const dateTimeBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const orderRef = (o: AdminOrder) => o.contract_number || o.id.slice(0, 8).toUpperCase();

const AdminRentalOrders = () => {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const initialStatus =
    statusFromUrl && (RENTAL_STATUSES as readonly string[]).includes(statusFromUrl)
      ? statusFromUrl
      : "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminOrder | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin_rental_orders"],
    queryFn: async (): Promise<AdminOrder[]> => {
      let res = await db
        .from("rental_orders")
        .select(ORDER_COLUMNS_WITH_REQUESTED)
        .neq("status", "draft")
        .order("requested_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (res.error && /requested_at/i.test(res.error.message || "")) {
        res = await db
          .from("rental_orders")
          .select(ORDER_COLUMNS)
          .neq("status", "draft")
          .order("created_at", { ascending: false });
      }
      if (res.error) throw res.error;
      const orders = (res.data ?? []) as RentalOrder[];

      const ids = Array.from(new Set(orders.map((o) => o.organizer_id).filter(Boolean)));
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: orgs } = await db.from("organizers").select("id,name").in("id", ids);
        for (const o of orgs ?? []) names.set(o.id, o.name);
      }

      return orders.map((o) => ({ ...o, organizer_name: names.get(o.organizer_id) || "—" }));
    },
  });

  const { data: openItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["admin_rental_order_items", open?.id],
    enabled: !!open?.id,
    queryFn: async (): Promise<RentalOrderItem[]> => {
      const { data, error } = await db
        .from("rental_order_items")
        .select(ORDER_ITEM_COLUMNS)
        .eq("order_id", open!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RentalOrderItem[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RentalOrderStatus }) => {
      const { error } = await db
        .from("rental_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Status atualizado para ${RENTAL_STATUS_LABEL[vars.status]}.`);
      qc.invalidateQueries({ queryKey: ["admin_rental_orders"] });
      setOpen((prev) => (prev && prev.id === vars.id ? { ...prev, status: vars.status } : prev));
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível atualizar o status."),
  });

  const deleteOrder = useMutation({
    mutationFn: async (order: AdminOrder) => {
      if (!canAdminDeleteRentalOrder(order.status)) {
        throw { message: "ORDER_STATUS_NOT_DELETABLE" };
      }
      const { error } = await db.rpc("delete_rental_order", { _order_id: order.id });
      if (error) throw error;
      return order.id;
    },
    onSuccess: (id) => {
      toast.success("Pedido excluído com sucesso.");
      setPendingDelete(null);
      setOpen((prev) => (prev?.id === id ? null : prev));
      qc.setQueryData<AdminOrder[]>(["admin_rental_orders"], (prev) =>
        (prev ?? []).filter((r) => r.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["admin_rental_orders"] });
      qc.removeQueries({ queryKey: ["admin_rental_order_items", id] });
    },
    onError: (e: any) => {
      toast.error(mapDeleteRentalOrderError(e ?? {}));
    },
  });

  const requestDelete = (order: AdminOrder) => {
    if (!isAdmin) return;
    if (!canAdminDeleteRentalOrder(order.status)) {
      toast.error("Pedidos já contratados ou concluídos não podem ser excluídos.");
      return;
    }
    setPendingDelete(order);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && statusOf(r.status) !== statusFilter) return false;
      if (!q) return true;
      return `${orderRef(r)} ${r.organizer_name || ""} ${r.event_name || ""} ${r.event_location || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const openTotal = num(open?.total) || sumItems(openItems);

  const ActionsCell = ({ order }: { order: AdminOrder }) => (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="outline" size="sm" className="min-h-9" onClick={() => setOpen(order)}>
        Abrir
      </Button>
      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                requestDelete(order);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir pedido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );

  return (
    <div>
      <OrganizersTabs />

      <div>
        <h1 className="font-display text-3xl font-bold">Pedidos de Locação</h1>
        <p className="text-muted-foreground mt-1">
          Solicitações de estrutura enviadas pelos organizadores. Rascunhos não aparecem aqui.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, organizador ou prova..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ADMIN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {RENTAL_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 mt-5" />
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <h2 className="font-display text-lg font-bold mt-3">Nenhuma solicitação ainda</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Quando um organizador clicar em Solicitar disponibilidade, o pedido aparece aqui para
            conferência.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={ClipboardList}
          title="Nenhum pedido encontrado"
          description={
            statusFilter !== "all" || search
              ? "Nada corresponde aos filtros. Limpe a busca ou mude o status."
              : "Quando organizadores solicitarem estruturas, os pedidos aparecem aqui."
          }
        />
      ) : (
        <>
          <div className="mt-5 hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Organizador</th>
                  <th className="p-3">Prova</th>
                  <th className="p-3">Data do evento</th>
                  <th className="p-3">Valor estimado</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Solicitado em</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{orderRef(r)}</td>
                    <td className="p-3 font-medium">{r.organizer_name}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.event_name || "—"}</div>
                      {r.event_location && (
                        <div className="text-xs text-muted-foreground">{r.event_location}</div>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">{dateBR(r.event_date)}</td>
                    <td className="p-3 tabular-nums font-semibold">{brl(num(r.total))}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          RENTAL_STATUS_CLASS[statusOf(r.status)]
                        )}
                      >
                        {RENTAL_STATUS_LABEL[statusOf(r.status)]}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground tabular-nums">
                      {dateTimeBR(r.requested_at)}
                    </td>
                    <td className="p-3 text-right">
                      <ActionsCell order={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 md:hidden space-y-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="w-full rounded-xl border border-border bg-card p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.event_name || "Prova"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.organizer_name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {orderRef(r)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      RENTAL_STATUS_CLASS[statusOf(r.status)]
                    )}
                  >
                    {RENTAL_STATUS_LABEL[statusOf(r.status)]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dateBR(r.event_date)}</span>
                  <span className="font-semibold text-foreground tabular-nums">{brl(num(r.total))}</span>
                </div>
                <ActionsCell order={r} />
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {open ? orderRef(open) : ""}</DialogTitle>
          </DialogHeader>

          {open && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/20 p-3.5 text-sm">
                <p className="font-semibold">{open.event_name || "Prova"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateBR(open.event_date)}
                  {open.event_location ? ` · ${open.event_location}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Organizador: {open.organizer_name}
                  {open.responsible_name ? ` · ${open.responsible_name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Solicitado em {dateTimeBR(open.requested_at)}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </label>
                <Select
                  value={statusOf(open.status)}
                  onValueChange={(v) => setStatus.mutate({ id: open.id, status: v as RentalOrderStatus })}
                  disabled={setStatus.isPending}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {RENTAL_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusOf(open.status) !== "cancelled" && statusOf(open.status) !== "draft" && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                    <StatusTimeline
                      steps={RENTAL_TIMELINE_STEPS}
                      currentIndex={rentalTimelineIndex(open.status).index}
                      failed={rentalTimelineIndex(open.status).failed}
                    />
                  </div>
                )}
              </div>

              {itemsLoading ? (
                <Skeleton className="h-24" />
              ) : openItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item neste pedido.</p>
              ) : (
                <ul className="space-y-2.5">
                  {openItems.map((row) => {
                    const config = configLabelOf(row.configuration);
                    return (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-3 border-b border-border pb-2.5 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <span className="block text-sm font-medium leading-tight">{row.item_name}</span>
                          {config && <span className="text-[11px] font-medium text-brand">{config}</span>}
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {num(row.quantity)} × {brl(num(row.unit_price))}
                            {row.unit_label ? ` / ${row.unit_label}` : ""}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{brl(lineTotalOf(row))}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold">Total estimado</span>
                <span className="font-display text-xl font-bold tabular-nums text-brand">
                  {brl(openTotal)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Estimativa de locação. Pagamento não é tratado nesta etapa.
              </p>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {isAdmin && open && canAdminDeleteRentalOrder(open.status) ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => requestDelete(open)}
              >
                Excluir pedido
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !deleteOrder.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[min(24rem,calc(100vw-1.5rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este pedido?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Esta ação removerá permanentemente o pedido de locação e seus itens. Essa ação
                  não poderá ser desfeita.
                </p>
                {pendingDelete ? (
                  <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 text-foreground space-y-0.5">
                    <p className="font-mono text-xs font-semibold">
                      Pedido {orderRef(pendingDelete)}
                    </p>
                    <p className="text-sm font-medium">
                      {pendingDelete.organizer_name || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pendingDelete.event_name || "—"}
                    </p>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleteOrder.isPending} className="min-h-10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteOrder.isPending || !pendingDelete}
              className="min-h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) void deleteOrder.mutateAsync(pendingDelete);
              }}
            >
              {deleteOrder.isPending ? "Excluindo…" : "Excluir pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRentalOrders;
