import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Pencil, Trash2, Plus, Package } from "lucide-react";
import { toast } from "sonner";
import { isKidsDistance } from "@/lib/eventPricing";
import {
  type EventCoupon,
  toAdminCouponDraft,
  validateCouponFields,
} from "@/lib/eventCoupons";
import {
  collectKitShirtSizes,
  normalizeShirtSize,
  parseShirtSizeStock,
  shirtSizeStockLimit,
  adminShirtStockSaveErrorMessage,
} from "@/lib/shirtSizeStock";
import { adminEventCapacitySaveErrorMessage } from "@/lib/eventCapacity";
import { type EventKitOption } from "@/lib/eventKits";
import { EventEditorDialog } from "@/components/admin/EventEditorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizerStats, brl, isMainOrg } from "@/hooks/useOrganizerStats";
import { useOrganizerPayment } from "@/lib/eventPayment";
import { Link, useSearchParams } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import {
  clearSessionKey,
  eventDraftKey,
  EVENT_DRAFT_ACTIVE_KEY,
  peekSessionDraft,
  writeSessionEnvelope,
  type ActiveDraftPointer,
} from "@/lib/sessionDraft";
import { useSessionDraft, loadSessionDraftData } from "@/hooks/useSessionDraft";


type Distance = { distance: string; price?: number; price_lote2?: number; lote2_starts_at?: string | null; price_lote3?: number; lote3_starts_at?: string | null; price_60_plus?: number };
type AgeBracket = { min: number; max: number };
type KitOption = EventKitOption;

type Coupon = EventCoupon;
type EventDocument = { label: string; url: string };

const emptyEvent = () => ({
  name: "", date: "", city: "", distance: "", description: "",
  registration_url: "", status: "open", internal_signup: true,
  banner_image: "", banner_mobile_image: "", banner_aspect_ratio: "9:16", image: "", active: true, sort_order: 0,
  regulation_url: "", kit_info: "", kit_delivery: "", more_info: "",
  registration_deadline: "",
  start_time: "", pix_key: "", pix_recipient: "", payment_instructions: "",
  max_slots: null as number | null,
  distances: [] as Distance[],
  genders: ["Masculino", "Feminino"] as string[],
  age_brackets: [] as AgeBracket[],
  kit_options: [] as KitOption[],
  coupons: [] as Coupon[],
  documents: [] as EventDocument[],
  event_terms: "",
  shirt_size_stock: {} as Record<string, number>,
});

