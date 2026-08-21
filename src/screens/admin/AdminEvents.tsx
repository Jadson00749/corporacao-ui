import { useEffect, useState } from "react";
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


type Distance = { distance: string; price?: number; price_lote2?: number; lote2_starts_at?: string | null; price_lote3?: number; lote3_starts_at?: string | null; price_60_plus?: number };
type AgeBracket = { min: number; max: number };
type KitOption = { name: string; extra_price?: number };
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
  banner_image: "", image: "", active: true, sort_order: 0,
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
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows = [], refetch, isLoading } = useQuery({
    queryKey: ["admin_events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openEdit = async (r: any) => {
    const { data: pay } = await supabase
      .from("event_payment_details")
      .select("pix_key, pix_recipient, payment_instructions")
      .eq("event_id", r.id)
      .maybeSingle();
    setEditing({
      ...r,
      pix_key: pay?.pix_key ?? "",
      pix_recipient: pay?.pix_recipient ?? "",
      payment_instructions: pay?.payment_instructions ?? "",
    });
  };

  const save = async () => {
    const badLote = (editing?.distances ?? []).find(
      (d: Distance) => d.lote3_starts_at && (!d.lote2_starts_at || d.lote3_starts_at < d.lote2_starts_at)
    );
    if (badLote) {
      return toast.error(`Distância "${badLote.distance || "sem nome"}": a data do 3º lote deve ser posterior à do 2º lote.`);
    }
    const payload: any = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    const pix_key = payload.pix_key ?? "";
    const pix_recipient = payload.pix_recipient ?? "";
    const payment_instructions = payload.payment_instructions ?? "";
    delete payload.pix_key; delete payload.pix_recipient; delete payload.payment_instructions;
    if (!payload.registration_deadline) payload.registration_deadline = null;
    const isNew = !payload.id;
    if (isNew) delete payload.id;
    const { data: saved, error } = isNew
      ? await supabase.from("events").insert(payload).select("id").maybeSingle()
      : await supabase.from("events").update(payload).eq("id", payload.id).select("id").maybeSingle();
    if (error) return toast.error(error.message);
    const eventId = saved?.id ?? payload.id;
    if (eventId) {
      const { error: payErr } = await supabase
        .from("event_payment_details")
        .upsert({ event_id: eventId, pix_key, pix_recipient, payment_instructions });
      if (payErr) return toast.error(payErr.message);
    }
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

  const uploadBanner = async (file: File) => {
    const path = `events/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("site-images").getPublicUrl(path);
    setEditing({ ...editing, banner_image: data.publicUrl });
  };

  const uploadDocument = async (idx: number, file: File) => {
    const path = `events/docs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("site-images").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("site-images").getPublicUrl(path);
    const next = [...editing.documents];
    next[idx] = { ...next[idx], url: data.publicUrl, label: next[idx].label || file.name.replace(/\.[^.]+$/, "") };
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
          <p className="text-muted-foreground mt-1">{rows.length} {rows.length === 1 ? "prova" : "provas"}</p>
        </div>
        <Button variant="brand" onClick={() => setEditing(emptyEvent())}><Plus className="w-4 h-4" /> Nova prova</Button>
      </div>

      <div className="mt-6 bg-card border border-border rounded-xl divide-y divide-border">
        {isLoading && <div className="p-6 text-muted-foreground">Carregando...</div>}
        {!isLoading && rows.length === 0 && <div className="p-6 text-muted-foreground">Nenhuma prova ainda.</div>}
        {rows.map((r: any) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {(r.banner_image || r.image) && <img src={r.banner_image || r.image} alt="" className="w-20 h-12 rounded object-cover" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.date} · {r.city} · {r.distance}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={!!r.active} onCheckedChange={(v) => toggleActive(r, v)} />
                <span className="hidden sm:inline">Ativo</span>
              </label>
              <Button variant="outline" size="sm" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
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
                {editing.banner_image && <img src={editing.banner_image} alt="" className="w-full max-h-48 object-cover rounded-lg border border-border mb-2" />}
                <div className="text-sm bg-muted/40 border border-border rounded-lg p-3 space-y-1 mb-3">
                  <p><strong>📐 Tamanho ideal para 100% de preenchimento:</strong> 1920 × 640 px (proporção 3:1, banner panorâmico)</p>
                  <p><strong>📦 Formato:</strong> JPG, até 3 MB</p>
                  <p><strong>🎯 Dica:</strong> a imagem ocupa a largura toda do banner (220 px de altura no celular, 340 px no desktop). Mantenha o assunto principal no centro para não cortar rostos ou logos.</p>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="URL da imagem do banner" value={editing.banner_image || ""} onChange={(e) => setEditing({ ...editing, banner_image: e.target.value })} />
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild><span><Upload className="w-4 h-4" /> Enviar</span></Button>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); }} />
                  </label>
                </div>
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
                      <div className="rounded-md border border-success/40 bg-success/5 p-2 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Benefício 60+ (opcional)</p>
                        <Label className="text-[11px]">Valor para participantes 60+ (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 49,95"
                          value={d.price_60_plus ?? ""}
                          onChange={(e) => updateItem("distances", i, { price_60_plus: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Se preenchido, atletas com 60 anos ou mais pagam exatamente este valor, sem mudar na virada de lote. Em branco, pagam o lote vigente.</p>
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
                    <div key={i} className="flex gap-2 mb-2">
                      <Input className="flex-1" placeholder="Ex: Camiseta P" value={k.name} onChange={(e) => updateItem("kit_options", i, { name: e.target.value })} />
                      <Input className="w-32" type="number" step="0.01" placeholder="Adicional R$" value={k.extra_price ?? 0} onChange={(e) => updateItem("kit_options", i, { extra_price: parseFloat(e.target.value) || 0 })} />
                      <Button variant="outline" size="icon" onClick={() => removeItem("kit_options", i)}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("kit_options", { name: "", extra_price: 0 })}><Plus className="w-4 h-4" /> Adicionar kit</Button>
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
