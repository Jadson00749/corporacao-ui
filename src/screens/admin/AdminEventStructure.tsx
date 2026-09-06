import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useProfile } from "@/hooks/useProfile";
import { Link, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Tent,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/hooks/useOrganizerStats";
import { cn } from "@/lib/utils";
import { whatsappLinkFor } from "@/lib/eventPayment";
import {
  CATALOG_COLUMNS,
  KIND_LABEL,
  KIND_QTY_LABEL,
  kindOf,
  parseOptions,
  unitOf,
  unitPriceOf,
  type RentalItem,
} from "@/lib/rentalItems";
import {
  RENTAL_STATUS_CLASS,
  RENTAL_STATUS_LABEL,
  buildRentalWhatsMessage,
  configLabelOf,
  configPayload,
  lineTotalOf,
  num,
  statusOf,
  sumItems,
} from "@/lib/rentalOrders";
import { useOrganizerEvents, useRentalOrder, type DesiredLine } from "@/hooks/useRentalOrder";

type Selected = { qty: number; optionIndex: number | null };

const MAX_QTY = 9999;
const LAST_EVENT_KEY = "corporacao:rental_last_event";

const dateBR = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
};

const dateTimeBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

const AdminEventStructure = () => {
  const { isAdmin, organizerId, organizerName } = useAuth();
  const { data: profile } = useProfile();
  const settings = useSettings();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selection, setSelection] = useState<Record<string, Selected>>({});
  const [eventId, setEventId] = useState<string>("");
  const [reviewing, setReviewing] = useState(false);
  const [justRequested, setJustRequested] = useState(false);

  // O super admin gerencia o catálogo, não monta estrutura.
  useEffect(() => {
    if (isAdmin) navigate("/admin/rental-items", { replace: true });
  }, [isAdmin, navigate]);

  const { data: events = [], isLoading: eventsLoading } = useOrganizerEvents(organizerId);

  // Retoma a última prova escolhida para não perder o contexto ao navegar.
  useEffect(() => {
    if (eventId || !events.length) return;
    let saved = "";
    try {
      saved = localStorage.getItem(LAST_EVENT_KEY) || "";
    } catch {}
    setEventId(events.some((e) => e.id === saved) ? saved : events[0].id);
  }, [events, eventId]);

  useEffect(() => {
    if (!eventId) return;
    try {
      localStorage.setItem(LAST_EVENT_KEY, eventId);
    } catch {}
  }, [eventId]);

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  const {
    order,
    items: orderItems,
    isLoading: orderLoading,
    isDraft,
    sync,
    request,
    reopen,
  } = useRentalOrder(organizerId, event, {
    name: profile?.full_name ?? null,
    phone: profile?.whatsapp ?? null,
  });

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["admin_rental_items"],
    enabled: !isAdmin,
    queryFn: async (): Promise<RentalItem[]> => {
      const { data, error } = await supabase
        .from("rental_items" as any)
        .select(CATALOG_COLUMNS)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RentalItem[];
    },
  });

  const optionsById = useMemo(
    () => new Map(items.map((i) => [i.id, parseOptions(i.options)])),
    [items]
  );

  // Reconstrói "Minha Estrutura" a partir do pedido gravado.
  // Não pode apagar a seleção local enquanto o rascunho ainda não existe
  // (senão o clique em Adicionar some na hora) nem sobrescrever enquanto
  // há alteração pendente de sync.
  const hydratedFor = useRef<string | null>(null);
  const lastEventId = useRef<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (lastEventId.current === eventId) return;
    lastEventId.current = eventId || null;
    hydratedFor.current = null;
    dirty.current = false;
    setSelection({});
  }, [eventId]);

  useEffect(() => {
    if (!order || orderLoading || !items.length) return;
    // Pedido sem linhas ainda: não zera a seleção otimista do clique em Adicionar.
    if (orderItems.length === 0) return;
    if (dirty.current) return;

    const key = `${order.id}:${orderItems.map((r) => `${r.id}:${r.quantity}:${configLabelOf(r.configuration)}`).join("|")}`;
    if (hydratedFor.current === key) return;

    const next: Record<string, Selected> = {};
    for (const row of orderItems) {
      if (!row.rental_item_id) continue;
      const opts = optionsById.get(row.rental_item_id) ?? [];
      const label = configLabelOf(row.configuration);
      const idx = label ? opts.findIndex((o) => o.label === label) : -1;
      next[row.rental_item_id] = {
        qty: Math.max(1, Math.round(num(row.quantity)) || 1),
        optionIndex: idx >= 0 ? idx : null,
      };
    }
    setSelection(next);
    hydratedFor.current = key;
  }, [order, orderItems, orderLoading, items.length, optionsById]);

  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((i) => (i.category || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && (i.category || "").trim() !== categoryFilter) return false;
      if (!q) return true;
      return `${i.name} ${i.description || ""} ${i.category || ""}`.toLowerCase().includes(q);
    });
  }, [items, search, categoryFilter]);

  const lines = useMemo(
    () =>
      items
        .filter((i) => selection[i.id])
        .map((i) => {
          const sel = selection[i.id];
          const opts = optionsById.get(i.id) ?? [];
          const option = sel.optionIndex != null ? opts[sel.optionIndex] : undefined;
          const unitPrice = unitPriceOf(i, option);
          return {
            item: i,
            kind: kindOf(i.unit_type),
            qty: sel.qty,
            option,
            unitPrice,
            subtotal: unitPrice * sel.qty,
          };
        }),
    [items, selection, optionsById]
  );

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const hasSelection = lines.length > 0;

  /** Grava a seleção. Agrupado num debounce curto para o stepper não gerar uma escrita por clique. */
  const desired: DesiredLine[] = useMemo(
    () =>
      lines.map((l) => ({
        rental_item_id: l.item.id,
        item_name: l.item.name,
        unit_type: l.item.unit_type,
        unit_label: l.item.unit_label,
        quantity: l.qty,
        unit_price: l.unitPrice,
        configuration: configPayload(l.option?.label),
      })),
    [lines]
  );

  const markDirty = () => {
    dirty.current = true;
  };

  useEffect(() => {
    if (!dirty.current || !isDraft || !event) return;
    const snapshot = desired;
    const timer = setTimeout(() => {
      sync(snapshot)
        .then(() => {
          dirty.current = false;
        })
        .catch((e: any) => {
          // Mantém dirty para a seleção local não ser sobrescrita por um hydrate vazio.
          toast.error(e?.message || "Não foi possível salvar a estrutura.");
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [desired, isDraft, event, sync]);

  const addItem = (item: RentalItem) => {
    const kind = kindOf(item.unit_type);
    const opts = optionsById.get(item.id) ?? [];
    markDirty();
    setSelection((prev) => ({
      ...prev,
      [item.id]: { qty: 1, optionIndex: kind === "configuration" && opts.length > 0 ? 0 : null },
    }));
  };

  const removeItem = (id: string) => {
    markDirty();
    setSelection((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setQty = (id: string, qty: number) => {
    markDirty();
    setSelection((prev) => {
      const current = prev[id];
      if (!current) return prev;
      if (!Number.isFinite(qty) || qty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...current, qty: Math.min(Math.floor(qty), MAX_QTY) } };
    });
  };

  const setOption = (id: string, optionIndex: number) => {
    markDirty();
    setSelection((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], optionIndex } } : prev));
  };

  const clearSelection = () => {
    markDirty();
    setSelection({});
  };

  const status = statusOf(order?.status);
  const requested = !!order && status !== "draft";
  const requestedItems = orderItems;
  const requestedTotal = num(order?.total) || sumItems(requestedItems);

  const whatsMessage = buildRentalWhatsMessage({
    organizer: organizerName || profile?.full_name || "",
    eventName: order?.event_name || event?.name || "",
    eventDate: order?.event_date || event?.date || "",
    eventLocation: order?.event_location || event?.city || "",
    items: requested
      ? requestedItems
      : desired.map((d, idx) => ({
          id: String(idx),
          order_id: "",
          rental_item_id: d.rental_item_id,
          item_name: d.item_name,
          unit_type: d.unit_type,
          unit_label: d.unit_label,
          quantity: d.quantity,
          unit_price: d.unit_price,
          configuration: d.configuration,
          line_total: d.quantity * d.unit_price,
        })),
    total: requested ? requestedTotal : total,
  });

  const whatsLink = whatsappLinkFor(settings.contact.whatsapp, whatsMessage);

  const confirmRequest = async () => {
    // Garante que a última alteração está gravada antes de mudar o status.
    try {
      dirty.current = true;
      await sync(desired);
      dirty.current = false;
      await request.mutateAsync();
      setReviewing(false);
      setJustRequested(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a solicitação.");
    }
  };

  const editRequest = async () => {
    try {
      await reopen.mutateAsync();
      setJustRequested(false);
      toast.success("Solicitação reaberta como rascunho. Ajuste e solicite de novo.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível reabrir a solicitação.");
    }
  };

  if (isAdmin) {
    return <div className="text-sm text-muted-foreground">Redirecionando...</div>;
  }

  const showSearch = items.length > 6;
  const showCategories = categories.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Locação de Estruturas</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Monte a estrutura da sua prova escolhendo equipamentos e serviços disponíveis.
          </p>
        </div>
        {hasSelection && isDraft && (
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <Trash2 className="w-4 h-4" /> Limpar seleção
          </Button>
        )}
      </div>

      {/* Prova vinculada */}
      <div className="rounded-xl border border-border bg-card p-4">
        {eventsLoading ? (
          <Skeleton className="h-10" />
        ) : events.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm font-semibold">Nenhuma prova cadastrada</p>
            <p className="text-xs text-muted-foreground mt-1">
              A locação é sempre vinculada a uma prova. Cadastre a sua para montar a estrutura.
            </p>
            <Button asChild variant="brand" size="sm" className="mt-3">
              <Link to="/admin/events">Cadastrar prova</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px] flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Prova
              </label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a prova" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                      {e.date ? ` — ${dateBR(e.date)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {event && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {dateBR(event.date) || "sem data"}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {event.city || "local não informado"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!event ? null : requested ? (
        /* ---------- Pedido já solicitado ---------- */
        <div className="rounded-2xl border border-brand/50 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15">
                <CheckCircle2 className="h-5 w-5 text-brand" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">
                  {justRequested ? "Solicitação enviada" : "Disponibilidade solicitada"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order?.requested_at
                    ? `Solicitação enviada em ${dateTimeBR(order.requested_at)}.`
                    : "Solicitação registrada."}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                RENTAL_STATUS_CLASS[status]
              )}
            >
              {RENTAL_STATUS_LABEL[status]}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            A Corporação verificará a disponibilidade dos itens para a data do seu evento e entrará
            em contato com você em breve.
          </p>

          <div className="rounded-xl border border-border bg-background/60 p-3.5 text-sm">
            <p className="font-semibold">{order?.event_name || event.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateBR(order?.event_date || event.date)}
              {(order?.event_location || event.city) && ` · ${order?.event_location || event.city}`}
            </p>
          </div>

          <ul className="space-y-2.5">
            {requestedItems.map((row) => {
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
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {brl(lineTotalOf(row))}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold">Total estimado</span>
            <span className="font-display text-2xl font-bold tabular-nums text-brand">
              {brl(requestedTotal)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O valor exibido é uma estimativa da locação e não representa pagamento realizado.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {whatsLink && (
              <Button asChild variant="outline" className="sm:flex-1">
                <a href={whatsLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="w-4 h-4" /> Enviar solicitação pelo WhatsApp
                </a>
              </Button>
            )}
            {status === "requested" && (
              <Button variant="ghost" onClick={editRequest} disabled={reopen.isPending}>
                {reopen.isPending ? "Reabrindo..." : "Editar solicitação"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* ---------- Catálogo + rascunho ---------- */
        <>
          {(showSearch || showCategories) && (
            <div className="flex flex-wrap items-center gap-2">
              {showSearch && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar item..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              )}
              {showCategories && (
                <div className="flex flex-wrap items-center gap-2">
                  {[["all", "Todas"] as const, ...categories.map((c) => [c, c] as const)].map(
                    ([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategoryFilter(key)}
                        className={cn(
                          "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                          categoryFilter === key
                            ? "border-brand bg-brand/15 text-brand"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5 items-start">
            <div className="lg:col-span-2">
              {isLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                  <Skeleton className="h-56" />
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
                  <p className="text-sm text-destructive font-medium">
                    Não foi possível carregar o catálogo.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recarregue a página para tentar novamente.
                  </p>
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto">
                    <Tent className="w-7 h-7 text-muted-foreground/60" />
                  </div>
                  <h2 className="font-display text-lg font-bold mt-4">Catálogo em preparação</h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                    Nenhum equipamento ou serviço ativo disponível no momento. Os itens aparecem aqui
                    automaticamente conforme forem liberados para locação.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                  <h2 className="font-display text-base font-bold">Nenhum item encontrado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajuste a busca ou escolha outra categoria.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filtered.map((item) => {
                    const kind = kindOf(item.unit_type);
                    const opts = optionsById.get(item.id) ?? [];
                    const sel = selection[item.id];
                    const isSelected = !!sel;
                    const option = sel?.optionIndex != null ? opts[sel.optionIndex] : undefined;
                    const unitPrice = unitPriceOf(item, option);
                    const unit = unitOf(item, kind);
                    // Um item configurável sem opções utilizáveis vira seleção simples.
                    const isConfigurable = kind === "configuration" && opts.length > 0;
                    const isStepper = kind === "quantity" || kind === "meters" || kind === "days";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex flex-col rounded-xl border bg-card overflow-hidden transition-colors",
                          isSelected ? "border-brand/60 ring-1 ring-brand/20" : "border-border"
                        )}
                      >
                        <div className="aspect-[16/10] bg-secondary/40 flex items-center justify-center overflow-hidden relative">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Tent className="w-8 h-8 text-muted-foreground/40" />
                          )}
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <div className="p-3 flex flex-col gap-1.5 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            {item.category ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                                {item.category}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 shrink-0">
                              {KIND_LABEL[kind]}
                            </span>
                          </div>

                          <h2 className="font-display text-sm font-bold leading-tight">{item.name}</h2>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-auto pt-2 space-y-2">
                            <div className="flex items-baseline gap-1">
                              <span className="font-display text-base font-bold tabular-nums">
                                {brl(unitPrice)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">/ {unit}</span>
                            </div>

                            {isConfigurable && (
                              <Select
                                value={String(sel?.optionIndex ?? 0)}
                                onValueChange={(v) => {
                                  if (!isSelected) addItem(item);
                                  setOption(item.id, Number(v));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {opts.map((o, idx) => (
                                    <SelectItem key={`${o.label}-${idx}`} value={String(idx)}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {isStepper && isSelected && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  aria-label={`Diminuir ${KIND_QTY_LABEL[kind].toLowerCase()} de ${item.name}`}
                                  onClick={() => setQty(item.id, sel.qty - 1)}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min={1}
                                  max={MAX_QTY}
                                  inputMode="numeric"
                                  value={sel.qty}
                                  aria-label={`${KIND_QTY_LABEL[kind]} de ${item.name}`}
                                  onChange={(e) => setQty(item.id, Number(e.target.value))}
                                  className="h-8 text-center text-xs tabular-nums px-1"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  aria-label={`Aumentar ${KIND_QTY_LABEL[kind].toLowerCase()} de ${item.name}`}
                                  onClick={() => setQty(item.id, sel.qty + 1)}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                                <span className="text-[10px] text-muted-foreground shrink-0 w-12 text-right">
                                  {KIND_QTY_LABEL[kind]}
                                </span>
                              </div>
                            )}

                            {isSelected ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  Subtotal{" "}
                                  <span className="font-semibold text-foreground">
                                    {brl(unitPrice * sel.qty)}
                                  </span>
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remover
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" className="w-full h-8" onClick={() => addItem(item)}>
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <aside
              className={cn(
                "rounded-2xl border p-5 lg:sticky lg:top-6 transition-colors",
                hasSelection ? "border-brand/50 bg-card" : "border-dashed border-border bg-card/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  className={cn(
                    "font-display font-bold",
                    hasSelection ? "text-lg" : "text-base text-muted-foreground"
                  )}
                >
                  Minha Estrutura
                </h2>
                {hasSelection && (
                  <span className="rounded-full bg-brand/15 text-brand text-xs font-bold px-2.5 py-0.5 tabular-nums">
                    {lines.length}
                  </span>
                )}
              </div>

              {!hasSelection ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Os itens que você adicionar ao catálogo aparecem aqui com o resumo de valores. A
                  seleção fica salva na prova escolhida.
                </p>
              ) : (
                <>
                  <ul className="mt-4 space-y-3">
                    {lines.map(({ item, kind, qty, option, unitPrice, subtotal }) => (
                      <li key={item.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium leading-tight block">{item.name}</span>
                            {option && (
                              <span className="text-[11px] text-brand font-medium">{option.label}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remover ${item.name} da estrutura`}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                          <span>
                            {qty} × {brl(unitPrice)} / {unitOf(item, kind)}
                          </span>
                          <span className="font-semibold text-foreground">{brl(subtotal)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between">
                    <span className="text-sm font-semibold">Total estimado</span>
                    <span className="font-display text-2xl font-bold tabular-nums text-brand">
                      {brl(total)}
                    </span>
                  </div>

                  <Button
                    variant="brand"
                    size="lg"
                    className="w-full mt-4"
                    onClick={() => setReviewing(true)}
                  >
                    <ClipboardList className="w-4 h-4" /> Solicitar disponibilidade
                  </Button>

                  <p className="text-[11px] text-muted-foreground mt-2">
                    O valor exibido é uma estimativa da locação e não representa pagamento realizado.
                  </p>
                </>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Revisão antes de solicitar */}
      <Dialog open={reviewing} onOpenChange={(o) => !o && setReviewing(false)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar disponibilidade</DialogTitle>
            <DialogDescription>
              Confira a estrutura antes de enviar. A Corporação vai verificar a disponibilidade para
              a data da prova.
            </DialogDescription>
          </DialogHeader>

          {event && (
            <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
              <p className="text-sm font-semibold">{event.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dateBR(event.date)}
                {event.city && ` · ${event.city}`}
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {lines.map(({ item, kind, qty, option, unitPrice, subtotal }) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="block font-medium leading-tight">{item.name}</span>
                  {option && <span className="text-[11px] text-brand font-medium">{option.label}</span>}
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {qty} × {brl(unitPrice)} / {unitOf(item, kind)}
                  </span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{brl(subtotal)}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold">Total estimado</span>
            <span className="font-display text-xl font-bold tabular-nums text-brand">{brl(total)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estimativa de locação. Nenhum pagamento é feito nesta etapa.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewing(false)}>
              Voltar
            </Button>
            <Button variant="brand" onClick={confirmRequest} disabled={request.isPending}>
              {request.isPending ? "Enviando..." : "Confirmar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEventStructure;
