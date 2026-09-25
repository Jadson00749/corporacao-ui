import { useMemo, useState } from "react";
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
import { Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STORE_MOCK_FULFILLMENT,
  STORE_MOCK_PAYMENT_NOTE,
  formatStoreMockDateBR,
  initialStoreMockCatalog,
  storeMockTotalUnits,
  type StoreMockProduct,
  type StoreMockVariant,
} from "@/data/storeMockCatalog";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const emptyProduct = (): StoreMockProduct => ({
  id: `mock-${Date.now()}`,
  name: "",
  description: "",
  price: 0,
  active: true,
  sort_order: 99,
  imageTone: "from-zinc-800 via-zinc-900 to-black",
  has_variants: false,
  stock: 10,
  variants: [
    { id: `v-p-${Date.now()}`, name: "P", stock: 4 },
    { id: `v-m-${Date.now()}`, name: "M", stock: 8 },
    { id: `v-g-${Date.now()}`, name: "G", stock: 6 },
    { id: `v-gg-${Date.now()}`, name: "GG", stock: 3 },
  ],
  sale_starts_at: null,
  sale_ends_at: "2026-10-10",
});

export function StoreMockAdminPanel() {
  const [products, setProducts] = useState<StoreMockProduct[]>(() =>
    initialStoreMockCatalog(),
  );
  const [editing, setEditing] = useState<StoreMockProduct | null>(null);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...products].sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );

  const openNew = () => {
    setEditing(emptyProduct());
    setOpen(true);
  };

  const openEdit = (p: StoreMockProduct) => {
    setEditing(JSON.parse(JSON.stringify(p)));
    setOpen(true);
  };

  const save = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === editing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...editing, name };
        return next;
      }
      return [...prev, { ...editing, name }];
    });
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand/25 bg-brand/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span className="font-semibold text-brand">MOCK DEV</span>
        {" · "}visível só com <code className="text-foreground/80">?storeMock=1</code> no localhost.
        Nada é salvo no banco.
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-foreground">Loja da prova</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Venda produtos oficiais junto com a inscrição.
        </p>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={openNew}>
        <Plus className="w-4 h-4" /> Adicionar produto
      </Button>

      <div className="space-y-3">
        {sorted.map((p) => {
          const units = storeMockTotalUnits(p);
          const saleUntil = formatStoreMockDateBR(p.sale_ends_at);
          return (
            <div
              key={p.id}
              className="flex gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 sm:p-4"
            >
              <div
                className={cn(
                  "h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br",
                  p.imageTone,
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm text-foreground leading-snug">{p.name}</p>
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
                <p className="text-sm font-semibold text-brand">{brl(p.price)}</p>
                <p className="text-xs text-muted-foreground">
                  {units} {units === 1 ? "unidade" : "unidades"}
                  {p.has_variants
                    ? ` · ${p.variants.length} variações`
                    : " · variante Padrão"}
                </p>
                {saleUntil ? (
                  <p className="text-xs text-muted-foreground">
                    Venda até {saleUntil}
                  </p>
                ) : p.sale_starts_at ? (
                  <p className="text-xs text-muted-foreground">
                    Início {formatStoreMockDateBR(p.sale_starts_at)}
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

      <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
        {STORE_MOCK_PAYMENT_NOTE}
        <br />
        {STORE_MOCK_FULFILLMENT}
      </p>

      <ProductFormDialog
        open={open}
        product={editing}
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
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  product: StoreMockProduct | null;
  onOpenChange: (o: boolean) => void;
  onChange: (p: StoreMockProduct | null) => void;
  onSave: () => void;
}) {
  if (!product) return null;

  const set = (patch: Partial<StoreMockProduct>) =>
    onChange({ ...product, ...patch });

  const setVariant = (idx: number, patch: Partial<StoreMockVariant>) => {
    const variants = product.variants.map((v, i) =>
      i === idx ? { ...v, ...patch } : v,
    );
    set({ variants });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product.name.trim() ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "h-28 w-full rounded-2xl bg-gradient-to-br border border-border/40",
              product.imageTone,
            )}
          />
          <p className="text-[11px] text-muted-foreground -mt-2">
            Foto (placeholder no mock)
          </p>

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
              <Label className="text-xs">Início da venda (opcional)</Label>
              <Input
                className="mt-1.5"
                type="date"
                value={product.sale_starts_at ?? ""}
                onChange={(e) =>
                  set({ sale_starts_at: e.target.value || null })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Disponível para compra até</Label>
              <Input
                className="mt-1.5"
                type="date"
                value={product.sale_ends_at ?? ""}
                onChange={(e) =>
                  set({ sale_ends_at: e.target.value || null })
                }
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2 leading-relaxed">
            Encerrar as vendas antes da prova dá tempo de produzir e separar os itens.
          </p>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Possui variações?</span>
            <Switch
              checked={product.has_variants}
              onCheckedChange={(v) => set({ has_variants: v })}
            />
          </label>

          {!product.has_variants ? (
            <div>
              <Label className="text-xs">Estoque (variante Padrão)</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={product.stock ?? 0}
                onChange={(e) =>
                  set({ stock: Math.max(0, parseInt(e.target.value) || 0) })
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Variações / estoque</Label>
              {product.variants.map((v, i) => (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="w-10 text-sm font-medium">{v.name}</span>
                  <Input
                    type="number"
                    className="h-9"
                    value={v.stock}
                    onChange={(e) =>
                      setVariant(i, {
                        stock: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                  />
                </div>
              ))}
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
            {STORE_MOCK_PAYMENT_NOTE}
            <br />
            {STORE_MOCK_FULFILLMENT}
          </p>

          <Button type="button" variant="brand" className="w-full" onClick={onSave}>
            Salvar (somente neste mock)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
