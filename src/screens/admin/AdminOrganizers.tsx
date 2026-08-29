import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Settings2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

type Organizer = {
  id: string;
  user_id: string;
  name: string;
  status: string | null;
  commission_percentage: number | null;
};

type Profile = { user_id: string; full_name: string | null; email: string | null };

const db = supabase as any;

const AdminOrganizers = () => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<Organizer | null>(null);

  const { data: organizers = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_organizers"],
    queryFn: async (): Promise<Organizer[]> => {
      const { data, error } = await db
        .from("organizers")
        .select("id,user_id,name,status,commission_percentage")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Organizer[];
    },
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["admin_organizers_owners", organizers.map((o) => o.user_id).join(",")],
    enabled: organizers.length > 0,
    queryFn: async (): Promise<Profile[]> => {
      const { data } = await db
        .from("profiles")
        .select("user_id,full_name,email")
        .in("user_id", organizers.map((o) => o.user_id));
      return (data ?? []) as Profile[];
    },
  });

  const { data: eventCounts = {} } = useQuery({
    queryKey: ["admin_organizers_event_counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await db.from("events").select("organizer_id");
      const acc: Record<string, number> = {};
      (data ?? []).forEach((e: any) => {
        if (e.organizer_id) acc[e.organizer_id] = (acc[e.organizer_id] ?? 0) + 1;
      });
      return acc;
    },
  });

  const ownerMap = useMemo(() => new Map(owners.map((p) => [p.user_id, p])), [owners]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Organizadores</h1>
          <p className="text-muted-foreground mt-1">Organizações que publicam provas na plataforma.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Novo organizador
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : organizers.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-8">Nenhum organizador cadastrado ainda.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {organizers.map((o) => {
            const owner = ownerMap.get(o.user_id);
            const active = (o.status ?? "active") === "active";
            return (
              <div
                key={o.id}
                className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-4"
              >
                <div className="min-w-[180px] flex-1">
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {owner?.full_name || "Responsável não identificado"}
                    {owner?.email ? ` • ${owner.email}` : ""}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-muted-foreground">
                  Comissão: {o.commission_percentage ?? 0}%
                </div>
                <div className="text-sm tabular-nums text-muted-foreground flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> {eventCounts[o.id] ?? 0} provas
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-full",
                    active ? "bg-brand/15 text-brand" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {active ? "Ativo" : "Inativo"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setManaging(o)}>
                  <Settings2 className="w-4 h-4" /> Gerenciar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NewOrganizerDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refetch();
            qc.invalidateQueries({ queryKey: ["admin_organizers_event_counts"] });
          }}
        />
      )}

      {managing && (
        <ManageOrganizerDialog
          organizer={managing}
          owner={ownerMap.get(managing.user_id) ?? null}
          eventCount={eventCounts[managing.id] ?? 0}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

const NewOrganizerDialog = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("0");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["admin_organizer_user_search", search],
    enabled: search.trim().length >= 3 && !selected,
    queryFn: async (): Promise<Profile[]> => {
      const q = search.trim();
      const { data } = await db
        .from("profiles")
        .select("user_id,full_name,email")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      return (data ?? []) as Profile[];
    },
  });

  const save = async () => {
    if (!selected) return toast.error("Selecione um usuário da plataforma.");
    if (!name.trim()) return toast.error("Informe o nome da organização.");
    setSaving(true);
    const { error } = await db.from("organizers").insert({
      user_id: selected.user_id,
      name: name.trim(),
      commission_percentage: Number(commission) || 0,
      status: active ? "active" : "inactive",
    });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const { error: roleError } = await db
      .from("user_roles")
      .insert({ user_id: selected.user_id, role: "organizer" });
    setSaving(false);
    if (roleError && !/duplicate|unique/i.test(roleError.message)) {
      toast.error(`Organização criada, mas o perfil não foi atribuído: ${roleError.message}`);
    } else {
      toast.success("Organizador criado!");
    }
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo organizador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Usuário da plataforma</Label>
            {selected ? (
              <div className="mt-1 flex items-center justify-between gap-3 border border-border rounded-lg p-3">
                <div>
                  <div className="text-sm font-medium">{selected.full_name || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">{selected.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nome ou e-mail"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {search.trim().length >= 3 && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                    {isFetching && <div className="p-3 text-xs text-muted-foreground">Buscando...</div>}
                    {!isFetching && results.length === 0 && (
                      <div className="p-3 text-xs text-muted-foreground">Nenhum usuário encontrado.</div>
                    )}
                    {results.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => {
                          setSelected(p);
                          if (!name) setName(p.full_name || "");
                        }}
                        className="w-full text-left p-3 hover:bg-secondary transition-colors"
                      >
                        <div className="text-sm font-medium">{p.full_name || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <Label>Nome da organização</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Comissão %</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">{active ? "Ativo" : "Inativo"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ManageOrganizerDialog = ({
  organizer,
  owner,
  eventCount,
  onClose,
  onSaved,
}: {
  organizer: Organizer;
  owner: Profile | null;
  eventCount: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(organizer.name ?? "");
  const [commission, setCommission] = useState(String(organizer.commission_percentage ?? 0));
  const [active, setActive] = useState((organizer.status ?? "active") === "active");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Informe o nome da organização.");
    setSaving(true);
    const { error } = await db
      .from("organizers")
      .update({
        name: name.trim(),
        commission_percentage: Number(commission) || 0,
        status: active ? "active" : "inactive",
      })
      .eq("id", organizer.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Organizador atualizado!");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar organizador</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Responsável: {owner?.full_name || "—"} {owner?.email ? `• ${owner.email}` : ""}
            <br />
            Provas cadastradas: {eventCount}
          </div>

          <div>
            <Label>Nome da organização</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Comissão %</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">{active ? "Ativo" : "Inativo"}</span>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link to="/admin/events">
              <Trophy className="w-4 h-4" /> Ver provas
            </Link>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOrganizers;
