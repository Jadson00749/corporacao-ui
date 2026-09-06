import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Search, Tent, Trash2, Upload, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { OrganizersTabs } from "@/components/admin/OrganizersTabs";
import { brl } from "@/hooks/useOrganizerStats";
import { cn } from "@/lib/utils";
import {
  ADMIN_COLUMNS,
  KIND_LABEL,
  UNIT_TYPE_OPTIONS,
  kindOf,
  parseOptions,
  priceOf,
  type RentalItem,
} from "@/lib/rentalItems";

const db = supabase as any;

type OptionDraft = { label: string; price: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  category: string;
  unit_type: string;
  unit_label: string;
  price: string;
  image_url: string;
  requires_technician: boolean;
  stock_quantity: string;
  options: OptionDraft[];
  active: boolean;
  sort_order: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  description: "",
  category: "",
  unit_type: "unit",
  unit_label: "",
  price: "",
  image_url: "",
  requires_technician: false,
  stock_quantity: "",
  options: [],
  active: true,
  sort_order: "0",
});

/** Aceita vírgula como separador decimal, como o admin costuma digitar. */
const toNumber = (value: string) => Number(String(value).replace(",", ".").trim());

const toDraft = (row: RentalItem): Draft => {
  const base = priceOf(row);
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    category: row.category ?? "",
    unit_type: (row.unit_type || "unit").trim(),
    unit_label: row.unit_label ?? "",
    price: row.price == null ? "" : String(row.price),
    image_url: row.image_url ?? "",
    requires_technician: !!row.requires_technician,
    stock_quantity: row.stock_quantity == null ? "" : String(row.stock_quantity),
    options: parseOptions(row.options).map((o) => ({
      label: o.label,
      // Opções antigas podem guardar acréscimo; o editor trabalha com preço absoluto.
      price: o.price != null ? String(o.price) : o.extra ? String(base + o.extra) : "",
    })),
    active: row.active !== false,
    sort_order: row.sort_order == null ? "0" : String(row.sort_order),
  };
};

