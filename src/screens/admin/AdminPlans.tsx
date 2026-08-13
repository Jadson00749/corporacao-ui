import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { PLAN_CATEGORIES, type PlanCategory } from "@/data/plans";
import { cn } from "@/lib/utils";

type PlanRow = {
  id?: string;
  name: string;
  tagline: string;
  price: string | null;
  price_note: string | null;
  price_installments: string | null;
  highlight: boolean;
  features: string[];
  footer_note: string | null;
  cta_message: string;
  categories: string[];
  sort_order: number;
};

const PERIOD_PRESETS = ["Mensal", "Trimestral", "Semestral", "Anual"];

const newEmptyPlan = (category: PlanCategory, sort_order: number): PlanRow => ({
  name: "Mensal",
  tagline: PLAN_CATEGORIES.find((c) => c.value === category)?.label ?? "",
  price: "",
  price_note: "/mês",
  price_installments: "",
  highlight: false,
  features: [],
  footer_note: "",
  cta_message: "Olá! Tenho interesse neste plano.",
  categories: [category],
  sort_order,
});

const AdminPlans = () => {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<PlanCategory>("corrida");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categoryPlans = useMemo(
    () => rows.filter((r) => (r.categories ?? []).includes(activeCategory)),
    [rows, activeCategory]
  );

  // shared footer note for the category (uses first non-empty)
  const sharedFooter = useMemo(
    () => categoryPlans.find((p) => p.footer_note)?.footer_note ?? "",
    [categoryPlans]
  );

  const updateLocal = (id: string | undefined, patch: Partial<PlanRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const savePlan = async (plan: PlanRow) => {
    setSavingId(plan.id ?? "new");
    const payload: any = { ...plan };
    delete payload.created_at;
    delete payload.updated_at;
    const isNew = !payload.id;
    if (isNew) delete payload.id;

    const { error, data } = isNew
      ? await supabase.from("plans").insert(payload).select().single()
      : await supabase.from("plans").update(payload).eq("id", plan.id!).select().single();

    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Plano salvo!");
    if (isNew && data) {
      setRows((prev) => [...prev, data as any]);
    }
    qc.invalidateQueries({ queryKey: ["plans"] });
  };

  const deletePlan = async (id?: string) => {
    if (!id) return;
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Plano excluído.");
    qc.invalidateQueries({ queryKey: ["plans"] });
  };

  const addPlanForCategory = async () => {
    const baseSort =
      Math.max(0, ...categoryPlans.map((p) => p.sort_order ?? 0)) + 10;
    const draft = newEmptyPlan(activeCategory, baseSort);
    await savePlan(draft);
  };

  const updateSharedFooter = async (value: string) => {
    // update all plans in this category locally + DB
    const ids = categoryPlans.map((p) => p.id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id!) ? { ...r, footer_note: value } : r
      )
    );
    const { error } = await supabase
      .from("plans")
      .update({ footer_note: value })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Rodapé atualizado para toda a categoria.");
    qc.invalidateQueries({ queryKey: ["plans"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Planos</h1>
          <p className="text-muted-foreground mt-1">
            Edite os planos por categoria. Cada categoria tem seus próprios pacotes (ex: Mensal, Trimestral, Semestral, Anual).
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {PLAN_CATEGORIES.map((c) => {
          const count = rows.filter((r) => (r.categories ?? []).includes(c.value)).length;
          const isActive = activeCategory === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setActiveCategory(c.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                isActive
                  ? "bg-brand text-brand-foreground border-brand shadow-brand"
                  : "bg-card text-foreground/70 border-border hover:border-brand/60"
              )}
            >
              {c.label}
              <span
                className={cn(
                  "ml-2 text-xs px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-brand-foreground/20" : "bg-secondary"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shared footer note for category */}
      <div className="mt-5 bg-secondary/40 border border-border rounded-xl p-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Rodapé desta categoria
        </Label>
        <Textarea
          value={sharedFooter}
          onChange={(e) => {
            const value = e.target.value;
            const ids = categoryPlans.map((p) => p.id).filter(Boolean) as string[];
            setRows((prev) =>
              prev.map((r) => (ids.includes(r.id!) ? { ...r, footer_note: value } : r))
            );
          }}
          onBlur={(e) => updateSharedFooter(e.target.value)}
          rows={2}
          placeholder="Ex: **via pix recorrente   *O custo de postagem do KIT deverá ser pago pelo aluno."
          className="mt-2 bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Aparece abaixo dos cards desta categoria no site. Salvo automaticamente.
        </p>
      </div>

      {/* Plans list for category */}
      {loading ? (
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {categoryPlans.length === 0 && (
              <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
                <p className="text-muted-foreground">
                  Nenhum plano nesta categoria ainda.
                </p>
              </div>
            )}

            {categoryPlans.map((plan) => (
              <PlanEditor
                key={plan.id}
                plan={plan}
                saving={savingId === plan.id}
                onChange={(patch) => updateLocal(plan.id, patch)}
                onSave={() => savePlan(plan)}
                onDelete={() => deletePlan(plan.id)}
              />
            ))}
          </div>

          <Button
            onClick={addPlanForCategory}
            variant="brand"
            className="mt-6"
            disabled={savingId === "new"}
          >
            <Plus className="w-4 h-4" />
            Adicionar pacote em {PLAN_CATEGORIES.find((c) => c.value === activeCategory)?.label}
          </Button>
        </>
      )}
    </div>
  );
};

const PlanEditor = ({
  plan,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  plan: PlanRow;
  saving: boolean;
  onChange: (patch: Partial<PlanRow>) => void;
  onSave: () => void;
  onDelete: () => void;
}) => {
  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-5 transition-all",
        plan.highlight ? "border-brand shadow-brand" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-brand">
            {plan.name || "Sem nome"}
          </span>
          {plan.highlight && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-brand/15 text-brand px-2 py-0.5 rounded-full font-semibold">
              <Star className="w-3 h-3 fill-brand" /> Mais popular
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch
              checked={!!plan.highlight}
              onCheckedChange={(v) => onChange({ highlight: v })}
            />
            Destacar
          </label>
          <Button onClick={onSave} variant="brand" size="sm" disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button onClick={onDelete} variant="outline" size="sm">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Período</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5 mb-2">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const noteMap: Record<string, string> = {
                    Mensal: "/mês",
                    Trimestral: "/trimestre",
                    Semestral: "/semestre",
                    Anual: "/ano",
                  };
                  onChange({ name: p, price_note: noteMap[p] ?? plan.price_note });
                }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-colors",
                  plan.name === p
                    ? "bg-brand text-brand-foreground border-brand"
                    : "bg-background border-border hover:border-brand/60"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Input
            value={plan.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex: Mensal"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preço total</Label>
            <Input
              value={plan.price ?? ""}
              onChange={(e) => onChange({ price: e.target.value })}
              placeholder="R$130,00"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">Período (sufixo)</Label>
            <Input
              value={plan.price_note ?? ""}
              onChange={(e) => onChange({ price_note: e.target.value })}
              placeholder="/mês"
              className="mt-1.5"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Parcelamento (opcional)</Label>
            <Input
              value={plan.price_installments ?? ""}
              onChange={(e) => onChange({ price_installments: e.target.value })}
              placeholder="3x R$120,00**"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Label className="text-xs">Benefícios (um por linha)</Label>
        <Textarea
          value={(plan.features ?? []).join("\n")}
          onChange={(e) =>
            onChange({
              features: e.target.value.split("\n").filter((l) => l.trim() !== ""),
            })
          }
          rows={5}
          placeholder={"Treinos individuais e personalizados\nVia app TrainingPeaks\nContato direto com o treinador"}
          className="mt-1.5 font-mono text-sm"
        />
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Mensagem do botão WhatsApp</Label>
          <Input
            value={plan.cta_message}
            onChange={(e) => onChange({ cta_message: e.target.value })}
            placeholder="Olá! Tenho interesse no plano..."
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs">Ordem de exibição</Label>
          <Input
            type="number"
            value={plan.sort_order ?? 0}
            onChange={(e) => onChange({ sort_order: parseInt(e.target.value) || 0 })}
            className="mt-1.5"
          />
        </div>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          ⚙️ Avançado: também aparecer em outras categorias
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {PLAN_CATEGORIES.map((cat) => {
            const selected = (plan.categories ?? []).includes(cat.value);
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  const current = plan.categories ?? [];
                  const next = selected
                    ? current.filter((v) => v !== cat.value)
                    : [...current, cat.value];
                  // never allow empty
                  onChange({ categories: next.length ? next : current });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  selected
                    ? "bg-brand text-brand-foreground border-brand"
                    : "bg-background text-foreground/70 border-border hover:border-brand/60"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Por padrão, este plano aparece apenas na categoria atual. Use isso só se quiser repetir o pacote em outra aba.
        </p>
      </details>
    </div>
  );
};

export default AdminPlans;
