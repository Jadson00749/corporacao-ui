import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { OrganizersTabs } from "@/components/admin/OrganizersTabs";
import { brl } from "@/hooks/useOrganizerStats";
import { cn } from "@/lib/utils";
import {
  ORDER_COLUMNS,
  ORDER_COLUMNS_WITH_REQUESTED,
  ORDER_ITEM_COLUMNS,
  RENTAL_STATUSES,
  RENTAL_STATUS_CLASS,
  RENTAL_STATUS_LABEL,
  configLabelOf,
  lineTotalOf,
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState<AdminOrder | null>(null);

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
        <p className="mt-5 text-sm text-muted-foreground">Nenhum pedido encontrado para este filtro.</p>
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
                      <Button variant="outline" size="sm" onClick={() => setOpen(r)}>
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 md:hidden space-y-2">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpen(r)}
                className="w-full text-left rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.event_name || "Prova"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.organizer_name}</p>
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
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dateBR(r.event_date)}</span>
                  <span className="font-semibold text-foreground tabular-nums">{brl(num(r.total))}</span>
                </div>
              </button>
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

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRentalOrders;
