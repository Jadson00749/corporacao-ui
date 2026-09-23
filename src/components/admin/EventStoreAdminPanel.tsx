import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Star, Trash2, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateYmdBrInput } from "@/components/ui/date-ymd-br-input";
import { compareDateYmd, parseDateYmdInput } from "@/lib/dateYmd";
import {
  EVENT_STORE_MAX_IMAGES,
  defaultSizeVariantDrafts,
  eventStoreDateInputToEndISO,
  eventStoreDateInputToStartISO,
  eventStoreIsoToDateInput,
  eventStoreStockSummary,
  formatEventStoreDateBR,
  saveEventStoreProduct,
  uploadEventStoreProductImage,
  useEventStoreProducts,
  type EventStoreProduct,
  type EventStoreVariant,
} from "@/lib/eventStore";
import { Link } from "@/lib/router-compat";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FULFILLMENT =
  "Retirada junto à entrega do kit, antes da prova.";
const PAYMENT_NOTE =
  "Os produtos desta prova utilizam a mesma configuração de pagamento do organizador responsável pelo evento.";

type DraftVariant = {
  id?: string;
  name: string;
  stock_quantity: number | null;
  price_override: number | null;
  active: boolean;
  sort_order: number;
  unlimited: boolean;
};

type DraftImage = {
  key: string;
  id?: string;
  image_url: string;
  is_cover: boolean;
};

type DraftProduct = {
  id?: string;
  name: string;
  description: string;
  images: DraftImage[];
  price: number;
  active: boolean;
  sort_order: number;
  has_variants: boolean;
  sale_starts_at: string;
  sale_ends_at: string;
  default_stock: number;
  default_unlimited: boolean;
  variants: DraftVariant[];
};

const emptyDraft = (sortOrder: number): DraftProduct => ({
  name: "",
  description: "",
  images: [],
  price: 0,
  active: true,
  sort_order: sortOrder,
  has_variants: false,
  sale_starts_at: "",
  sale_ends_at: "",
  default_stock: 0,
  default_unlimited: false,
  variants: defaultSizeVariantDrafts().map((v) => ({
    ...v,
    unlimited: false,
  })),
});

function productToDraft(p: EventStoreProduct): DraftProduct {
  const padrao = p.variants.find(
    (v) => v.name.trim().toLowerCase() === "padrão",
  );

  const coverUrl = (p.image_url ?? "").trim();
  const images: DraftImage[] = (p.images ?? []).map((img, i) => ({
    key: img.id || `img-${i}-${img.image_url}`,
    id: img.id?.startsWith("legacy-cover-") ? undefined : img.id,
    image_url: img.image_url,
    is_cover: coverUrl
      ? img.image_url === coverUrl
      : i === 0,
  }));
  if (images.length && !images.some((img) => img.is_cover)) {
    images[0].is_cover = true;
  }

  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    images,
    price: Number(p.price) || 0,
    active: p.active,
    sort_order: p.sort_order ?? 0,
    has_variants: p.has_variants,
    sale_starts_at: eventStoreIsoToDateInput(p.sale_starts_at),
    sale_ends_at: eventStoreIsoToDateInput(p.sale_ends_at),
    default_stock: padrao?.stock_quantity ?? 0,
    default_unlimited: padrao ? padrao.stock_quantity == null : false,
    variants: p.has_variants
      ? (p.variants.length
          ? p.variants.map((v) => variantToDraft(v))
          : defaultSizeVariantDrafts().map((v) => ({
              ...v,
              unlimited: false,
            })))
      : defaultSizeVariantDrafts().map((v) => ({
          ...v,
          unlimited: false,
        })),
  };
}

function variantToDraft(v: EventStoreVariant): DraftVariant {
  return {
    id: v.id,
    name: v.name,
    stock_quantity: v.stock_quantity,
    price_override: v.price_override,
    active: v.active,
    sort_order: v.sort_order,
    unlimited: v.stock_quantity == null,
  };
}

type Props = {
  eventId: string | null | undefined;
  eventName?: string | null;
  /** Reusa o salvamento do editor (sem duplicar validação). */
  onSaveEvent?: () => void;
};

