import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Upload } from "lucide-react";
import { ImageFocusPicker } from "@/components/admin/ImageFocusPicker";
import { LinkPicker } from "@/components/admin/LinkPicker";
import { toast } from "sonner";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "image" | "tags" | "multiselect" | "image-focus" | "link";
  placeholder?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  /** For type "image-focus": key of the field that stores the image URL */
  imageKey?: string;
  /** For type "image-focus": key of the field that stores object-fit */
  fitKey?: string;
};

type Props = {
  table: string;
  queryKey: string;
  title: string;
  fields: FieldDef[];
  displayKey: string;
  orderBy?: { column: string; ascending?: boolean };
  /** If set, shows an inline toggle for this boolean column on each row (e.g. "active") */
  inlineToggleKey?: string;
  inlineToggleLabel?: string;
};

const emptyFor = (fields: FieldDef[]) => {
  const o: any = {};
  for (const f of fields) {
    if (f.type === "boolean") o[f.key] = false;
    else if (f.type === "number") o[f.key] = 0;
    else if (f.type === "tags" || f.type === "multiselect") o[f.key] = [];
    else o[f.key] = "";
  }
  return o;
};

export const CrudTable = ({ table, queryKey, title, fields, displayKey, orderBy, inlineToggleKey, inlineToggleLabel = "Ativo" }: Props) => {
  const qc = useQueryClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from(table as any).select("*");
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [table]);

  const save = async () => {
    const payload = { ...editing };
    delete payload.created_at;
    delete payload.updated_at;
    const isNew = !payload.id;
    if (isNew) delete payload.id;

    const { error } = isNew
      ? await supabase.from(table as any).insert(payload)
      : await supabase.from(table as any).update(payload).eq("id", payload.id);

    if (error) return toast.error(error.message);
    toast.success(isNew ? "Criado!" : "Atualizado!");
    setEditing(null);
    qc.invalidateQueries({ queryKey: [queryKey] });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído!");
    qc.invalidateQueries({ queryKey: [queryKey] });
    load();
  };

  const toggleInline = async (row: any, value: boolean) => {
    if (!inlineToggleKey) return;
    // optimistic update
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [inlineToggleKey]: value } : r)));
    const { error } = await supabase
      .from(table as any)
      .update({ [inlineToggleKey]: value })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      // revert
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [inlineToggleKey]: !value } : r)));
      return;
    }
    toast.success(value ? `${inlineToggleLabel} ativado` : `${inlineToggleLabel} desativado`);
    qc.invalidateQueries({ queryKey: [queryKey] });
  };

  const uploadImage = async (file: File, key: string) => {
    const path = `${table}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("corporacao-bucket").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("corporacao-bucket").getPublicUrl(path);
    setEditing({ ...editing, [key]: data.publicUrl });
    toast.success("Imagem enviada!");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{rows.length} {rows.length === 1 ? "item" : "itens"}</p>
        </div>
        <Button onClick={() => setEditing(emptyFor(fields))} variant="brand">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      <div className="mt-6 bg-card border border-border rounded-xl divide-y divide-border">
        {loading && <div className="p-6 text-muted-foreground">Carregando...</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-muted-foreground">Nenhum item ainda.</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {r.image && <img src={r.image} alt="" className="w-12 h-12 rounded object-cover" />}
              {r.src && <img src={r.src} alt="" className="w-12 h-12 rounded object-cover" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{r[displayKey]}</div>
                {r.date && <div className="text-xs text-muted-foreground">{r.date} {r.time ?? ""}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {inlineToggleKey && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Switch
                    checked={!!r[inlineToggleKey]}
                    onCheckedChange={(v) => toggleInline(r, v)}
                  />
                  <span className="hidden sm:inline">{inlineToggleLabel}</span>
                </label>
              )}
              <div className="flex gap-2">
                <Button onClick={() => setEditing(r)} variant="outline" size="sm"><Pencil className="w-4 h-4" /></Button>
                <Button onClick={() => remove(r.id)} variant="outline" size="sm"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo item"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  {f.type === "textarea" && (
                    <Textarea value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} rows={3} className="mt-1" />
                  )}
                  {f.type === "boolean" && (
                    <div className="mt-2"><Switch checked={!!editing[f.key]} onCheckedChange={(v) => setEditing({ ...editing, [f.key]: v })} /></div>
                  )}
                  {f.type === "number" && (
                    <Input type="number" value={editing[f.key] ?? 0} onChange={(e) => setEditing({ ...editing, [f.key]: parseInt(e.target.value) || 0 })} className="mt-1" />
                  )}
                  {f.type === "date" && (
                    <Input type="date" value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} className="mt-1" />
                  )}
                  {f.type === "tags" && (
                    <Textarea
                      value={(editing[f.key] ?? []).join("\n")}
                      onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value.split("\n").filter(Boolean) })}
                      placeholder="Um item por linha"
                      rows={5}
                      className="mt-1"
                    />
                  )}
                  {f.type === "multiselect" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(f.options ?? []).map((opt) => {
                        const selected = (editing[f.key] ?? []).includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              const current: string[] = editing[f.key] ?? [];
                              const next = selected
                                ? current.filter((v) => v !== opt.value)
                                : [...current, opt.value];
                              setEditing({ ...editing, [f.key]: next });
                            }}
                            className={
                              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
                              (selected
                                ? "bg-brand text-brand-foreground border-brand"
                                : "bg-background text-foreground/70 border-border hover:border-brand/60")
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {f.type === "image" && (
                    <div className="mt-1 space-y-2">
                      {editing[f.key] && <img src={editing[f.key]} alt="" className="w-32 h-32 rounded object-cover border border-border" />}
                      <div className="flex gap-2">
                        <Input value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} placeholder="URL da imagem" />
                        <label className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span><Upload className="w-4 h-4" /> Enviar</span>
                          </Button>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file, f.key); }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {f.type === "image-focus" && (
                    <ImageFocusPicker
                      src={editing[f.imageKey ?? "image"]}
                      position={editing[f.key] ?? "center"}
                      fit={editing[f.fitKey ?? "image_fit"] ?? "cover"}
                      onChange={(pos, fit) =>
                        setEditing({
                          ...editing,
                          [f.key]: pos,
                          [f.fitKey ?? "image_fit"]: fit,
                        })
                      }
                    />
                  )}
                  {f.type === "link" && (
                    <LinkPicker
                      value={editing[f.key] ?? ""}
                      onChange={(v) => setEditing({ ...editing, [f.key]: v })}
                      options={f.options}
                    />
                  )}
                  {(!f.type || f.type === "text") && (
                    <Input value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} placeholder={f.placeholder} className="mt-1" />
                  )}
                  {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
                </div>
              ))}
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
