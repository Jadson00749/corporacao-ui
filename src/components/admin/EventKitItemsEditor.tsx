import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Package, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EventKitItem = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  image_url: string;
  active: boolean;
  sort_order: number;
};

const emptyDraft = (sortOrder = 0): Draft => ({
  name: "",
  description: "",
  image_url: "",
  active: true,
  sort_order: sortOrder,
});

const BUCKET = "corporacao-bucket";

type Props = {
  eventId?: string | null;
};

/**
 * CRUD dos itens do kit incluso na prova (event_kit_items).
 * Independente de kit_options (opções/adicionais da inscrição).
 * Formulário inline (evita Dialog aninhado no editor da prova).
 */
export const EventKitItemsEditor = ({ eventId }: Props) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_event_kit_items", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventKitItem[]> => {
      const { data, error } = await supabase
        .from("event_kit_items")
        .select("*")
        .eq("event_id", eventId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      // Migration ainda não aplicada → não quebra o editor da prova
      if (error) {
        console.warn("[event_kit_items]", error.message);
        return [];
      }
      return (data ?? []) as EventKitItem[];
    },
  });

  const nextSort = useMemo(
    () => (items.length ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1 : 0),
    [items]
  );

  const invalidatePublic = () => {
    qc.invalidateQueries({ queryKey: ["event_kit_items", eventId] });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `events/kit-items/${eventId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) {
        toast.error(error.message);
        return;
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      setDraft((d) => (d ? { ...d, image_url: url } : d));
      toast.success("Imagem enviada");
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async () => {
    if (!eventId || !draft) return;
    const name = draft.name.trim();
    if (!name) return toast.error("Informe o nome do item.");

    setSaving(true);
    try {
      const payload = {
        event_id: eventId,
        name,
        description: draft.description.trim() || null,
        image_url: draft.image_url.trim() || null,
        active: draft.active,
        sort_order: draft.sort_order,
      };

      if (draft.id) {
        const { error } = await supabase
          .from("event_kit_items")
          .update(payload)
          .eq("id", draft.id)
          .eq("event_id", eventId);
        if (error) return toast.error(error.message);
        toast.success("Item atualizado");
      } else {
        const { error } = await supabase.from("event_kit_items").insert(payload);
        if (error) return toast.error(error.message);
        toast.success("Item adicionado");
      }

      setDraft(null);
      await refetch();
      invalidatePublic();
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: EventKitItem) => {
    if (!eventId) return;
    if (!confirm(`Remover "${item.name}" do kit?`)) return;
    const { error } = await supabase
      .from("event_kit_items")
      .delete()
      .eq("id", item.id)
      .eq("event_id", eventId);
    if (error) return toast.error(error.message);
    toast.success("Item removido");
    await refetch();
    invalidatePublic();
  };

  const toggleActive = async (item: EventKitItem, active: boolean) => {
    if (!eventId) return;
    const { error } = await supabase
      .from("event_kit_items")
      .update({ active })
      .eq("id", item.id)
      .eq("event_id", eventId);
    if (error) return toast.error(error.message);
    await refetch();
    invalidatePublic();
  };

  if (!eventId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-4 text-sm text-muted-foreground">
        Salve a prova primeiro para cadastrar os itens do kit.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-md">
          Mostre aos participantes o que faz parte do kit desta prova.
        </p>
        {!draft && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft(emptyDraft(nextSort))}
          >
            <Plus className="w-4 h-4" /> Adicionar item
          </Button>
        )}
      </div>

      {draft && (
        <div className="rounded-xl border border-brand/30 bg-secondary/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {draft.id ? "Editar item" : "Novo item"}
            </p>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDraft(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div>
            <Label className="text-xs">Nome do item</Label>
            <Input
              className="mt-1"
              placeholder="Ex: Camiseta oficial"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Ex: Camiseta dry fit oficial da prova"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Imagem</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="https://… ou envie um arquivo"
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
              />
              <label className="cursor-pointer shrink-0">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    <Upload className="w-4 h-4" /> {uploading ? "Enviando…" : "Upload"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {draft.image_url && (
              <div className="mt-2 h-24 w-24 overflow-hidden rounded-lg border border-border bg-secondary/30">
                <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={draft.active}
              onCheckedChange={(v) => setDraft({ ...draft, active: v })}
            />
            Ativo (aparece na página da prova)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="brand" size="sm" disabled={saving} onClick={saveDraft}>
              {saving ? "Salvando…" : "Salvar item"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando itens…</p>
      ) : items.length === 0 && !draft ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-border/60 px-3 py-3">
          Nenhum item cadastrado ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex gap-3 rounded-xl border border-border p-3",
                !item.active && "opacity-60"
              )}
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/40 border border-border/60">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <Switch
                      checked={item.active}
                      onCheckedChange={(v) => toggleActive(item, v)}
                    />
                    {item.active ? "Ativo" : "Inativo"}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setDraft({
                        id: item.id,
                        name: item.name,
                        description: item.description ?? "",
                        image_url: item.image_url ?? "",
                        active: item.active,
                        sort_order: item.sort_order,
                      })
                    }
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() => removeItem(item)}
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