export function EventStoreAdminPanel({
  eventId,
  eventName,
  onSaveEvent,
}: Props) {
  const qc = useQueryClient();
  const { data: products = [], isLoading, refetch } = useEventStoreProducts(
    eventId,
  );
  const [editing, setEditing] = useState<DraftProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...products].sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );

  const nextSort = useMemo(
    () =>
      products.length
        ? Math.max(...products.map((p) => p.sort_order ?? 0)) + 1
        : 0,
    [products],
  );

  const openNew = () => {
    if (!eventId) {
      toast.error("Salve a prova antes de cadastrar produtos da loja.");
      return;
    }
    setEditing(emptyDraft(nextSort));
    setOpen(true);
  };

  const openEdit = (p: EventStoreProduct) => {
    setEditing(productToDraft(p));
    setOpen(true);
  };

  const save = async () => {
    if (!eventId || !editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error("Informe o nome do produto.");
      return;
    }

    const startRaw = editing.sale_starts_at.trim();
    const endRaw = editing.sale_ends_at.trim();

    if (startRaw) {
      const p = parseDateYmdInput(startRaw);
      if (!p.ok) {
        toast.error("Data de início das vendas inválida.");
        return;
      }
    }
    if (endRaw) {
      const p = parseDateYmdInput(endRaw);
      if (!p.ok) {
        toast.error("Data de fim das vendas inválida.");
        return;
      }
    }
    if (startRaw && endRaw && compareDateYmd(startRaw, endRaw) > 0) {
      toast.error("A data final deve ser posterior à data inicial.");
      return;
    }

    setSaving(true);
    try {
      await saveEventStoreProduct({
        id: editing.id,
        event_id: eventId,
        name,
        description: editing.description,
        image_url:
          editing.images.find((i) => i.is_cover)?.image_url?.trim() ||
          editing.images[0]?.image_url?.trim() ||
          null,
        price: Number(editing.price) || 0,
        active: editing.active,
        sort_order: editing.sort_order,
        has_variants: editing.has_variants,
        sale_starts_at: eventStoreDateInputToStartISO(startRaw || null),
        sale_ends_at: eventStoreDateInputToEndISO(endRaw || null),
        default_stock: editing.default_unlimited
          ? null
          : Math.max(0, Math.floor(Number(editing.default_stock) || 0)),
        variants: editing.variants.map((v, i) => ({
          id: v.id,
          name: v.name,
          stock_quantity: v.unlimited
            ? null
            : Math.max(0, Math.floor(Number(v.stock_quantity) || 0)),
          price_override:
            v.price_override != null && String(v.price_override) !== ""
              ? Number(v.price_override)
              : null,
          active: v.active,
          sort_order: v.sort_order ?? i,
        })),
        images: editing.images.map((img, i) => ({
          id: img.id,
          image_url: img.image_url,
          sort_order: i,
          is_cover: img.is_cover,
        })),
      });
      toast.success("Produto salvo na loja da prova.");
      setOpen(false);
      setEditing(null);
      await refetch();
      qc.invalidateQueries({
        queryKey: ["event_store_availability", eventId],
      });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  if (!eventId) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-6 space-y-3">
        <div className="space-y-1.5">
          <h3 className="font-display text-base font-semibold text-foreground">
            Configure a loja da sua prova
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Salve a prova primeiro para começar a cadastrar produtos, fotos,
            preços e estoque.
          </p>
        </div>
        {onSaveEvent ? (
          <Button type="button" variant="brand" size="sm" onClick={onSaveEvent}>
            Salvar prova e configurar loja
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use o botão{" "}
            <span className="font-medium text-foreground/80">
              Salvar alterações
            </span>{" "}
            do formulário e volte a esta aba em seguida.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 px-3.5 py-2.5 text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground">Loja da prova</span>
        {" · "}cadastro de produtos, preços e estoque. Separação e retirada
        ficam em{" "}
        <Link
          to={`/admin/store-orders?event=${eventId}`}
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Pedidos
        </Link>
        . Aprovação de PIX fica em{" "}
        <span className="font-medium text-foreground/80">
          Inscrições → Pagamentos
        </span>
        .
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-foreground">
            Produtos
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Venda produtos oficiais junto com a inscrição ou avulsos.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/store-orders?event=${eventId}`}>
            Ver pedidos desta prova
          </Link>
        </Button>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={openNew}>
        <Plus className="w-4 h-4" /> Adicionar produto
      </Button>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando produtos…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum produto nesta prova ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => {
            const stock = eventStoreStockSummary(p.variants.filter((v) => v.active));
            const saleUntil = formatEventStoreDateBR(p.sale_ends_at);
            const saleStart = formatEventStoreDateBR(p.sale_starts_at);
            const cover =
              p.image_url ||
              p.images?.find((i) => i.sort_order === 0)?.image_url ||
              p.images?.[0]?.image_url ||
              null;
            return (
              <div
                key={p.id}
                className="flex gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 sm:p-4"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover border border-border/40 aspect-square"
                  />
                ) : (
                  <div
                    className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-border/40 aspect-square"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-foreground leading-snug">
                      {p.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        p.active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-brand">
                    {brl(Number(p.price) || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stock.label}
                    {p.has_variants
                      ? ` · ${p.variants.filter((v) => v.active).length} variações`
                      : " · variante Padrão"}
                  </p>
                  {saleUntil ? (
                    <p className="text-xs text-muted-foreground">
                      Venda até {saleUntil}
                    </p>
                  ) : saleStart ? (
                    <p className="text-xs text-muted-foreground">
                      Início {saleStart}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 text-xs"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
        {PAYMENT_NOTE}
        <br />
        {FULFILLMENT}
      </p>

      <ProductFormDialog
        open={open}
        product={editing}
        eventId={eventId}
        saving={saving}
        onOpenChange={setOpen}
        onChange={setEditing}
        onSave={save}
      />
    </div>
  );
}

function ProductFormDialog({
  open,
  product,
  eventId,
  saving,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  product: DraftProduct | null;
  eventId: string;
  saving: boolean;
  onOpenChange: (o: boolean) => void;
  onChange: (p: DraftProduct | null) => void;
  onSave: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  if (!product) return null;

  const set = (patch: Partial<DraftProduct>) =>
    onChange({ ...product, ...patch });

  const setVariant = (idx: number, patch: Partial<DraftVariant>) => {
    const variants = product.variants.map((v, i) =>
      i === idx ? { ...v, ...patch } : v,
    );
    set({ variants });
  };

  const setImages = (images: DraftImage[]) => {
    const next = images.map((img, i) => ({ ...img }));
    if (next.length && !next.some((i) => i.is_cover)) next[0].is_cover = true;
    set({ images: next });
  };

  const upload = async (file: File) => {
    if (product.images.length >= EVENT_STORE_MAX_IMAGES) {
      toast.error(`No máximo ${EVENT_STORE_MAX_IMAGES} imagens.`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadEventStoreProductImage(eventId, file);
      const isFirst = product.images.length === 0;
      setImages([
        ...product.images,
        {
          key: `new-${Date.now()}`,
          image_url: url,
          is_cover: isFirst,
        },
      ]);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const next = [...product.images];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setImages(next);
  };

  const setCover = (idx: number) => {
    setImages(
      product.images.map((img, i) => ({ ...img, is_cover: i === idx })),
    );
  };

  const removeImage = (idx: number) => {
    setImages(product.images.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product.id ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Fotos do produto</Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Até {EVENT_STORE_MAX_IMAGES} imagens · recomendado 1200 × 1200 px.
              JPG, PNG ou WebP.
            </p>

            {product.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {product.images.map((img, idx) => (
                  <div
                    key={img.key}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-xl border bg-zinc-900",
                      img.is_cover
                        ? "border-brand ring-1 ring-brand/40"
                        : "border-border/50",
                    )}
                  >
                    <img
                      src={img.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {img.is_cover && (
                      <span className="absolute left-1 top-1 rounded bg-brand px-1 py-0.5 text-[9px] font-semibold text-white">
                        Capa
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-black/55 p-0.5">
                      <button
                        type="button"
                        className="rounded p-0.5 text-white/80 hover:text-white disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => moveImage(idx, -1)}
                        aria-label="Mover para esquerda"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded p-0.5",
                          img.is_cover ? "text-amber-300" : "text-white/80 hover:text-amber-200",
                        )}
                        onClick={() => setCover(idx)}
                        aria-label="Definir como capa"
                        title="Definir como capa"
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            img.is_cover && "fill-current",
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-white/80 hover:text-destructive"
                        onClick={() => removeImage(idx)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-white/80 hover:text-white disabled:opacity-30"
                        disabled={idx === product.images.length - 1}
                        onClick={() => moveImage(idx, 1)}
                        aria-label="Mover para direita"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  uploading || product.images.length >= EVENT_STORE_MAX_IMAGES
                }
                asChild
              >
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Enviando…" : "Adicionar foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    className="hidden"
                    disabled={
                      uploading ||
                      product.images.length >= EVENT_STORE_MAX_IMAGES
                    }
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/80">
              A estrela define a capa (image_url + primeira no card). Bucket:{" "}
              <code>corporacao-bucket</code>.
            </p>
          </div>

          <div>
            <Label className="text-xs">Nome do produto</Label>
            <Input
              className="mt-1.5"
              value={product.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={product.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Preço (R$)</Label>
            <Input
              className="mt-1.5"
              type="number"
              step="0.01"
              value={product.price}
              onChange={(e) => set({ price: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início das vendas</Label>
              <DateYmdBrInput
                className="mt-1.5"
                value={product.sale_starts_at}
                onChange={(ymd) => set({ sale_starts_at: ymd })}
                min="2020-01-01"
                max="2100-12-31"
              />
            </div>
            <div>
              <Label className="text-xs">Fim das vendas</Label>
              <DateYmdBrInput
                className="mt-1.5"
                value={product.sale_ends_at}
                onChange={(ymd) => set({ sale_ends_at: ymd })}
                min="2020-01-01"
                max="2100-12-31"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2 leading-relaxed">
            Formato DD/MM/AAAA · opcionais. A RPC rejeita compra fora da janela —
            o frontend não é a autoridade.
          </p>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Possui variações?</span>
            <Switch
              checked={product.has_variants}
              onCheckedChange={(v) => {
                if (v && product.variants.length === 0) {
                  set({
                    has_variants: true,
                    variants: defaultSizeVariantDrafts().map((x) => ({
                      ...x,
                      unlimited: false,
                    })),
                  });
                } else {
                  set({ has_variants: v });
                }
              }}
            />
          </label>

          {!product.has_variants ? (
            <div className="space-y-2">
              <Label className="text-xs">Estoque (variante Padrão)</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={product.default_unlimited}
                  onCheckedChange={(u) => set({ default_unlimited: u })}
                />
                Ilimitado
              </label>
              {!product.default_unlimited && (
                <Input
                  type="number"
                  value={product.default_stock}
                  onChange={(e) =>
                    set({
                      default_stock: Math.max(
                        0,
                        parseInt(e.target.value) || 0,
                      ),
                    })
                  }
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">Variações / estoque</Label>
              {product.variants.map((v, i) => (
                <div
                  key={v.id ?? `new-${i}`}
                  className="rounded-xl border border-border/50 p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-9 w-16 font-medium"
                      value={v.name}
                      onChange={(e) => setVariant(i, { name: e.target.value })}
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                      <Switch
                        checked={v.unlimited}
                        onCheckedChange={(u) =>
                          setVariant(i, {
                            unlimited: u,
                            stock_quantity: u ? null : v.stock_quantity ?? 0,
                          })
                        }
                      />
                      Ilim.
                    </label>
                    {!v.unlimited && (
                      <Input
                        type="number"
                        className="h-9"
                        placeholder="Estoque"
                        value={v.stock_quantity ?? 0}
                        onChange={(e) =>
                          setVariant(i, {
                            stock_quantity: Math.max(
                              0,
                              parseInt(e.target.value) || 0,
                            ),
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9"
                      placeholder="Preço override (opc.)"
                      value={v.price_override ?? ""}
                      onChange={(e) =>
                        setVariant(i, {
                          price_override:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                    <label className="flex items-center gap-1.5 text-[11px] shrink-0">
                      <Switch
                        checked={v.active}
                        onCheckedChange={(a) => setVariant(i, { active: a })}
                      />
                      Ativa
                    </label>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() =>
                  set({
                    variants: [
                      ...product.variants,
                      {
                        name: "",
                        stock_quantity: 0,
                        price_override: null,
                        active: true,
                        sort_order: product.variants.length,
                        unlimited: false,
                      },
                    ],
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" /> Variação
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-2 text-sm col-span-1">
              <span>Ativo</span>
              <Switch
                checked={product.active}
                onCheckedChange={(v) => set({ active: v })}
              />
            </label>
            <div>
              <Label className="text-xs">Ordenação</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={product.sort_order}
                onChange={(e) =>
                  set({ sort_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {PAYMENT_NOTE}
            <br />
            {FULFILLMENT}
          </p>

          <Button
            type="button"
            variant="brand"
            className="w-full"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
