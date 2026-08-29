import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Settings2, Trophy, Users, Percent, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { useOrganizerStats, brl, isMainOrg, type Stats } from "@/hooks/useOrganizerStats";
import { athleteName } from "@/lib/exportSignupsXlsx";

type Organizer = {
  id: string;
  user_id: string;
  name: string;
  status: string | null;
  commission_percentage: number | null;
};

type Profile = { user_id: string; full_name: string | null; email: string | null };

const db = supabase as any;

const SummaryCard = ({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: boolean }) => (
  <div className={cn("rounded-xl border p-3", accent ? "border-brand/40 bg-brand/10" : "border-border bg-card")}>
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Icon className={cn("w-3.5 h-3.5", accent && "text-brand")} /> {label}
    </div>
    <div className="font-display text-xl font-bold mt-1 tabular-nums">{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
  </div>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-[92px]">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold tabular-nums">{value}</div>
  </div>
);

const AdminOrganizers = () => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<Organizer | null>(null);

  const s = useOrganizerStats();
  const all = s.organizers as Organizer[];
  const mainOrg = all.find((o) => isMainOrg(o.name)) ?? null;
  const partners = all.filter((o) => !isMainOrg(o.name));

  const partnerTotals = partners.reduce(
    (acc, o) => {
      const st = s.statsFor(o.id);
      acc.activeEvents += st.activeEvents;
      acc.approved += st.approved;
      acc.commission += st.commission;
      return acc;
    },
    { activeEvents: 0, approved: 0, commission: 0 }
  );
  const activePartners = partners.filter((o) => (o.status ?? "active") === "active").length;

  const mainStats = mainOrg ? s.statsFor(mainOrg.id) : null;
  const mainActive = (mainStats?.activeEvents ?? 0) + s.corporate.activeEvents;
  const mainTotal = (mainStats?.events ?? 0) + s.corporate.events;

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

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Organizadores parceiros ativos" value={String(activePartners)} />
        <SummaryCard icon={Trophy} label="Provas ativas de parceiros" value={String(partnerTotals.activeEvents)} />
        <SummaryCard icon={CheckCircle2} label="Inscrições aprovadas" value={String(partnerTotals.approved)} />
        <SummaryCard icon={Percent} label="Comissão estimada" value={brl(partnerTotals.commission)} accent />
      </div>

      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
        <Info className="w-3 h-3" /> Comissão estimada da Corporação sobre inscrições aprovadas de parceiros.
      </p>

      {s.isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          <h2 className="font-display text-lg font-bold mt-8">Organização principal</h2>
          <div className="mt-2 bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="min-w-[200px] flex-1 font-semibold">
              {mainOrg?.name || "Corporação Assessoria Esportiva"}
            </div>
            <Metric label="Provas ativas" value={String(mainActive)} />
            <Metric label="Provas cadastradas" value={String(mainTotal)} />
            {mainOrg && (
              <Button variant="outline" size="sm" onClick={() => setManaging(mainOrg)}>
                <Settings2 className="w-4 h-4" /> Gerenciar
              </Button>
            )}
          </div>

          <h2 className="font-display text-lg font-bold mt-8">Organizadores parceiros</h2>
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Nenhum organizador parceiro cadastrado ainda.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {partners.map((o) => {
                const active = (o.status ?? "active") === "active";
                const st = s.statsFor(o.id);
                return (
                  <div key={o.id} className="bg-card border border-border rounded-xl p-3.5 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="min-w-[180px] flex-1 flex items-center gap-2">
                      <span className="font-semibold truncate">{o.name}</span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                          active ? "bg-brand/15 text-brand" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <Metric label="Comissão" value={`${o.commission_percentage ?? 0}%`} />
                    <Metric label="Provas ativas" value={String(st.activeEvents)} />
                    <Metric label="Inscrições aprovadas" value={String(st.approved)} />
                    <Metric label="Valor aprovado" value={brl(st.approvedValue)} />
                    <Metric label="Comissão estimada" value={brl(st.commission)} />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setManaging(o)}>
                        <Settings2 className="w-4 h-4" /> Gerenciar
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/admin/events?organizer=${o.id}`}>Ver provas</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}


      {creating && (
        <NewOrganizerDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            s.refetch();
            qc.invalidateQueries({ queryKey: ["admin_org_events"] });
          }}
        />
      )}

      {managing && (
        <ManageOrganizerDialog
          organizer={managing}
          owner={s.ownerMap.get(managing.user_id) ?? null}
          stats={s.statsFor(managing.id)}
          events={s.events.filter((e) => e.organizer_id === managing.id)}
          eventStats={s.eventStats}
          signups={s.signups.filter((sg) =>
            s.events.some((e) => e.organizer_id === managing.id && e.id === sg.event_id)
          )}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null);
            s.refetch();
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
  stats,
  events,
  eventStats,
  signups,
  onClose,
  onSaved,
}: {
  organizer: Organizer;
  owner: Profile | null;
  stats: Stats;
  events: any[];
  eventStats: (id: string) => Stats;
  signups: any[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [name, setName] = useState(organizer.name ?? "");
  const [commission, setCommission] = useState(String(organizer.commission_percentage ?? 0));
  const [active, setActive] = useState((organizer.status ?? "active") === "active");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"resumo" | "provas" | "inscricoes">("resumo");

  const visibleSignups = useMemo(
    () => signups.filter((s) => (s.status || "").toLowerCase() !== "cancelada").slice(0, 60),
    [signups]
  );

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{organizer.name}</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground -mt-2">
          {owner?.full_name || "Responsável não identificado"}
          {owner?.email ? ` • ${owner.email}` : ""} • {active ? "Ativo" : "Inativo"} • Comissão{" "}
          {organizer.commission_percentage ?? 0}%
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap gap-x-8 gap-y-3">
          <Metric label="Provas ativas" value={String(stats.activeEvents)} />
          <Metric label="Aprovadas" value={String(stats.approved)} />
          <Metric label="Pendentes" value={String(stats.pending)} />
          <Metric label="Valor aprovado" value={brl(stats.approvedValue)} />
          <Metric label="Comissão estimada" value={brl(stats.commission)} />
        </div>


        <div className="flex gap-1 border-b border-border">
          {(["resumo", "provas", "inscricoes"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "resumo" ? "Resumo" : t === "provas" ? "Provas" : "Inscrições"}
            </button>
          ))}
        </div>

        {tab === "resumo" && (
          <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Comissão baseada em inscrições aprovadas manualmente.
            </p>

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
              <Switch
                checked={active}
                onCheckedChange={(v) => {
                  if (active && !v) {
                    const ok = window.confirm(
                      "Ao inativar este organizador, todas as provas ativas dele também serão inativadas."
                    );
                    if (!ok) return;
                  }
                  setActive(v);
                }}
              />
              <span className="text-sm">{active ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
        )}

        {tab === "provas" && (
          <div className="space-y-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma prova cadastrada.</p>}
            {events.map((e) => {
              const st = eventStats(e.id);
              return (
                <div key={e.id} className="border border-border rounded-lg p-3 flex flex-wrap gap-x-6 gap-y-2 items-center">
                  <div className="min-w-[160px] flex-1">
                    <div className="text-sm font-semibold">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.date || "sem data"} • {e.status || "—"}
                    </div>
                  </div>
                  <Metric label="Inscrições" value={`${st.approved}/${st.signups}`} />
                  <Metric label="Valor aprovado" value={brl(st.approvedValue)} />
                  <Metric label="Comissão est." value={brl(st.commission)} />
                </div>
              );
            })}
          </div>
        )}

        {tab === "inscricoes" && (
          <div className="space-y-2">
            {visibleSignups.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma inscrição.</p>}
            {visibleSignups.map((sg) => (
              <div key={sg.id} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-[160px] flex-1 text-sm font-medium">{athleteName(sg) || "Atleta"}</div>
                <div className="text-xs text-muted-foreground">{sg.events?.name}</div>
                <div className="text-xs text-muted-foreground">{sg.category}</div>
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    (sg.status || "").toLowerCase() === "confirmada"
                      ? "bg-brand/15 text-brand"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {(sg.status || "").toLowerCase() === "confirmada" ? "Aprovada" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  );
};

export default AdminOrganizers;
