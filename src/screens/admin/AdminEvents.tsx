import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { isKidsDistance } from "@/lib/eventPricing";
import { EventBannerConfig } from "@/components/admin/EventBannerConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizerStats, brl, isMainOrg } from "@/hooks/useOrganizerStats";
import { useSearchParams } from "@/lib/router-compat";
import { cn } from "@/lib/utils";



type Distance = { distance: string; price?: number; price_lote2?: number; lote2_starts_at?: string | null; price_lote3?: number; lote3_starts_at?: string | null; price_60_plus?: number };
type AgeBracket = { min: number; max: number };
type KitOption = { name: string; extra_price?: number; sizes?: string[]; has_shirt?: boolean; size_chart_url?: string; size_chart_info?: string };

const DEFAULT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];
type Coupon = { code: string; description?: string };
type EventDocument = { label: string; url: string };

const DEFAULT_BRACKETS: AgeBracket[] = [
  { min: 18, max: 29 }, { min: 30, max: 39 }, { min: 40, max: 49 },
  { min: 50, max: 59 }, { min: 60, max: 99 },
];

const DEFAULT_DISTANCE_OPTIONS = ["5K", "10K", "10,5K", "21K", "42K"];

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
});

const AdminEvents = () => {
  const qc = useQueryClient();
  const { isAdmin, isOrganizer, organizerId } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const [customSize, setCustomSize] = useState<Record<number, string>>({});

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
  });

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




  const openEdit = async (r: any) => {
    setEditing({
      ...r,
      banner_aspect_ratio: r.banner_aspect_ratio ?? "9:16",
      banner_mobile_image: r.banner_mobile_image ?? "",
      pix_key: r.pix_key ?? "",
      pix_recipient: r.pix_recipient ?? "",
      payment_instructions: r.payment_instructions ?? "",
    });
  };


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

    const payload: any = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    payload.pix_key = payload.pix_key ?? "";
    payload.pix_recipient = payload.pix_recipient ?? "";
    payload.payment_instructions = payload.payment_instructions ?? "";
    if (!payload.registration_deadline) payload.registration_deadline = null;
    if (isOrganizer && organizerId) payload.organizer_id = organizerId;
    const isNew = !payload.id;
    if (isNew) delete payload.id;
    const { error } = isNew
      ? await supabase.from("events").insert(payload).select("id").maybeSingle()
      : await supabase.from("events").update(payload).eq("id", payload.id).select("id").maybeSingle();
    if (error) return toast.error(error.message);

    toast.success(isNew ? "Criado!" : "Atualizado!");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["events"] });
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir prova?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    refetch();
  };

  const toggleActive = async (row: any, v: boolean) => {
    await supabase.from("events").update({ active: v }).eq("id", row.id);
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


  // Helpers for editing distances/brackets/kit/coupons
  const addItem = (key: string, item: any) =>
    setEditing({ ...editing, [key]: [...(editing[key] || []), item] });
  const updateItem = (key: string, idx: number, patch: any) => {
    const next = [...editing[key]];
    next[idx] = { ...next[idx], ...patch };
    setEditing({ ...editing, [key]: next });
  };
  const removeItem = (key: string, idx: number) =>
    setEditing({ ...editing, [key]: editing[key].filter((_: any, i: number) => i !== idx) });

  const toggleGender = (g: string) => {
    const has = editing.genders.includes(g);
    setEditing({
      ...editing,
      genders: has ? editing.genders.filter((x: string) => x !== g) : [...editing.genders, g],
    });
  };

  const useDefaultBrackets = () => setEditing({ ...editing, age_brackets: DEFAULT_BRACKETS });

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
        <Button variant="brand" onClick={() => setEditing(emptyEvent())}><Plus className="w-4 h-4" /> Nova prova</Button>
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
            <Button variant="brand" className="mt-4" onClick={() => setEditing(emptyEvent())}>
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
              <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
          );
        })}

      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar prova" : "Nova prova"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-6">
              {/* Básico */}
              <Section title="Informações básicas">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Nome"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                  <Field label="Data"><Input type="date" value={editing.date || ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
                  <Field label="Horário de largada"><Input placeholder="Ex: 7h30" value={editing.start_time || ""} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} /></Field>
                  <Field label="Cidade / Local"><Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
                  <Field label="Status">
                    <select className="w-full border border-input bg-background rounded-md h-10 px-3" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                      <option value="open">Inscrições abertas</option>
                      <option value="soon">Em breve</option>
                      <option value="closed">Encerrado</option>
                    </select>
                  </Field>
                  <Field label="Prazo final de inscrição"><Input type="date" value={editing.registration_deadline || ""} onChange={(e) => setEditing({ ...editing, registration_deadline: e.target.value })} /></Field>
                  <Field label="Limite de vagas (opcional)"><Input type="number" value={editing.max_slots ?? ""} onChange={(e) => setEditing({ ...editing, max_slots: e.target.value ? parseInt(e.target.value) : null })} /></Field>
                  <Field label="Ordem"><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></Field>
                </div>
                <Field label="Descrição"><Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              </Section>

              {/* Banner */}
              <Section title="Banner">
                <EventBannerConfig
                  aspect={editing.banner_aspect_ratio}
                  bannerImage={editing.banner_image}
                  mobileImage={editing.banner_mobile_image}
                  onChange={(patch) => setEditing({ ...editing, ...patch })}
                  onUploadBanner={uploadBanner}
                  onUploadMobile={uploadMobileBanner}
                />
              </Section>


              {/* Inscrição */}
              <Section title="Inscrição">
                <div className="flex items-center gap-3">
                  <Switch checked={!!editing.internal_signup} onCheckedChange={(v) => setEditing({ ...editing, internal_signup: v })} />
                  <span className="text-sm">Inscrição interna no site (desligue para usar link externo)</span>
                </div>
                {!editing.internal_signup && (
                  <Field label="Link externo de inscrição"><Input value={editing.registration_url} onChange={(e) => setEditing({ ...editing, registration_url: e.target.value })} placeholder="https://..." /></Field>
                )}
                <Field label="Link do regulamento (PDF/site)"><Input value={editing.regulation_url} onChange={(e) => setEditing({ ...editing, regulation_url: e.target.value })} placeholder="https://..." /></Field>
              </Section>

              {/* PIX */}
              {editing.internal_signup && (
                <Section title="Pagamento via PIX">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Chave PIX"><Input value={editing.pix_key || ""} onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })} placeholder="CNPJ, e-mail ou telefone" /></Field>
                    <Field label="Nome do recebedor"><Input value={editing.pix_recipient || ""} onChange={(e) => setEditing({ ...editing, pix_recipient: e.target.value })} /></Field>
                  </div>
                  <Field label="Instruções de pagamento"><Textarea rows={3} value={editing.payment_instructions || ""} onChange={(e) => setEditing({ ...editing, payment_instructions: e.target.value })} placeholder="Ex: envie o comprovante para nosso WhatsApp." /></Field>
                </Section>
              )}

              {/* Distâncias */}
              {(
                <Section title="Distâncias e preços">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DEFAULT_DISTANCE_OPTIONS.map((d) => {
                      const has = editing.distances.some((x: Distance) => x.distance === d);
                      return (
                        <button key={d} type="button" onClick={() => has ? setEditing({ ...editing, distances: editing.distances.filter((x: Distance) => x.distance !== d) }) : addItem("distances", { distance: d, price: 0 })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${has ? "bg-brand text-brand-foreground border-brand" : "bg-background border-border"}`}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Defina o preço do 1º lote e, se quiser virada automática, preencha o 2º e (opcionalmente) o 3º lote com preço + data em que passam a valer. A partir de cada data, o site mostra automaticamente o novo preço.
                  </p>
                  {editing.distances.map((d: Distance, i: number) => (
                    <div key={i} className="rounded-lg border border-border/60 p-3 mb-2 space-y-2 bg-background/30">
                      <div className="flex gap-2 items-center">
                        <Input className="flex-1" placeholder="Ex: 5K" value={d.distance} onChange={(e) => updateItem("distances", i, { distance: e.target.value })} />
                        <Button variant="outline" size="icon" onClick={() => removeItem("distances", i)}><X className="w-4 h-4" /></Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded-md border border-border/50 p-2 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1º lote</p>
                          <Label className="text-[11px]">Valor (R$)</Label>
                          <Input type="number" step="0.01" placeholder="0,00" value={d.price ?? 0} onChange={(e) => updateItem("distances", i, { price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="rounded-md border border-border/50 p-2 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2º lote (opcional)</p>
                          <Label className="text-[11px]">Valor (R$)</Label>
                          <Input type="number" step="0.01" placeholder="opcional" value={d.price_lote2 ?? ""} onChange={(e) => updateItem("distances", i, { price_lote2: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} />
                          <Label className="text-[11px]">Início do 2º lote</Label>
                          <Input type="date" value={d.lote2_starts_at ?? ""} onChange={(e) => updateItem("distances", i, { lote2_starts_at: e.target.value || null })} />
                        </div>
                        <div className="rounded-md border border-border/50 p-2 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">3º lote (opcional)</p>
                          <Label className="text-[11px]">Valor (R$)</Label>
                          <Input type="number" step="0.01" placeholder="opcional" value={d.price_lote3 ?? ""} onChange={(e) => updateItem("distances", i, { price_lote3: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} />
                          <Label className="text-[11px]">Início do 3º lote</Label>
                          <Input type="date" min={d.lote2_starts_at ?? undefined} value={d.lote3_starts_at ?? ""} onChange={(e) => updateItem("distances", i, { lote3_starts_at: e.target.value || null })} />
                          {d.lote3_starts_at && d.lote2_starts_at && d.lote3_starts_at < d.lote2_starts_at && (
                            <p className="text-[10px] text-destructive">A data do 3º lote não pode ser anterior à do 2º lote.</p>
                          )}
                          {d.lote3_starts_at && !d.lote2_starts_at && (
                            <p className="text-[10px] text-destructive">Defina primeiro a data do 2º lote.</p>
                          )}
                        </div>
                      </div>
                      <div className={`rounded-md border border-success/40 bg-success/5 p-2 space-y-1 ${isKidsDistance(d.distance) ? "opacity-60" : ""}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Benefício 60+ (opcional)</p>
                        <Label className="text-[11px]">Valor para participantes 60+ (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={isKidsDistance(d.distance) ? "Não aplicável em KIDS" : "Ex: 49,95"}
                          disabled={isKidsDistance(d.distance)}
                          value={isKidsDistance(d.distance) ? "" : (d.price_60_plus ?? "")}
                          onChange={(e) => updateItem("distances", i, { price_60_plus: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          {isKidsDistance(d.distance)
                            ? "O benefício 60+ não é aplicado em modalidades KIDS/Infantil."
                            : "Se preenchido, atletas com 60 anos ou mais pagam exatamente este valor, sem mudar na virada de lote. Em branco, pagam o lote vigente."}
                        </p>
                      </div>


                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("distances", { distance: "", price: 0 })}><Plus className="w-4 h-4" /> Adicionar distância</Button>

                </Section>
              )}


              {/* Sexos + faixas etárias */}
              {editing.internal_signup && (
                <Section title="Categorias por sexo e faixa etária">
                  <div className="flex gap-2 mb-3">
                    {["Masculino", "Feminino"].map((g) => (
                      <button key={g} type="button" onClick={() => toggleGender(g)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border ${editing.genders.includes(g) ? "bg-brand text-brand-foreground border-brand" : "bg-background border-border"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-muted-foreground">Faixas etárias</p>
                    <Button variant="outline" size="sm" onClick={useDefaultBrackets}>Usar faixas padrão</Button>
                  </div>
                  {editing.age_brackets.map((b: AgeBracket, i: number) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input className="w-24" type="number" placeholder="Min" value={b.min} onChange={(e) => updateItem("age_brackets", i, { min: parseInt(e.target.value) || 0 })} />
                      <Input className="w-24" type="number" placeholder="Max" value={b.max} onChange={(e) => updateItem("age_brackets", i, { max: parseInt(e.target.value) || 0 })} />
                      <Button variant="outline" size="icon" onClick={() => removeItem("age_brackets", i)}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("age_brackets", { min: 0, max: 0 })}><Plus className="w-4 h-4" /> Adicionar faixa</Button>
                </Section>
              )}

              {/* Kit */}
              {editing.internal_signup && (
                <Section title="Opções de kit (camiseta, premium etc.)">
                  {editing.kit_options.map((k: KitOption, i: number) => (
                    <div key={i} className="mb-3 rounded-xl border border-border p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input className="flex-1" placeholder="Ex: Kit camiseta" value={k.name} onChange={(e) => updateItem("kit_options", i, { name: e.target.value })} />
                        <Input className="w-32" type="number" step="0.01" placeholder="Adicional R$" value={k.extra_price ?? 0} onChange={(e) => updateItem("kit_options", i, { extra_price: parseFloat(e.target.value) || 0 })} />
                        <Button variant="outline" size="icon" onClick={() => removeItem("kit_options", i)}><X className="w-4 h-4" /></Button>
                      </div>
                      {(() => {
                        const sizes: string[] = Array.isArray((k as any).sizes) ? (k as any).sizes : [];
                        const hasShirt = sizes.length > 0 || (k as any).has_shirt === true;
                        const allSizes = [...DEFAULT_SIZES, ...sizes.filter((x) => !DEFAULT_SIZES.includes(x))];
                        const toggleSize = (s: string) => {
                          const next = sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s];
                          updateItem("kit_options", i, {
                            has_shirt: true,
                            sizes: allSizes.filter((x) => next.includes(x)),
                          });
                        };
                        return (
                          <>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={hasShirt}
                                onCheckedChange={(v) =>
                                  updateItem("kit_options", i, { has_shirt: v, sizes: v ? DEFAULT_SIZES : [] })
                                }
                              />
                              Este kit possui camiseta
                            </label>

                            {hasShirt && (
                              <div className="space-y-3 rounded-lg bg-secondary/30 p-3">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs">Tamanhos disponíveis</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => updateItem("kit_options", i, { sizes: DEFAULT_SIZES })}
                                    >
                                      Usar tamanhos padrão
                                    </Button>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {allSizes.map((s) => {
                                      const on = sizes.includes(s);
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => toggleSize(s)}
                                          className={
                                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors " +
                                            (on
                                              ? "bg-brand text-brand-foreground border-brand"
                                              : "bg-background text-foreground/60 border-border hover:border-brand/60")
                                          }
                                        >
                                          {on ? "☑" : "☐"} {s}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      className="h-8 w-40 text-xs"
                                      placeholder="Outro tamanho (ex: XGG)"
                                      value={customSize[i] ?? ""}
                                      onChange={(e) => setCustomSize({ ...customSize, [i]: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const v = (customSize[i] ?? "").trim().toUpperCase();
                                          if (v && !sizes.includes(v)) updateItem("kit_options", i, { sizes: [...sizes, v] });
                                          setCustomSize({ ...customSize, [i]: "" });
                                        }
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => {
                                        const v = (customSize[i] ?? "").trim().toUpperCase();
                                        if (v && !sizes.includes(v)) updateItem("kit_options", i, { sizes: [...sizes, v] });
                                        setCustomSize({ ...customSize, [i]: "" });
                                      }}
                                    >
                                      <Plus className="w-3 h-3" /> Adicionar outro tamanho
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Tabela de medidas — imagem (opcional)</Label>
                                    <Input
                                      placeholder="https://... (imagem recomendada 1000×1000px)"
                                      value={(k as any).size_chart_url ?? ""}
                                      onChange={(e) => updateItem("kit_options", i, { size_chart_url: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Tabela de medidas — informações (opcional)</Label>
                                    <Textarea
                                      rows={2}
                                      placeholder="Ex: P — 50cm largura x 70cm altura..."
                                      value={(k as any).size_chart_info ?? ""}
                                      onChange={(e) => updateItem("kit_options", i, { size_chart_info: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("kit_options", { name: "", extra_price: 0, sizes: [] })}><Plus className="w-4 h-4" /> Adicionar kit</Button>
                </Section>
              )}


              {/* Cupons */}
              {editing.internal_signup && (
                <Section title="Cupons aceitos">
                  {editing.coupons.map((c: Coupon, i: number) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input className="w-40" placeholder="CÓDIGO" value={c.code} onChange={(e) => updateItem("coupons", i, { code: e.target.value })} />
                      <Input className="flex-1" placeholder="Descrição (opcional)" value={c.description ?? ""} onChange={(e) => updateItem("coupons", i, { description: e.target.value })} />
                      <Button variant="outline" size="icon" onClick={() => removeItem("coupons", i)}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("coupons", { code: "", description: "" })}><Plus className="w-4 h-4" /> Adicionar cupom</Button>
                </Section>
              )}

              {/* Conteúdos */}
              <Section title="Informações do evento (aparecem na página da prova)">
                <Field label="Sobre o kit"><Textarea rows={3} value={editing.kit_info} onChange={(e) => setEditing({ ...editing, kit_info: e.target.value })} /></Field>
                <Field label="Entrega do kit"><Textarea rows={3} value={editing.kit_delivery} onChange={(e) => setEditing({ ...editing, kit_delivery: e.target.value })} /></Field>
                <Field label="Mais informações"><Textarea rows={4} value={editing.more_info} onChange={(e) => setEditing({ ...editing, more_info: e.target.value })} /></Field>
              </Section>

              {/* Documentos de apoio */}
              <Section title="Documentos de apoio (regulamento, kit, percursos, autorização etc.)">
                <p className="text-xs text-muted-foreground mb-2">
                  Adicione um rótulo e cole um link, ou envie um PDF. Aparecem como botões na página da prova.
                </p>
                {(editing.documents || []).map((d: EventDocument, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
                    <Input className="sm:w-56" placeholder="Ex: Autorização de retirada" value={d.label} onChange={(e) => updateItem("documents", i, { label: e.target.value })} />
                    <Input className="flex-1" placeholder="https://... ou envie um PDF" value={d.url} onChange={(e) => updateItem("documents", i, { url: e.target.value })} />
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild><span><Upload className="w-4 h-4" /> PDF</span></Button>
                      <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(i, f); }} />
                    </label>
                    <Button variant="outline" size="icon" onClick={() => removeItem("documents", i)}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addItem("documents", { label: "", url: "" })}><Plus className="w-4 h-4" /> Adicionar documento</Button>
              </Section>

              <div className="flex items-center gap-3">
                <Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <span className="text-sm">Ativo (aparece no site)</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="brand" onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-border rounded-xl p-4 space-y-3">
    <h3 className="font-semibold text-sm">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <div className="mt-1">{children}</div>
  </div>
);

export default AdminEvents;
