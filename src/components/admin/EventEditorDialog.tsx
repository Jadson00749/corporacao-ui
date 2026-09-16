import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { isKidsDistance } from "@/lib/eventPricing";
import {
  type EventCoupon,
  newAdminCoupon,
  formatCouponUsesLabel,
  validateCouponFields,
} from "@/lib/eventCoupons";
import {
  normalizeShirtSize,
  parseShirtSizeStock,
  setShirtSizeStockLimit,
  shirtSizeStockLimit,
  collectKitShirtSizes,
  type ShirtSizeAvailability,
} from "@/lib/shirtSizeStock";
import {
  applyShirtPlanToStock,
  buildShirtPlan,
} from "@/lib/shirtPlanning";
import {
  type EventKitOption,
  type KitPresetId,
  KIT_DEFAULT_SIZES,
  createKitFromPreset,
  discountAmountFromExtra,
  extraPriceFromDiscount,
  getKitAvailability,
  kitHasShirt,
  kitUsesDiscountField,
} from "@/lib/eventKits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventBannerConfig } from "@/components/admin/EventBannerConfig";
import { EventKitItemsEditor } from "@/components/admin/EventKitItemsEditor";
import { isOrganizerPaymentReady, maskPixKey } from "@/lib/eventPayment";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

type Distance = {
  distance: string;
  price?: number;
  price_lote2?: number;
  lote2_starts_at?: string | null;
  price_lote3?: number;
  lote3_starts_at?: string | null;
  price_60_plus?: number;
};
type AgeBracket = { min: number; max: number };
type KitOption = EventKitOption;
type EventDocument = { label: string; url: string };

const DEFAULT_SIZES = KIT_DEFAULT_SIZES;
const DEFAULT_DISTANCE_OPTIONS = ["5K", "10K", "10,5K", "21K", "42K"];
const DEFAULT_BRACKETS: AgeBracket[] = [
  { min: 18, max: 29 },
  { min: 30, max: 39 },
  { min: 40, max: 49 },
  { min: 50, max: 59 },
  { min: 60, max: 99 },
];

export type EditorTabId =
  | "geral"
  | "midia"
  | "inscricao"
  | "percursos"
  | "kit"
  | "conteudo";

const TABS: { id: EditorTabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "midia", label: "Mídia" },
  { id: "inscricao", label: "Inscrição" },
  { id: "percursos", label: "Percursos" },
  { id: "kit", label: "Kit & Cupons" },
  { id: "conteudo", label: "Conteúdo" },
];

type TabHealth = "complete" | "incomplete" | "not_started" | "error";

const OPTIONAL_TABS = new Set<EditorTabId>(["kit", "conteudo"]);

const filled = (v: unknown) => String(v ?? "").trim().length > 0;

const statusLabel = (s: string) =>
  s === "open" ? "Inscrições abertas" : s === "soon" ? "Em breve" : s === "closed" ? "Encerrado" : s;

function computeTabHealth(
  editing: any,
  opts: { editingIsPartner: boolean; paymentReady: boolean }
): Record<EditorTabId, { health: TabHealth; done: number; total: number }> {
  const distances: Distance[] = editing.distances ?? [];
  const coupons: EventCoupon[] = editing.coupons ?? [];
  const kitOptions: KitOption[] = editing.kit_options ?? [];
  const documents: EventDocument[] = editing.documents ?? [];

  // Geral
  const geralChecks = [
    filled(editing.name),
    filled(editing.date),
    filled(editing.city),
    filled(editing.status),
  ];
  const geralDone = geralChecks.filter(Boolean).length;

  // Mídia — desktop + mobile
  const midiaChecks = [filled(editing.banner_image), filled(editing.banner_mobile_image)];
  const midiaDone = midiaChecks.filter(Boolean).length;

  // Inscrição
  const inscricaoChecks: boolean[] = [true]; // modo interno/externo sempre definido
  if (editing.internal_signup) {
    if (opts.editingIsPartner) {
      inscricaoChecks.push(opts.paymentReady || filled(editing.payment_instructions));
    } else {
      inscricaoChecks.push(filled(editing.pix_key) && filled(editing.pix_recipient));
    }
  } else {
    inscricaoChecks.push(filled(editing.registration_url));
  }
  const inscricaoDone = inscricaoChecks.filter(Boolean).length;

  // Percursos
  const percursosChecks = [distances.length > 0];
  if (distances.length) {
    percursosChecks.push(distances.every((d) => filled(d.distance)));
  }
  if (editing.internal_signup) {
    percursosChecks.push(Array.isArray(editing.genders) && editing.genders.length > 0);
  }
  const percursosDone = percursosChecks.filter(Boolean).length;
  const badLote = distances.some(
    (d) => d.lote3_starts_at && (!d.lote2_starts_at || d.lote3_starts_at < d.lote2_starts_at)
  );
  const kidsSenior = distances.some(
    (d) => isKidsDistance(d.distance) && typeof d.price_60_plus === "number" && d.price_60_plus > 0
  );

  // Kit & Cupons — opcional; progresso suave + erro real de cupom
  const kitChecks = [
    kitOptions.some((k) => filled(k.name)),
    coupons.some((c) => filled(c.code)),
  ];
  const kitDone = kitChecks.filter(Boolean).length;
  const couponError = coupons.some((c) => {
    if (!String(c.code || "").trim()) return false;
    const hasDiscount =
      c.type === "percentage" ||
      c.type === "fixed" ||
      (c.value != null && String(c.value) !== "" && Number(c.value) > 0);
    if (!hasDiscount) return false;
    return !!validateCouponFields({
      ...c,
      type: c.type === "fixed" ? "fixed" : "percentage",
      value: Number(c.value),
      active: c.active !== false,
    });
  });

  // Conteúdo — opcional
  const conteudoChecks = [
    filled(editing.kit_info),
    filled(editing.kit_delivery),
    filled(editing.more_info),
    documents.some((d) => filled(d.label) && filled(d.url)),
  ];
  const conteudoDone = conteudoChecks.filter(Boolean).length;

  const pack = (done: number, total: number, error?: boolean): { health: TabHealth; done: number; total: number } => {
    let health: TabHealth;
    if (error) health = "error";
    else if (done <= 0) health = "not_started";
    else if (done >= total) health = "complete";
    else health = "incomplete";
    return { done, total, health };
  };

  return {
    geral: pack(geralDone, geralChecks.length),
    midia: pack(midiaDone, midiaChecks.length),
    inscricao: pack(inscricaoDone, inscricaoChecks.length),
    percursos: pack(percursosDone, percursosChecks.length, badLote || kidsSenior),
    kit: pack(kitDone, Math.max(kitChecks.length, 1), couponError),
    conteudo: pack(conteudoDone, conteudoChecks.length),
  };
}