const AdminEvents = () => {
  const qc = useQueryClient();
  const { isAdmin, organizerId } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customSize, setCustomSize] = useState<Record<number, string>>({});
  /** Contagem de usos por código (uppercase) para a prova em edição. */
  const [couponUses, setCouponUses] = useState<Record<string, number>>({});
  /** Inscrições não canceladas por tamanho de camiseta. */
  const [shirtSizeUses, setShirtSizeUses] = useState<Record<string, number>>({});
  /** Total de inscrições não canceladas da prova em edição. */
  const [activeSignupsCount, setActiveSignupsCount] = useState(0);

  const { data: rows = [], refetch, isLoading } = useQuery({
    queryKey: ["admin_events", isAdmin ? "all" : organizerId],
    queryFn: async () => {
      let q = supabase.from("events").select("*").order("date", { ascending: false });
      if (!isAdmin && organizerId) q = q.eq("organizer_id" as any, organizerId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || !!organizerId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const draftKey = editing
    ? eventDraftKey(editing.id ? String(editing.id) : null)
    : null;
  useSessionDraft({
    key: draftKey,
    value: editing,
    enabled: !!editing,
    debounceMs: 400,
  });

  const openNewEvent = () => {
    const key = eventDraftKey(null);
    const draft = loadSessionDraftData<any>(key);
    writeSessionEnvelope<ActiveDraftPointer>(EVENT_DRAFT_ACTIVE_KEY, {
      kind: "new",
      id: null,
    });
    if (draft && typeof draft === "object") {
      setEditing({ ...emptyEvent(), ...draft, id: undefined });
      toast.message("Rascunho recuperado");
    } else {
      setEditing(emptyEvent());
    }
  };

  // Visão analítica de propriedade das provas (somente ADMIN)
  const stats = useOrganizerStats(isAdmin);
  const [searchParams] = useSearchParams();
  const [ownership, setOwnership] = useState<"all" | "corp" | "external">("all");
  const [orgFilter, setOrgFilter] = useState<string>(searchParams.get("organizer") || "all");

  // Provas da "Corporação": sem organizer_id ou vinculadas à organização principal
  const isCorpEvent = (organizerId?: string | null) => {
    if (!organizerId) return true;
    return isMainOrg(stats.organizerMap.get(organizerId)?.name);
  };
  const partnerOrganizers = useMemo(
    () => stats.organizers.filter((o) => !isMainOrg(o.name)),
    [stats.organizers]
  );

  const visibleRows = useMemo(() => {
    if (!isAdmin) return rows as any[];
    return (rows as any[]).filter((r) => {
      const corp = isCorpEvent(r.organizer_id);
      if (ownership === "corp" && !corp) return false;
      if (ownership === "external" && corp) return false;
      if (orgFilter === "corp") return corp;
      if (orgFilter !== "all") return r.organizer_id === orgFilter;
      return true;
    });
  }, [rows, isAdmin, ownership, orgFilter, stats.organizerMap]);

  const canManageEvent = (row: { organizer_id?: string | null } | null | undefined) =>
    isAdmin || (!!organizerId && row?.organizer_id === organizerId);

  // Quem recebe o pagamento da prova em edição. Prova nova de organizador ainda
  // não tem organizer_id no rascunho, então cai no vínculo do usuário logado.
  const editingOrgId: string | null = editing
    ? editing.organizer_id ?? (isAdmin ? null : organizerId)
    : null;
  const { data: editingOrg } = useOrganizerPayment(editingOrgId);
  const editingIsPartner = !!editingOrgId && !!editingOrg && !isMainOrg(editingOrg.name);

  const unauthorizedOrMissing = () =>
    toast.error("Registro não encontrado ou operação não autorizada.");

  const openEdit = async (r: any) => {
    if (!canManageEvent(r)) return unauthorizedOrMissing();
    const base = {
      ...r,
      banner_aspect_ratio: r.banner_aspect_ratio ?? "9:16",
      banner_mobile_image: r.banner_mobile_image ?? "",
      pix_key: r.pix_key ?? "",
      pix_recipient: r.pix_recipient ?? "",
      payment_instructions: r.payment_instructions ?? "",
      shirt_size_stock: parseShirtSizeStock(r.shirt_size_stock),
      coupons: Array.isArray(r.coupons)
        ? r.coupons.map((c: any) => toAdminCouponDraft(c))
        : [],
    };
    writeSessionEnvelope<ActiveDraftPointer>(EVENT_DRAFT_ACTIVE_KEY, {
      kind: "edit",
      id: String(r.id),
    });
    const draft = loadSessionDraftData<any>(eventDraftKey(String(r.id)));
    if (draft && typeof draft === "object") {
      setEditing({ ...base, ...draft, id: r.id });
      toast.message("Rascunho recuperado");
    } else {
      setEditing(base);
    }
    setCouponUses({});
    setShirtSizeUses({});
    setActiveSignupsCount(0);
    if (r?.id) {
      const { data } = await supabase
        .from("event_signups")
        .select("coupon_code, status, shirt_size")
        .eq("event_id", r.id);
      const counts: Record<string, number> = {};
      const sizeCounts: Record<string, number> = {};
      let active = 0;
      for (const row of data ?? []) {
        if (String((row as any).status || "").toLowerCase() === "cancelada") continue;
        active += 1;
        const code = String((row as any).coupon_code || "").trim().toUpperCase();
        if (code) counts[code] = (counts[code] || 0) + 1;
        const sz = normalizeShirtSize((row as any).shirt_size);
        if (sz) sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
      }
      setCouponUses(counts);
      setShirtSizeUses(sizeCounts);
      setActiveSignupsCount(active);
    }
  };

  const closeEditor = () => {
    if (!editing) return;
    const key = eventDraftKey(editing.id ? String(editing.id) : null);
    if (peekSessionDraft(key)) {
      if (!window.confirm("Descartar alterações não salvas?")) return;
      clearSessionKey(key);
    }
    clearSessionKey(EVENT_DRAFT_ACTIVE_KEY);
    setEditing(null);
  };

  const restoredEventRef = useRef(false);
  useEffect(() => {
    if (restoredEventRef.current || editing || isLoading) return;
    const active = loadSessionDraftData<ActiveDraftPointer>(EVENT_DRAFT_ACTIVE_KEY);
    if (!active) return;
    restoredEventRef.current = true;
    if (active.kind === "edit" && active.id) {
      const row = (rows as any[]).find((r) => r.id === active.id);
      if (row) void openEdit(row);
      return;
    }
    if (peekSessionDraft(eventDraftKey(null))) {
      openNewEvent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, rows, editing]);


  const save = async () => {
    const badLote = (editing?.distances ?? []).find(
      (d: Distance) => d.lote3_starts_at && (!d.lote2_starts_at || d.lote3_starts_at < d.lote2_starts_at)
    );
    if (badLote) {
      return toast.error(`Distância "${badLote.distance || "sem nome"}": a data do 3º lote deve ser posterior à do 2º lote.`);
    }
    const kidsWithSenior = (editing?.distances ?? []).find(
      (d: Distance) => isKidsDistance(d.distance) && typeof d.price_60_plus === "number" && d.price_60_plus > 0
    );
    if (kidsWithSenior) {
      return toast.error(`Modalidade "${kidsWithSenior.distance || "KIDS"}": não é permitido configurar valor 60+ para distâncias KIDS/Infantil.`);
    }

    for (const c of (editing?.coupons ?? []) as Coupon[]) {
      if (!String(c.code || "").trim()) continue;
      const hasDiscountConfig =
        c.type === "percentage" ||
        c.type === "fixed" ||
        (c.value != null && String(c.value) !== "" && Number(c.value) > 0);
      // Legado sem type/value: mantém como está (não força desconto inventado).
      if (!hasDiscountConfig) continue;
      const err = validateCouponFields({
        ...c,
        type: c.type === "fixed" ? "fixed" : "percentage",
        value: Number(c.value),
        active: c.active !== false,
      });
      if (err) return toast.error(err);
    }

    const stock = parseShirtSizeStock(editing?.shirt_size_stock);
    for (const size of collectKitShirtSizes(editing?.kit_options)) {
      const lim = shirtSizeStockLimit(stock, size);
      if (lim == null) continue;
      const used = shirtSizeUses[size] || 0;
      if (lim < used) {
        return toast.error(
          `Já existem ${used} inscrições reservando o tamanho ${size}. O limite não pode ser menor que ${used}.`
        );
      }
    }
    // Também valida limites órfãos (tamanho fora dos kits atuais)
    for (const [size, lim] of Object.entries(stock)) {
      const used = shirtSizeUses[size] || 0;
      if (lim < used) {
        return toast.error(
          `Já existem ${used} inscrições reservando o tamanho ${size}. O limite não pode ser menor que ${used}.`
        );
      }
    }

    const maxSlotsRaw = editing?.max_slots;
    if (maxSlotsRaw != null && String(maxSlotsRaw) !== "") {
      const maxSlots = Number(maxSlotsRaw);
      if (Number.isFinite(maxSlots) && maxSlots > 0 && maxSlots < activeSignupsCount) {
        return toast.error(
          `Já existem ${activeSignupsCount} inscrições ativas. O limite da prova não pode ser menor que ${activeSignupsCount}.`
        );
      }
    }

    const payload: any = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    payload.pix_key = payload.pix_key ?? "";
    payload.pix_recipient = payload.pix_recipient ?? "";
    payload.payment_instructions = payload.payment_instructions ?? "";
    payload.shirt_size_stock = stock;
    if (!payload.registration_deadline) payload.registration_deadline = null;
    payload.coupons = ((payload.coupons ?? []) as Coupon[])
      .filter((c) => String(c.code || "").trim())
      .map((c) => {
        const code = String(c.code).trim();
        const description = String(c.description || "").trim();
        const active = c.active !== false;
        const type = c.type === "fixed" ? "fixed" : c.type === "percentage" ? "percentage" : undefined;
        const valueNum = c.value != null && String(c.value) !== "" ? Number(c.value) : NaN;
        const value = Number.isFinite(valueNum) && valueNum > 0 ? valueNum : undefined;

        if (type && value != null) {
          const maxUsesRaw = c.max_uses;
          const maxUsesNum =
            maxUsesRaw != null && String(maxUsesRaw) !== ""
              ? Number(maxUsesRaw)
              : NaN;
          const max_uses =
            Number.isFinite(maxUsesNum) && maxUsesNum > 0
              ? Math.floor(maxUsesNum)
              : null;
          return {
            code,
            type,
            value: type === "percentage" ? Math.min(value, 100) : value,
            ...(description ? { description } : {}),
            active,
            ...(max_uses != null ? { max_uses } : {}),
          };
        }

        // Preserva formato legado se ainda não houver desconto configurado
        return {
          code,
          ...(description ? { description } : {}),
          active,
        };
      });
    const isNew = !payload.id;

    if (!isAdmin) {
      if (!organizerId) return unauthorizedOrMissing();
      if (!isNew && !canManageEvent(editing)) return unauthorizedOrMissing();
    }

    if (isNew) {
      delete payload.id;
      if (!isAdmin) payload.organizer_id = organizerId;
    } else if (!isAdmin) {
      delete payload.organizer_id;
    }

    if (isNew) {
      const { data, error } = await supabase.from("events").insert(payload).select("id").maybeSingle();
      if (error) {
        const stockMsg = adminShirtStockSaveErrorMessage(error);
        const capMsg = adminEventCapacitySaveErrorMessage(error);
        return toast.error(stockMsg || capMsg || error.message);
      }
      if (!isAdmin && !data) return unauthorizedOrMissing();
    } else if (isAdmin) {
      const { error } = await supabase.from("events").update(payload).eq("id", payload.id).select("id").maybeSingle();
      if (error) {
        const stockMsg = adminShirtStockSaveErrorMessage(error);
        const capMsg = adminEventCapacitySaveErrorMessage(error);
        return toast.error(stockMsg || capMsg || error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", payload.id)
        .eq("organizer_id" as any, organizerId)
        .select("id")
        .maybeSingle();
      if (error) {
        const stockMsg = adminShirtStockSaveErrorMessage(error);
        const capMsg = adminEventCapacitySaveErrorMessage(error);
        return toast.error(stockMsg || capMsg || error.message);
      }
      if (!data) return unauthorizedOrMissing();
    }

    toast.success(isNew ? "Criado!" : "Atualizado!");
    const savedEventId = payload?.id as string | undefined;
    clearSessionKey(eventDraftKey(isNew ? null : savedEventId ?? editing?.id));
    if (isNew) clearSessionKey(eventDraftKey(null));
    clearSessionKey(EVENT_DRAFT_ACTIVE_KEY);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["events"] });
    if (savedEventId) {
      qc.invalidateQueries({ queryKey: ["event_shirt_size_availability", savedEventId] });
    }
    refetch();
  };

  const remove = async (id: string) => {
    const row = (rows as any[]).find((r) => r.id === id);
    if (!canManageEvent(row)) return unauthorizedOrMissing();

    setDeleting(true);
    try {
      if (isAdmin) {
        const { error } = await supabase.from("events").delete().eq("id", id);
        if (error) return toast.error(error.message);
      } else {
        const { data, error } = await supabase
          .from("events")
          .delete()
          .eq("id", id)
          .eq("organizer_id" as any, organizerId)
          .select("id")
          .maybeSingle();
        if (error) return toast.error(error.message);
        if (!data) return unauthorizedOrMissing();
      }

      toast.success("Excluída");
      setPendingDelete(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (row: any, v: boolean) => {
    if (!canManageEvent(row)) return unauthorizedOrMissing();

    if (isAdmin) {
      await supabase.from("events").update({ active: v }).eq("id", row.id);
      refetch();
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .update({ active: v })
      .eq("id", row.id)
      .eq("organizer_id" as any, organizerId)
      .select("id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return unauthorizedOrMissing();
    refetch();
  };

  const BANNER_BUCKET = "corporacao-bucket";

  const uploadToBanners = async (file: File, folder: string) => {
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${folder}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage
      .from(BANNER_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const uploadBanner = async (file: File) => {
    const url = await uploadToBanners(file, "events/banners");
    if (!url) return;
    setEditing({ ...editing, banner_image: url });
    toast.success("Banner enviado");
  };

  const uploadMobileBanner = async (file: File) => {
    const url = await uploadToBanners(file, "events/banners/mobile");
    if (!url) return;
    setEditing({ ...editing, banner_mobile_image: url });
    toast.success("Arte mobile enviada");
  };


  const uploadDocument = async (idx: number, file: File) => {
    const url = await uploadToBanners(file, "events/documents");
    if (!url) return;
    const next = [...editing.documents];
    next[idx] = { ...next[idx], url, label: next[idx].label || file.name.replace(/\.[^.]+$/, "") };
    setEditing({ ...editing, documents: next });
    toast.success("Documento enviado");
  };


  // Auto-fill `distance` text from distances list
  useEffect(() => {
    if (editing && editing.distances?.length) {
      const txt = editing.distances.map((d: Distance) => d.distance).join(" • ");
      if (txt && txt !== editing.distance) setEditing((e: any) => ({ ...e, distance: txt }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.distances]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Provas</h1>
          <p className="text-muted-foreground mt-1">{visibleRows.length} {visibleRows.length === 1 ? "prova" : "provas"}</p>
        </div>
        <Button variant="brand" onClick={openNewEvent}><Plus className="w-4 h-4" /> Nova prova</Button>
      </div>

      {isAdmin && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {([["all", "Todas"], ["corp", "Corporação"], ["external", "Organizadores externos"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setOwnership(k); setOrgFilter("all"); }}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                ownership === k ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
          <select
            className="ml-auto border border-input bg-background rounded-md h-9 px-3 text-sm"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="all">
              {ownership === "external" ? "Todos os parceiros" : "Todos os organizadores"}
            </option>
            {ownership !== "external" && <option value="corp">Corporação</option>}
            {(ownership === "external" ? partnerOrganizers : stats.organizers).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 bg-card border border-border rounded-xl divide-y divide-border">
        {isLoading && <div className="p-6 text-muted-foreground">Carregando...</div>}
        {!isLoading && visibleRows.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma prova encontrada.</p>
            <Button variant="brand" className="mt-4" onClick={openNewEvent}>
              <Plus className="w-4 h-4" /> Nova prova
            </Button>
          </div>
        )}
        {visibleRows.map((r: any) => {
          const org = r.organizer_id ? stats.organizerMap.get(r.organizer_id) : null;
          const corp = isCorpEvent(r.organizer_id);
          const st = stats.eventStats(r.id);
          return (
          <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {(r.banner_image || r.image) && <img src={r.banner_image || r.image} alt="" className="w-20 h-12 rounded object-cover" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.date} · {r.city} · {r.distance}</div>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        corp ? "bg-brand/15 text-brand" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      )}
                    >
                      {corp ? "Corporação" : "Organizador externo"}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        r.active ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.active ? "Ativa" : "Inativa"}
                    </span>
                    {!corp && (
                      <span className="text-[11px] text-muted-foreground">
                        {org?.name || "Organizador"} • comissão {org?.commission_percentage ?? 0}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <div>
                  <div className="text-[11px] text-muted-foreground">Inscrições</div>
                  <div className="font-semibold tabular-nums">{st.approved}/{st.signups}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Valor aprovado est.</div>
                  <div className="font-semibold tabular-nums">{brl(st.approvedValue)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Comissão est.</div>
                  <div className="font-semibold tabular-nums">{r.organizer_id ? brl(st.commission) : "—"}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={!!r.active} onCheckedChange={(v) => toggleActive(r, v)} />
                <span className="hidden sm:inline">{r.active ? "Ativa" : "Inativa"}</span>
              </label>
              <Button variant="outline" size="sm" asChild title="Pedidos da prova">
                <Link to={`/admin/store-orders?event=${r.id}`}>
                  <Package className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPendingDelete({
                    id: r.id,
                    name: String(r.name || "esta prova").trim() || "esta prova",
                  })
                }
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          );
        })}

      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prova?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !pendingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) void remove(pendingDelete.id);
              }}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && (
        <EventEditorDialog
          editing={editing}
          setEditing={setEditing}
          onClose={closeEditor}
          onSave={save}
          isAdmin={isAdmin}
          organizerId={organizerId}
          editingIsPartner={editingIsPartner}
          editingOrg={editingOrg}
          couponUses={couponUses}
          shirtSizeUses={shirtSizeUses}
          activeSignupsCount={activeSignupsCount}
          customSize={customSize}
          setCustomSize={setCustomSize}
          onUploadBanner={uploadBanner}
          onUploadMobile={uploadMobileBanner}
          onUploadDocument={uploadDocument}
        />
      )}
    </div>
  );
};


export default AdminEvents;