const AdminRentalItems = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_rental_items_manage"],
    queryFn: async (): Promise<RentalItem[]> => {
      const { data, error } = await db
        .from("rental_items")
        .select(ADMIN_COLUMNS)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RentalItem[];
    },
  });

  const categories = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.category || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "active" && r.active === false) return false;
      if (statusFilter === "inactive" && r.active !== false) return false;
      if (!q) return true;
      return `${r.name} ${r.description || ""} ${r.category || ""}`.toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  const activeCount = rows.filter((r) => r.active !== false).length;

  const uploadImage = async (file: File) => {
    setUploading(true);
    const path = `rental_items/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("corporacao-bucket").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("corporacao-bucket").getPublicUrl(path);
    setEditing((prev) => (prev ? { ...prev, image_url: data.publicUrl } : prev));
    toast.success("Imagem enviada!");
  };

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error("Informe o nome da estrutura.");
      return;
    }
    const price = toNumber(editing.price || "0");
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Preço inválido.");
      return;
    }
    const stockRaw = editing.stock_quantity.trim();
    const stock = stockRaw === "" ? null : toNumber(stockRaw);
    if (stock != null && (!Number.isFinite(stock) || stock < 0)) {
      toast.error("Estoque inválido.");
      return;
    }

    const options = editing.options
      .filter((o) => o.label.trim())
      .map((o) => {
        const optPrice = o.price.trim() === "" ? null : toNumber(o.price);
        return optPrice != null && Number.isFinite(optPrice)
          ? { label: o.label.trim(), price: optPrice }
          : { label: o.label.trim() };
      });

    const payload = {
      name,
      description: editing.description.trim(),
      category: editing.category.trim(),
      unit_type: editing.unit_type,
      unit_label: editing.unit_label.trim(),
      price,
      image_url: editing.image_url.trim() || null,
      requires_technician: editing.requires_technician,
      stock_quantity: stock,
      options,
      active: editing.active,
      sort_order: Math.trunc(toNumber(editing.sort_order || "0")) || 0,
    };

    setSaving(true);
    const { error } = editing.id
      ? await db.from("rental_items").update(payload).eq("id", editing.id)
      : await db.from("rental_items").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Estrutura atualizada" : "Estrutura criada");
    setEditing(null);
    refetch();
  };

  const remove = async (row: RentalItem) => {
    if (!confirm(`Excluir "${row.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from("rental_items").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estrutura excluída");
    refetch();
  };

  const toggleActive = async (row: RentalItem, value: boolean) => {
    const { error } = await db.from("rental_items").update({ active: value }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(value ? "Estrutura ativada" : "Estrutura desativada");
    refetch();
  };

  const patch = (changes: Partial<Draft>) => setEditing((prev) => (prev ? { ...prev, ...changes } : prev));

  const patchOption = (index: number, changes: Partial<OptionDraft>) =>
    setEditing((prev) =>
      prev
        ? { ...prev, options: prev.options.map((o, i) => (i === index ? { ...o, ...changes } : o)) }
        : prev
    );

  const isConfiguration = editing?.unit_type === "configuration";
  const unitHint = UNIT_TYPE_OPTIONS.find((o) => o.value === editing?.unit_type)?.hint;

  return (
    <div>
      <OrganizersTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Estruturas</h1>
          <p className="text-muted-foreground mt-1">
            {rows.length} {rows.length === 1 ? "estrutura" : "estruturas"} no catálogo · {activeCount} ativa
            {activeCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setEditing(emptyDraft())} variant="brand">
          <Plus className="w-4 h-4" /> Nova estrutura
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estrutura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Inativas"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
              statusFilter === key
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 mt-5" />
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto">
            <Tent className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <h2 className="font-display text-lg font-bold mt-3">Nenhuma estrutura cadastrada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre a primeira estrutura para que os organizadores possam selecioná-la.
          </p>
          <Button onClick={() => setEditing(emptyDraft())} variant="brand" size="sm" className="mt-4">
            <Plus className="w-4 h-4" /> Nova estrutura
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Nenhuma estrutura encontrada para este filtro.</p>
      ) : (
        <>
          {/* Desktop: tabela operacional */}
          <div className="mt-5 hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Estrutura</th>
                  <th className="p-3">Cobrança</th>
                  <th className="p-3">Preço</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3">Ordem</th>
                  <th className="p-3">Ativa</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const kind = kindOf(r.unit_type);
                  const opts = parseOptions(r.options);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {r.image_url ? (
                            <img src={r.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-secondary/60 flex items-center justify-center shrink-0">
                              <Tent className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.category || "Sem categoria"}
                              {r.requires_technician && (
                                <span className="ml-1.5 inline-flex items-center gap-1 text-brand">
                                  <Wrench className="w-3 h-3" /> técnico
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>{KIND_LABEL[kind]}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.unit_label || "—"}
                          {kind === "configuration" && ` · ${opts.length} opç${opts.length === 1 ? "ão" : "ões"}`}
                        </div>
                      </td>
                      <td className="p-3 tabular-nums">{brl(priceOf(r))}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">
                        {r.stock_quantity == null ? "Ilimitado" : String(r.stock_quantity)}
                      </td>
                      <td className="p-3 tabular-nums text-muted-foreground">{r.sort_order ?? 0}</td>
                      <td className="p-3">
                        <Switch
                          checked={r.active !== false}
                          onCheckedChange={(v) => toggleActive(r, v)}
                          aria-label={`Ativar ${r.name}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button onClick={() => setEditing(toDraft(r))} variant="outline" size="sm">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => remove(r)} variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards compactos */}
          <div className="mt-5 md:hidden space-y-2">
            {filtered.map((r) => {
              const kind = kindOf(r.unit_type);
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-secondary/60 flex items-center justify-center shrink-0">
                        <Tent className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.category || "Sem categoria"} · {KIND_LABEL[kind]}
                      </div>
                    </div>
                    <Switch
                      checked={r.active !== false}
                      onCheckedChange={(v) => toggleActive(r, v)}
                      aria-label={`Ativar ${r.name}`}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">{brl(priceOf(r))}</span>
                      {r.unit_label && ` / ${r.unit_label}`}
                      {r.stock_quantity != null && ` · estoque ${r.stock_quantity}`}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setEditing(toDraft(r))} variant="outline" size="sm">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => remove(r)} variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <datalist id="rental-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar estrutura" : "Nova estrutura"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="Ex.: Tenda 3x3"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={editing.category}
                    onChange={(e) => patch({ category: e.target.value })}
                    placeholder="Ex.: Estrutura, Som, Sinalização"
                    list="rental-categories"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  placeholder="Descrição curta que aparece no card do organizador."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Imagem</Label>
                <div className="mt-1 space-y-2">
                  {editing.image_url && (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="w-32 h-24 rounded object-cover border border-border"
                    />
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={editing.image_url}
                      onChange={(e) => patch({ image_url: e.target.value })}
                      placeholder="https://... ou envie um arquivo"
                    />
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                        <span>
                          <Upload className="w-4 h-4" /> {uploading ? "Enviando..." : "Enviar"}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file);
                        }}
                      />
                    </label>
                    {editing.image_url && (
                      <Button type="button" variant="outline" size="sm" onClick={() => patch({ image_url: "" })}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de cobrança</Label>
                  <Select value={editing.unit_type} onValueChange={(v) => patch({ unit_type: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {unitHint && <p className="text-xs text-muted-foreground mt-1">{unitHint}</p>}
                </div>
                <div>
                  <Label>Rótulo da unidade</Label>
                  <Input
                    value={editing.unit_label}
                    onChange={(e) => patch({ unit_label: e.target.value })}
                    placeholder="Ex.: diária, metro, unidade"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Aparece ao lado do preço. Vazio usa o padrão do tipo.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    value={editing.price}
                    onChange={(e) => patch({ price: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="mt-1 tabular-nums"
                  />
                </div>
                <div>
                  <Label>Estoque</Label>
                  <Input
                    value={editing.stock_quantity}
                    onChange={(e) => patch({ stock_quantity: e.target.value })}
                    inputMode="numeric"
                    placeholder="Ilimitado"
                    className="mt-1 tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Vazio = ilimitado.</p>
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    value={editing.sort_order}
                    onChange={(e) => patch({ sort_order: e.target.value })}
                    inputMode="numeric"
                    className="mt-1 tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Menor aparece primeiro.</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label>Opções / configurações</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isConfiguration
                        ? "O organizador escolhe uma destas opções. Preço vazio usa o preço base."
                        : "Usado apenas quando o tipo de cobrança é “Configuração”."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => patch({ options: [...editing.options, { label: "", price: "" }] })}
                  >
                    <Plus className="w-4 h-4" /> Opção
                  </Button>
                </div>

                {editing.options.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma opção cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {editing.options.map((o, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={o.label}
                          onChange={(e) => patchOption(i, { label: e.target.value })}
                          placeholder="Ex.: Pódio até 3º lugar"
                        />
                        <Input
                          value={o.price}
                          onChange={(e) => patchOption(i, { price: e.target.value })}
                          inputMode="decimal"
                          placeholder="Preço"
                          className="w-28 tabular-nums"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          aria-label="Remover opção"
                          onClick={() => patch({ options: editing.options.filter((_, idx) => idx !== i) })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={editing.requires_technician}
                    onCheckedChange={(v) => patch({ requires_technician: v })}
                  />
                  Exige técnico
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={editing.active} onCheckedChange={(v) => patch({ active: v })} />
                  Ativa (visível ao organizador)
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRentalItems;