function isSectionSettled(id: EditorTabId, h: { health: TabHealth }) {
  if (h.health === "error") return false;
  if (h.health === "complete") return true;
  // Abas opcionais vazias não bloqueiam o progresso geral
  if (OPTIONAL_TABS.has(id) && h.health === "not_started") return true;
  return false;
}

type Props = {
  editing: any;
  setEditing: (v: any | ((prev: any) => any)) => void;
  onClose: () => void;
  onSave: () => void;
  isAdmin: boolean;
  organizerId: string | null;
  editingIsPartner: boolean;
  editingOrg: any;
  couponUses: Record<string, number>;
  /** Inscrições não canceladas por tamanho (uppercase). */
  shirtSizeUses: Record<string, number>;
  /** Total de inscrições não canceladas. */
  activeSignupsCount: number;
  customSize: Record<number, string>;
  setCustomSize: (v: Record<number, string>) => void;
  onUploadBanner: (file: File) => void;
  onUploadMobile: (file: File) => void;
  onUploadDocument: (idx: number, file: File) => void;
};

export const EventEditorDialog = ({
  editing,
  setEditing,
  onClose,
  onSave,
  isAdmin,
  organizerId,
  editingIsPartner,
  editingOrg,
  couponUses,
  shirtSizeUses,
  activeSignupsCount,
  customSize,
  setCustomSize,
  onUploadBanner,
  onUploadMobile,
  onUploadDocument,
}: Props) => {
  const shirtStock = parseShirtSizeStock(editing?.shirt_size_stock);
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<EditorTabId>("geral");
  const [shirtForecast, setShirtForecast] = useState<string>("");
  const [planAppliedHint, setPlanAppliedHint] = useState(false);

  useEffect(() => {
    setTab("geral");
    setPlanAppliedHint(false);
    const max = editing?.max_slots != null && Number(editing.max_slots) > 0 ? Number(editing.max_slots) : null;
    if (max != null) {
      setShirtForecast(String(Math.max(0, max - (activeSignupsCount || 0))));
    } else {
      setShirtForecast("");
    }
  }, [editing?.id]);

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

  const health = useMemo(
    () =>
      computeTabHealth(editing, {
        editingIsPartner,
        paymentReady: isOrganizerPaymentReady(editingOrg),
      }),
    [editing, editingIsPartner, editingOrg]
  );

  const overall = useMemo(() => {
    const settled = TABS.filter((t) => isSectionSettled(t.id, health[t.id])).length;
    const pending = TABS.length - settled;
    const pct = TABS.length ? Math.round((settled / TABS.length) * 100) : 0;
    return { settled, pending, totalSections: TABS.length, pct };
  }, [health]);

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const nextTab = tabIndex >= 0 && tabIndex < TABS.length - 1 ? TABS[tabIndex + 1] : null;

  /** Desktop: aba ativa; mobile: todas as seções (página linear). */
  const show = (id: EditorTabId) => isMobile || tab === id;

  const TabIcon = ({ id }: { id: EditorTabId }) => {
    const h = health[id].health;
    if (h === "error") return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400/90" />;
    if (h === "complete") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/85" />;
    return <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />;
  };

  const tabChrome = (id: EditorTabId, active: boolean) => {
    const h = health[id].health;
    if (active) {
      return cn(
        "relative border-zinc-500 bg-zinc-800 text-white",
        "after:absolute after:left-2 after:right-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-emerald-400/70"
      );
    }
    if (h === "error") return "border-red-500/30 bg-transparent text-zinc-400 hover:text-zinc-200";
    if (h === "complete") return "border-emerald-500/20 bg-transparent text-zinc-400 hover:text-zinc-200";
    return "border-zinc-700/70 bg-transparent text-zinc-500 hover:text-zinc-300";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-w-4xl w-[calc(100%-0.75rem)] sm:w-[calc(100%-2rem)]",
          "p-0 gap-0 overflow-hidden flex flex-col",
          "max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.75rem))]"
        )}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border/70 bg-background px-4 pt-3 pb-3 pr-11 sm:px-5">
          <DialogTitle className="font-display text-base sm:text-lg font-bold tracking-tight">
            {editing?.id ? "Editar prova" : "Nova prova"}
          </DialogTitle>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-full">
              {editing.name?.trim() || "Sem nome"}
            </p>
            <span className="text-[10px] font-medium uppercase tracking-wide rounded border border-border/60 px-1.5 py-0.5 text-muted-foreground">
              {statusLabel(editing.status || "open")}
            </span>
          </div>

          {isMobile ? (
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Progresso: <span className="tabular-nums text-foreground font-medium">{overall.pct}%</span>
                </p>
                <p className="text-[11px] text-zinc-500 tabular-nums">
                  {overall.settled} de {overall.totalSections} seções
                </p>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500/65" style={{ width: `${overall.pct}%` }} />
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <span className="tabular-nums text-foreground/90 font-medium">
                    {overall.settled} de {overall.totalSections}
                  </span>{" "}
                  seções concluídas
                  {overall.pending > 0 && (
                    <span className="text-zinc-500">
                      {" "}
                      · {overall.pending} {overall.pending === 1 ? "pendente" : "pendentes"}
                    </span>
                  )}
                </p>
                <span className="text-[11px] tabular-nums text-zinc-500">{overall.pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500/65" style={{ width: `${overall.pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs — desktop only */}
        {!isMobile && (
          <div className="shrink-0 border-b border-border/70 bg-background">
            <div className="flex gap-1 overflow-x-auto overscroll-x-contain px-3 py-2 no-scrollbar">
              {TABS.map((t) => {
                const active = tab === t.id;
                const meta = health[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium",
                      tabChrome(t.id, active)
                    )}
                  >
                    <TabIcon id={t.id} />
                    <span className={cn(active && "text-white font-semibold")}>{t.label}</span>
                    <span
                      className={cn(
                        "tabular-nums text-[10px] font-normal",
                        active ? "text-zinc-300" : meta.health === "complete" ? "text-emerald-500/55" : "text-zinc-500"
                      )}
                    >
                      {meta.done}/{meta.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-5">
          <div className={cn(isMobile ? "divide-y divide-border/50" : "space-y-5", "max-w-full")}>
            {show("geral") && (
              <Panel
                isMobile={isMobile}
                title="Informações gerais"
                status={health.geral.health}
              >
                <Section title="Informações básicas" subtitle="Dados principais e visibilidade no site.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Nome">
                      <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    </Field>
                    <Field label="Data">
                      <Input type="date" value={editing.date || ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
                    </Field>
                    <Field label="Horário de largada">
                      <Input placeholder="Ex: 7h30" value={editing.start_time || ""} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} />
                    </Field>
                    <Field label="Cidade / Local">
                      <Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                    </Field>
                    <Field label="Status">
                      <select
                        className="w-full border border-input bg-background rounded-md h-10 px-3"
                        value={editing.status}
                        onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                      >
                        <option value="open">Inscrições abertas</option>
                        <option value="soon">Em breve</option>
                        <option value="closed">Encerrado</option>
                      </select>
                    </Field>
                    <Field label="Prazo final de inscrição">
                      <Input type="date" value={editing.registration_deadline || ""} onChange={(e) => setEditing({ ...editing, registration_deadline: e.target.value })} />
                    </Field>
                    <Field label="Limite de vagas (opcional)">
                      <Input type="number" value={editing.max_slots ?? ""} onChange={(e) => setEditing({ ...editing, max_slots: e.target.value ? parseInt(e.target.value) : null })} />
                    </Field>
                    <Field label="Ordem">
                      <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
                    </Field>
                  </div>
                  <Field label="Descrição">
                    <Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </Field>
                  <label className="flex items-center gap-3 text-sm cursor-pointer pt-1">
                    <Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                    Ativo (aparece no site)
                  </label>
                </Section>
              </Panel>
            )}

            {show("midia") && (
              <Panel isMobile={isMobile} title="Mídia" status={health.midia.health}>
                <Section title="Mídia" subtitle="Banners desktop e mobile da prova.">
                  <EventBannerConfig
                    aspect={editing.banner_aspect_ratio}
                    bannerImage={editing.banner_image}
                    mobileImage={editing.banner_mobile_image}
                    onChange={(patch) => setEditing({ ...editing, ...patch })}
                    onUploadBanner={onUploadBanner}
                    onUploadMobile={onUploadMobile}
                  />
                </Section>
              </Panel>
            )}

            {show("inscricao") && (
              <Panel isMobile={isMobile} title="Inscrição" status={health.inscricao.health}>
                <Section title="Inscrição" subtitle="Modo de inscrição e links.">
                  <div className="flex items-start gap-3">
                    <Switch checked={!!editing.internal_signup} onCheckedChange={(v) => setEditing({ ...editing, internal_signup: v })} />
                    <span className="text-sm leading-snug">
                      Inscrição interna no site (desligue para usar link externo)
                    </span>
                  </div>
                  {!editing.internal_signup && (
                    <Field label="Link externo de inscrição">
                      <Input value={editing.registration_url} onChange={(e) => setEditing({ ...editing, registration_url: e.target.value })} placeholder="https://..." />
                    </Field>
                  )}
                  <Field label="Link do regulamento (PDF/site)">
                    <Input value={editing.regulation_url} onChange={(e) => setEditing({ ...editing, regulation_url: e.target.value })} placeholder="https://..." />
                  </Field>
                </Section>

                {editing.internal_signup && (
                  <Section
                    title={editingIsPartner || (!isAdmin && !!organizerId) ? "Recebimento desta prova" : "Pagamento via PIX"}
                    subtitle="Dados usados na confirmação de pagamento."
                  >
                    {(editingIsPartner || (!isAdmin && !!organizerId)) ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/60 p-3 space-y-2">
                          <p className="text-xs font-medium">
                            Os pagamentos desta prova vão para {editingOrg?.name || "sua organização"}.
                          </p>
                          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Beneficiário PIX</dt>
                              <dd className="font-medium break-words">{editingOrg?.pix_recipient?.trim() || "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Chave PIX</dt>
                              <dd className="font-medium font-mono break-all">
                                {editingOrg?.pix_key?.trim()
                                  ? isAdmin
                                    ? editingOrg.pix_key
                                    : maskPixKey(editingOrg.pix_key)
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">WhatsApp para comprovantes</dt>
                              <dd className="font-medium break-words">{editingOrg?.payment_whatsapp?.trim() || "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">E-mail financeiro</dt>
                              <dd className="font-medium break-words">{editingOrg?.payment_email?.trim() || "—"}</dd>
                            </div>
                          </dl>
                          {!isOrganizerPaymentReady(editingOrg) && (
                            <p className="text-[11px] text-warning pt-1">
                              Complete os dados de pagamento antes de publicar novas inscrições.
                            </p>
                          )}
                        </div>
                        {!isAdmin && (
                          <Button asChild variant="outline" size="sm">
                            <Link to="/admin/payment-settings">Editar dados de recebimento</Link>
                          </Button>
                        )}
                        {isAdmin && (
                          <p className="text-[11px] text-muted-foreground">
                            Para alterar, abra Organizadores › Gerenciar › Pagamento.
                          </p>
                        )}
                        <Field label="Instruções de pagamento">
                          <Textarea
                            rows={3}
                            value={editing.payment_instructions || ""}
                            onChange={(e) => setEditing({ ...editing, payment_instructions: e.target.value })}
                            placeholder="Ex: envie o comprovante para nosso WhatsApp."
                          />
                        </Field>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Prova da Corporação: o pagamento usa a chave abaixo e o comprovante vai para o
                          WhatsApp das configurações do site.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Field label="Chave PIX">
                            <Input
                              value={editing.pix_key || ""}
                              onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })}
                              placeholder="CNPJ, e-mail ou telefone"
                            />
                          </Field>
                          <Field label="Nome do recebedor">
                            <Input
                              value={editing.pix_recipient || ""}
                              onChange={(e) => setEditing({ ...editing, pix_recipient: e.target.value })}
                            />
                          </Field>
                        </div>
                        <Field label="Instruções de pagamento">
                          <Textarea
                            rows={3}
                            value={editing.payment_instructions || ""}
                            onChange={(e) => setEditing({ ...editing, payment_instructions: e.target.value })}
                            placeholder="Ex: envie o comprovante para nosso WhatsApp."
                          />
                        </Field>
                      </>
                    )}
                  </Section>
                )}
              </Panel>
            )}

            {show("percursos") && (
              <Panel isMobile={isMobile} title="Percursos" status={health.percursos.health}>
                <Section title="Distâncias e preços" subtitle="Percursos, valores e lotes.">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DEFAULT_DISTANCE_OPTIONS.map((d) => {
                      const has = editing.distances.some((x: Distance) => x.distance === d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            has
                              ? setEditing({
                                  ...editing,
                                  distances: editing.distances.filter((x: Distance) => x.distance !== d),
                                })
                              : addItem("distances", { distance: d, price: 0 })
                          }
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${has ? "bg-brand text-brand-foreground border-brand" : "bg-background border-border"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Defina o preço do 1º lote e, se quiser virada automática, preencha o 2º e (opcionalmente) o 3º lote com preço + data em que passam a valer.
                  </p>
                  {editing.distances.map((d: Distance, i: number) => (
                    <div key={i} className="rounded-lg border border-border/50 p-3 mb-2 space-y-2">
                      <div className="flex gap-2 items-center min-w-0">
                        <Input
                          className="min-w-0 flex-1"
                          placeholder="Ex: 5K"
                          value={d.distance}
                          onChange={(e) => updateItem("distances", i, { distance: e.target.value })}
                        />
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => removeItem("distances", i)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1 rounded-md border border-border/40 p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1º lote</p>
                          <Label className="text-[11px]">Valor (R$)</Label>
                          <Input type="number" step="0.01" placeholder="0,00" value={d.price ?? 0} onChange={(e) => updateItem("distances", i, { price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1 rounded-md border border-border/40 p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2º lote (opcional)</p>
                          <Label className="text-[11px]">Valor (R$)</Label>
                          <Input type="number" step="0.01" placeholder="opcional" value={d.price_lote2 ?? ""} onChange={(e) => updateItem("distances", i, { price_lote2: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} />
                          <Label className="text-[11px]">Início do 2º lote</Label>
                          <Input type="date" value={d.lote2_starts_at ?? ""} onChange={(e) => updateItem("distances", i, { lote2_starts_at: e.target.value || null })} />
                        </div>
                        <div className="space-y-1 rounded-md border border-border/40 p-2">
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
                      <div className={`rounded-md border border-border/40 p-2 space-y-1 ${isKidsDistance(d.distance) ? "opacity-60" : ""}`}>
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
                  <Button variant="outline" size="sm" onClick={() => addItem("distances", { distance: "", price: 0 })}>
                    <Plus className="w-4 h-4" /> Adicionar distância
                  </Button>
                </Section>

                {editing.internal_signup && (
                  <Section title="Categorias" subtitle="Sexo e faixa etária.">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {["Masculino", "Feminino"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGender(g)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${editing.genders.includes(g) ? "bg-brand text-brand-foreground border-brand" : "bg-background border-border"}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <p className="text-sm text-muted-foreground">Faixas etárias</p>
                      <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, age_brackets: DEFAULT_BRACKETS })}>
                        Usar faixas padrão
                      </Button>
                    </div>
                    {editing.age_brackets.map((b: AgeBracket, i: number) => (
                      <div key={i} className="flex flex-wrap gap-2 mb-2">
                        <Input className="w-24" type="number" placeholder="Min" value={b.min} onChange={(e) => updateItem("age_brackets", i, { min: parseInt(e.target.value) || 0 })} />
                        <Input className="w-24" type="number" placeholder="Max" value={b.max} onChange={(e) => updateItem("age_brackets", i, { max: parseInt(e.target.value) || 0 })} />
                        <Button variant="outline" size="icon" onClick={() => removeItem("age_brackets", i)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addItem("age_brackets", { min: 0, max: 0 })}>
                      <Plus className="w-4 h-4" /> Adicionar faixa
                    </Button>
                  </Section>
                )}
              </Panel>
            )}

            {show("kit") && (
              <Panel isMobile={isMobile} title="Kit & Cupons" status={health.kit.health}>
                <Section title="Kit da prova" subtitle="Itens da página pública.">
                  <EventKitItemsEditor eventId={editing.id ?? null} />
                </Section>

                {editing.internal_signup && (
                  <Section title="Kits disponíveis" subtitle="Presets rápidos. Tudo continua editável.">
                    {editing.kit_options.map((k: KitOption, i: number) => {
                      const sizes: string[] = Array.isArray(k.sizes) ? k.sizes : [];
                      const hasShirt = kitHasShirt(k);
                      const useDiscount = kitUsesDiscountField(k);
                      const avail = getKitAvailability(k);
                      const allSizes = [...DEFAULT_SIZES, ...sizes.filter((x) => !DEFAULT_SIZES.includes(x))];
                      const usedOf = (s: string) => shirtSizeUses[normalizeShirtSize(s)] || 0;
                      const toggleSize = (s: string) => {
                        if (sizes.includes(s) && usedOf(s) > 0) {
                          toast.error(
                            `Não é possível remover o tamanho ${normalizeShirtSize(s)}: há ${usedOf(s)} inscrição(ões) reservando este tamanho.`
                          );
                          return;
                        }
                        const next = sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s];
                        updateItem("kit_options", i, {
                          has_shirt: true,
                          sizes: allSizes.filter((x) => next.includes(x)),
                        });
                      };
                      const setStockQty = (s: string, raw: string) => {
                        const trimmed = raw.trim();
                        const next =
                          trimmed === ""
                            ? setShirtSizeStockLimit(shirtStock, s, null)
                            : setShirtSizeStockLimit(shirtStock, s, Number(trimmed));
                        setEditing({ ...editing, shirt_size_stock: next });
                      };
                      return (
                        <div key={i} className="mb-3 rounded-lg border border-border/50 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div>
                                <Label className="text-xs">Nome</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="Ex: Kit Completo"
                                  value={k.name}
                                  onChange={(e) => updateItem("kit_options", i, { name: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Descrição</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="Ex: Camiseta, número de peito e medalha"
                                  value={k.description ?? ""}
                                  onChange={(e) => updateItem("kit_options", i, { description: e.target.value })}
                                />
                              </div>
                            </div>
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => removeItem("kit_options", i)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="max-w-xs">
                            {useDiscount ? (
                              <>
                                <Label className="text-xs">Valor do desconto (R$)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="mt-1"
                                  value={discountAmountFromExtra(k.extra_price)}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value);
                                    updateItem("kit_options", i, {
                                      extra_price: extraPriceFromDiscount(Number.isFinite(n) ? n : 0),
                                    });
                                  }}
                                />
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  O valor deste kit ficará R${discountAmountFromExtra(k.extra_price) || 0} abaixo do valor vigente da inscrição.
                                </p>
                              </>
                            ) : (
                              <>
                                <Label className="text-xs">Ajuste no preço (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="mt-1"
                                  value={k.extra_price ?? 0}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value);
                                    updateItem("kit_options", i, {
                                      extra_price: Number.isFinite(n) ? n : 0,
                                    });
                                  }}
                                />
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Positivo acrescenta; zero = sem ajuste.
                                </p>
                              </>
                            )}
                          </div>

                          <div>
                            <Label className="text-xs">Disponibilidade do kit</Label>
                            <div className="mt-1.5 flex flex-col gap-1.5 text-sm">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`kit-avail-${i}`}
                                  checked={avail === "all_lots"}
                                  onChange={() =>
                                    updateItem("kit_options", i, {
                                      availability: "all_lots",
                                      only_last_lot: undefined,
                                    })
                                  }
                                />
                                Todos os lotes
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`kit-avail-${i}`}
                                  checked={avail === "last_lot"}
                                  onChange={() =>
                                    updateItem("kit_options", i, {
                                      availability: "last_lot",
                                      only_last_lot: undefined,
                                    })
                                  }
                                />
                                Somente no último lote
                              </label>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={hasShirt}
                              onCheckedChange={(v) => {
                                if (!v) {
                                  const blocked = sizes.find((s) => usedOf(s) > 0);
                                  if (blocked) {
                                    toast.error(
                                      `Não é possível desativar a camiseta: há inscrições no tamanho ${normalizeShirtSize(blocked)}.`
                                    );
                                    return;
                                  }
                                }
                                updateItem("kit_options", i, {
                                  has_shirt: v,
                                  sizes: v ? DEFAULT_SIZES : [],
                                  ...(v ? {} : { extra_price: k.extra_price ?? 0 }),
                                });
                              }}
                            />
                            Este kit possui camiseta
                          </label>

                          {hasShirt && (
                            <div className="space-y-3 rounded-md bg-secondary/25 p-3">
                              <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
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
                                          "px-3 py-1.5 rounded-md text-xs font-semibold border " +
                                          (on
                                            ? "bg-brand text-brand-foreground border-brand"
                                            : "bg-background text-foreground/60 border-border")
                                        }
                                      >
                                        {on ? "☑" : "☐"} {s}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 flex flex-col md:flex-row gap-2">
                                  <Input
                                    className="h-9 md:w-40 text-xs"
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
                                    className="h-9 text-xs"
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

                              {sizes.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Estoque por tamanho (opcional)</Label>
                                  <p className="text-[11px] text-muted-foreground">
                                    Deixe em branco para não limitar.
                                  </p>
                                  <div className="space-y-2">
                                    {sizes.map((s) => {
                                      const key = normalizeShirtSize(s);
                                      const lim = shirtSizeStockLimit(shirtStock, key);
                                      const used = usedOf(key);
                                      const remaining = lim == null ? null : Math.max(lim - used, 0);
                                      return (
                                        <div
                                          key={key}
                                          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-2"
                                        >
                                          <span className="text-xs font-semibold w-10 shrink-0">{key}</span>
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="text-[11px] text-muted-foreground shrink-0">
                                              Quantidade:
                                            </span>
                                            <Input
                                              type="number"
                                              min={1}
                                              step={1}
                                              className="h-8 w-24 text-xs"
                                              placeholder="∞"
                                              value={lim ?? ""}
                                              onChange={(e) => setStockQty(key, e.target.value)}
                                            />
                                          </div>
                                          <div className="text-[11px] text-muted-foreground sm:text-right sm:min-w-[10rem]">
                                            {lim == null ? (
                                              <span>Sem limite</span>
                                            ) : (
                                              <span>
                                                Estoque: {lim}
                                                {used > 0 ? (
                                                  <>
                                                    {" · "}Utilizadas: {used}
                                                    {" · "}Disponíveis: {remaining}
                                                  </>
                                                ) : null}
                                              </span>
                                            )}
                                            {lim == null && used > 0 ? (
                                              <span className="block">Utilizadas: {used}</span>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Tabela de medidas — imagem (opcional)</Label>
                                  <Input
                                    placeholder="https://..."
                                    value={k.size_chart_url ?? ""}
                                    onChange={(e) => updateItem("kit_options", i, { size_chart_url: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Tabela de medidas — informações (opcional)</Label>
                                  <Textarea
                                    rows={2}
                                    placeholder="Ex: P — 50cm largura x 70cm altura..."
                                    value={k.size_chart_info ?? ""}
                                    onChange={(e) => updateItem("kit_options", i, { size_chart_info: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4" /> Adicionar kit
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {(
                          [
                            { id: "completo" as KitPresetId, label: "Kit Completo", hint: "Com camiseta · todos os lotes" },
                            { id: "economico" as KitPresetId, label: "Kit Econômico", hint: "Sem camiseta · último lote · −R$20" },
                            { id: "personalizado" as KitPresetId, label: "Personalizado", hint: "Começar do zero" },
                          ] as const
                        ).map((opt) => (
                          <DropdownMenuItem
                            key={opt.id}
                            className="flex flex-col items-start gap-0.5 py-2"
                            onSelect={() => addItem("kit_options", createKitFromPreset(opt.id))}
                          >
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Section>
                )}

                {editing.internal_signup && (() => {
                  const maxSlots =
                    editing.max_slots != null && Number(editing.max_slots) > 0
                      ? Number(editing.max_slots)
                      : null;
                  const remainingSlots = maxSlots != null ? Math.max(0, maxSlots - (activeSignupsCount || 0)) : null;
                  const forecastNum = Math.max(0, Math.floor(Number(shirtForecast) || 0));
                  const forecastCapError =
                    remainingSlots != null && forecastNum > remainingSlots
                      ? `A capacidade atual permite no máximo ${remainingSlots} novas inscrições.`
                      : null;
                  const effectiveForecast =
                    remainingSlots != null ? Math.min(forecastNum, remainingSlots) : forecastNum;

                  const sizes = collectKitShirtSizes(editing.kit_options);
                  const availability: ShirtSizeAvailability[] = sizes.map((size) => {
                    const used = shirtSizeUses[size] || 0;
                    const lim = shirtSizeStockLimit(shirtStock, size);
                    const unlimited = lim == null;
                    const remaining = unlimited ? null : Math.max(lim - used, 0);
                    return {
                      size,
                      max_quantity: lim,
                      used,
                      remaining,
                      unlimited,
                      available: unlimited || (remaining ?? 0) > 0,
                    };
                  });
                  // Inclui tamanhos só no histórico de usos
                  for (const [size, used] of Object.entries(shirtSizeUses)) {
                    if (sizes.includes(size)) continue;
                    const lim = shirtSizeStockLimit(shirtStock, size);
                    const unlimited = lim == null;
                    availability.push({
                      size,
                      max_quantity: lim,
                      used,
                      remaining: unlimited ? null : Math.max((lim as number) - used, 0),
                      unlimited,
                      available: unlimited || Math.max((lim ?? 0) - used, 0) > 0,
                    });
                  }

                  const plan = buildShirtPlan({
                    totalActive: activeSignupsCount || 0,
                    availability,
                    forecast: effectiveForecast,
                  });

                  return (
                    <Section
                      title="Planejamento de camisetas"
                      subtitle="Projeção simples com base nas inscrições reais."
                    >
                      <p className="text-sm text-muted-foreground">
                        {activeSignupsCount || 0} inscritos
                        {maxSlots != null ? (
                          <>
                            {" · "}
                            Limite: {maxSlots}
                            {" · "}
                            {remainingSlots} vagas restantes
                          </>
                        ) : (
                          <> · Sem limite de vagas</>
                        )}
                      </p>

                      <div className="mt-3 max-w-xs">
                        <Label className="text-xs">Previsão de novas inscrições</Label>
                        <Input
                          type="number"
                          min={0}
                          max={remainingSlots ?? undefined}
                          className="mt-1 h-9"
                          value={shirtForecast}
                          onChange={(e) => {
                            setPlanAppliedHint(false);
                            setShirtForecast(e.target.value);
                          }}
                          placeholder={remainingSlots != null ? String(remainingSlots) : "Ex: 50"}
                        />
                        {forecastCapError && (
                          <p className="mt-1 text-[11px] text-destructive">{forecastCapError}</p>
                        )}
                      </div>

                      {!plan.canSuggest && plan.noHistoryMessage ? (
                        <p className="mt-3 text-xs text-muted-foreground">{plan.noHistoryMessage}</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Estimativa baseada no comportamento atual:{" "}
                            {Math.round(plan.shirtRate * 100)}% dos inscritos escolheram camiseta
                            {" → "}
                            ~{plan.estimatedNewShirts} novas camisetas.
                          </p>
                          <div className="space-y-1.5">
                            {plan.rows.map((row) => (
                              <div
                                key={row.size}
                                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs border-b border-border/40 py-1.5 last:border-0"
                              >
                                <span className="font-semibold w-8">{row.size}</span>
                                <span className="text-muted-foreground">Reservadas: {row.reserved}</span>
                                <span className="text-muted-foreground">
                                  Estoque: {row.stockTotal == null ? "Sem limite" : row.stockTotal}
                                </span>
                                {row.available != null && (
                                  <span className="text-muted-foreground">Disponíveis: {row.available}</span>
                                )}
                                <span className="text-foreground font-medium">
                                  Sugestão adicional: +{row.additionalToProduce}
                                </span>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            disabled={!plan.rows.some((r) => r.additionalToProduce > 0)}
                            onClick={() => {
                              const next = applyShirtPlanToStock(shirtStock, plan.rows);
                              setEditing({ ...editing, shirt_size_stock: next });
                              setPlanAppliedHint(true);
                              toast.success("Sugestão aplicada. Revise as quantidades e clique em Salvar alterações.");
                            }}
                          >
                            Aplicar sugestão ao estoque
                          </Button>
                          {planAppliedHint && (
                            <p className="text-[11px] text-muted-foreground">
                              Sugestão aplicada. Revise as quantidades e clique em Salvar alterações.
                            </p>
                          )}
                        </div>
                      )}
                    </Section>
                  );
                })()}

                {editing.internal_signup && (
                  <Section title="Cupons aceitos" subtitle="Códigos de desconto desta prova.">
                    {(editing.coupons ?? []).map((c: EventCoupon, i: number) => {
                      const type = c.type === "fixed" ? "fixed" : c.type === "percentage" ? "percentage" : "";
                      return (
                        <div key={i} className="mb-3 rounded-lg border border-border/50 p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Código do cupom</Label>
                              <Input
                                className="mt-1"
                                placeholder="CORRE10"
                                value={c.code}
                                onChange={(e) => updateItem("coupons", i, { code: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Tipo de desconto</Label>
                              <Select
                                value={type || undefined}
                                onValueChange={(v) =>
                                  updateItem("coupons", i, {
                                    type: v === "fixed" ? "fixed" : "percentage",
                                    value: c.value ?? (v === "fixed" ? 20 : 10),
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">Porcentagem</SelectItem>
                                  <SelectItem value="fixed">Valor fixo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">
                                Valor {type === "percentage" ? "(%)" : type === "fixed" ? "(R$)" : ""}
                              </Label>
                              <Input
                                className="mt-1"
                                type="number"
                                step={type === "percentage" ? "1" : "0.01"}
                                min={0}
                                max={type === "percentage" ? 100 : undefined}
                                placeholder={type === "fixed" ? "20" : "10"}
                                value={c.value ?? ""}
                                onChange={(e) =>
                                  updateItem("coupons", i, {
                                    value: e.target.value === "" ? undefined : parseFloat(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Limite de utilizações</Label>
                              <Input
                                className="mt-1"
                                type="number"
                                min={1}
                                step={1}
                                placeholder="Ilimitado"
                                value={c.max_uses ?? ""}
                                onChange={(e) =>
                                  updateItem("coupons", i, {
                                    max_uses: e.target.value === "" ? null : parseInt(e.target.value, 10) || null,
                                  })
                                }
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-xs">Descrição (opcional)</Label>
                              <Input
                                className="mt-1"
                                placeholder="Cupom promocional"
                                value={c.description ?? ""}
                                onChange={(e) => updateItem("coupons", i, { description: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={c.active !== false}
                                onCheckedChange={(v) => updateItem("coupons", i, { active: v })}
                              />
                              Ativo
                            </label>
                            <div className="flex items-center gap-2">
                              {!!String(c.code || "").trim() && (
                                <p className="text-xs text-muted-foreground">
                                  Utilizações:{" "}
                                  <span className="font-medium text-foreground">
                                    {formatCouponUsesLabel(
                                      couponUses[String(c.code).trim().toUpperCase()] || 0,
                                      c.max_uses
                                    )}
                                  </span>
                                </p>
                              )}
                              <Button variant="outline" size="icon" onClick={() => removeItem("coupons", i)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => addItem("coupons", newAdminCoupon())}>
                      <Plus className="w-4 h-4" /> Adicionar cupom
                    </Button>
                  </Section>
                )}
              </Panel>
            )}

            {show("conteudo") && (
              <Panel isMobile={isMobile} title="Conteúdo" status={health.conteudo.health}>
                <Section title="Informações do evento" subtitle="Textos da página pública.">
                  <Field label="Sobre o kit">
                    <Textarea rows={3} value={editing.kit_info} onChange={(e) => setEditing({ ...editing, kit_info: e.target.value })} />
                  </Field>
                  <Field label="Entrega do kit">
                    <Textarea rows={3} value={editing.kit_delivery} onChange={(e) => setEditing({ ...editing, kit_delivery: e.target.value })} />
                  </Field>
                  <Field label="Mais informações">
                    <Textarea rows={4} value={editing.more_info} onChange={(e) => setEditing({ ...editing, more_info: e.target.value })} />
                  </Field>
                </Section>

                <Section title="Documentos de apoio" subtitle="Links ou PDFs na página da prova.">
                  {(editing.documents || []).map((d: EventDocument, i: number) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[minmax(0,12rem)_1fr_auto_auto] gap-2 mb-3 items-end">
                      <Input placeholder="Ex: Autorização de retirada" value={d.label} onChange={(e) => updateItem("documents", i, { label: e.target.value })} />
                      <Input placeholder="https://... ou envie um PDF" value={d.url} onChange={(e) => updateItem("documents", i, { url: e.target.value })} />
                      <label className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="w-4 h-4" /> PDF
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onUploadDocument(i, f);
                          }}
                        />
                      </label>
                      <Button variant="outline" size="icon" onClick={() => removeItem("documents", i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem("documents", { label: "", url: "" })}>
                    <Plus className="w-4 h-4" /> Adicionar documento
                  </Button>
                </Section>
              </Panel>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/70 bg-background px-4 py-3 sm:px-5 shadow-[0_-4px_16px_-10px_rgba(0,0,0,0.4)]">
          {isMobile ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="shrink-0" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" variant="brand" className="flex-1 min-h-11" onClick={onSave}>
                Salvar alterações
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                {nextTab ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setTab(nextTab.id)}>
                    Próxima seção
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <span className="text-xs text-zinc-500">Última seção</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="button" variant="brand" size="sm" onClick={onSave}>
                  Salvar alterações
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const statusHint = (status: TabHealth) => {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-400/90">
        <AlertCircle className="h-3 w-3" /> Erro
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80">
        <CheckCircle2 className="h-3 w-3" /> Completo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
      <Circle className="h-3 w-3" /> Incompleto
    </span>
  );
};

/** Wrapper: no mobile mostra título + status; no desktop só passa os filhos. */
const Panel = ({
  isMobile,
  title,
  status,
  children,
}: {
  isMobile: boolean;
  title: string;
  status: TabHealth;
  children: React.ReactNode;
}) => {
  if (!isMobile) return <div className="space-y-5">{children}</div>;
  return (
    <div className="py-5 first:pt-1 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {statusHint(status)}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
};

const Section = ({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3 overflow-hidden min-w-0">
    {(title || subtitle) && (
      <div className="space-y-0.5">
        {title && <h3 className="font-medium text-sm text-foreground">{title}</h3>}
        {subtitle && <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>}
      </div>
    )}
    <div className="space-y-3">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="mt-1.5 min-w-0">{children}</div>
  </div>
);
