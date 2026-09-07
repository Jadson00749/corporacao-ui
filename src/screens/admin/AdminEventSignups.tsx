import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, ClipboardList } from "lucide-react";
import { exportSignupsXlsx, hasParticipantSnapshot } from "@/lib/exportSignupsXlsx";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import { useSearchParams } from "@/lib/router-compat";
import { EmptyState, ErrorState } from "@/components/site/EmptyState";
import { isKidsCategory } from "@/lib/eventPricing";
import { needsParticipantData } from "@/lib/participantCompletion";
import { AdminSignupDetailSheet, type AdminSignupDetailRow } from "@/components/admin/AdminSignupDetailSheet";


type Row = {
  id: string;
  category: string;
  status: string;
  notes: string;
  created_at: string;
  user_id: string;
  event_id: string;
  kit_option: string;
  shirt_size: string | null;
  coupon_code: string;
  team_name: string;
  participant_full_name?: string | null;
  participant_cpf?: string | null;
  participant_birth_date?: string | null;
  participant_gender?: string | null;
  participant_phone?: string | null;
  events: { id: string; name: string; date: string; city: string } | null;
  profiles: {
    full_name: string;
    cpf: string;
    email: string;
    whatsapp: string;
    team_name: string;
    city: string;
    state: string;
    gender: string;
    birth_date?: string | null;
  } | null;
};

const filled = (v?: string | null) => !!(v && String(v).trim());

const normalizeGender = (g?: string | null): "F" | "M" | "O" => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return "O";
};

/** Gênero do participante; perfil só no histórico sem nenhum participant_*. */
const rowGender = (r: Row): "F" | "M" | "O" => {
  const fromParticipant = normalizeGender(r.participant_gender);
  if (fromParticipant !== "O") return fromParticipant;
  if (!hasParticipantSnapshot(r)) {
    const fromProfile = normalizeGender(r.profiles?.gender);
    if (fromProfile !== "O") return fromProfile;
  }
  const cat = (r.category || "").toLowerCase();
  if (/femin/.test(cat)) return "F";
  if (/mascul/.test(cat)) return "M";
  return "O";
};

const athleteNameOf = (r: Row) => {
  if (filled(r.participant_full_name)) return r.participant_full_name!.trim();
  // Kids incompleto: nunca promover o responsável a atleta na lista.
  if (isKidsCategory(r.category)) return "Participante incompleto";
  return r.profiles?.full_name || "-";
};

const athleteCpfOf = (r: Row) => {
  if (filled(r.participant_cpf)) return r.participant_cpf!.trim();
  if (!hasParticipantSnapshot(r)) return r.profiles?.cpf || "-";
  return "-";
};

const formatKitOption = (value: string) => {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {}
  return value;
};


const AdminEventSignups = () => {
  const { isAdmin, organizerId } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status") || "all";
  const eventFromUrl = searchParams.get("event") || "all";
  const initialStatus =
    statusFromUrl === "pendente" || statusFromUrl === "confirmada" || statusFromUrl === "cancelada"
      ? statusFromUrl
      : "all";
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>(eventFromUrl);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [genderFilter, setGenderFilter] = useState<"all" | "F" | "M" | "kids">("all");
  const [ownership, setOwnership] = useState<"all" | "corp" | "external">("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");

  const { data: organizers = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin_signups_organizers"],
    queryFn: async () => {
      const { data } = await supabase.from("organizers" as any).select("id,name").order("name");
      return (data ?? []) as any[];
    },
  });
  const organizerMap = useMemo(() => new Map(organizers.map((o: any) => [o.id, o])), [organizers]);
  const partnerOrganizers = useMemo(() => organizers.filter((o: any) => !isMainOrg(o.name)), [organizers]);

  const { data: events = [] } = useQuery({
    queryKey: ["admin_events_list", isAdmin ? "all" : organizerId],
    queryFn: async () => {
      let q = supabase.from("events").select("id,name,distances,organizer_id").order("date", { ascending: false });
      if (!isAdmin && organizerId) q = q.eq("organizer_id" as any, organizerId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: isAdmin || !!organizerId,
  });

  const eventIds = useMemo(() => (events as any[]).map((e) => e.id), [events]);

  const { data: signups = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin_event_signups", isAdmin ? "all" : organizerId, eventIds.join(",")],
    enabled: isAdmin || (!!organizerId && events.length >= 0),
    queryFn: async (): Promise<Row[]> => {
      let sq = supabase
        .from("event_signups")
        .select("*, events(id,name,date,city)")
        .order("created_at", { ascending: false });
      if (!isAdmin) {
        if (!eventIds.length) return [];
        sq = sq.in("event_id", eventIds);
      }
      const { data, error } = await sq;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      // join profiles manually because there is no FK
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,full_name,cpf,email,whatsapp,team_name,city,state,gender,birth_date")
          .in("user_id", userIds);
        const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => { r.profiles = map.get(r.user_id) ?? null; });
      }
      return rows as Row[];
    },
  });

  const eventMap = useMemo(() => new Map((events as any[]).map((e) => [e.id, e])), [events]);
  const scopedSignups = useMemo(
    () => (isAdmin ? signups : signups.filter((signup) => eventIds.includes(signup.event_id))),
    [signups, isAdmin, eventIds]
  );
  const ownerOf = (eventId: string) => {
    const ev: any = eventMap.get(eventId);
    const org = ev?.organizer_id ? organizerMap.get(ev.organizer_id) : null;
    const corp = !ev?.organizer_id || isMainOrg((org as any)?.name);
    return { corp, name: corp ? (org as any)?.name || "Corporação Assessoria Esportiva" : (org as any)?.name || "Organizador", organizerId: ev?.organizer_id ?? null };
  };

  // Base (sem o filtro de gênero) para contadores consistentes com a lista
  const baseFiltered = useMemo(() => {
    return scopedSignups.filter((r) => {
      const status = (r.status || "").toLowerCase();
      // Canceladas ficam no histórico do banco, mas fora da lista operacional
      // (só aparecem se o admin filtrar explicitamente por "Cancelada").
      if (statusFilter === "cancelada") {
        if (status !== "cancelada") return false;
      } else if (status === "cancelada") {
        return false;
      }
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (isAdmin) {
        const own = ownerOf(r.event_id);
        if (ownership === "corp" && !own.corp) return false;
        if (ownership === "external" && own.corp) return false;
        if (orgFilter === "corp" && !own.corp) return false;
        if (orgFilter !== "all" && orgFilter !== "corp" && own.organizerId !== orgFilter) return false;
      }
      if (statusFilter === "pendente") {
        if (status === "confirmada" || status === "cancelada") return false;
      } else if (statusFilter !== "all" && statusFilter !== "cancelada" && status !== statusFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.participant_full_name || ""} ${r.profiles?.full_name || ""} ${r.profiles?.email || ""} ${r.participant_cpf || ""} ${r.profiles?.cpf || ""} ${r.events?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedSignups, search, eventFilter, statusFilter, isAdmin, ownership, orgFilter, eventMap, organizerMap]);

  const counts = useMemo(() => {
    return baseFiltered.reduce(
      (acc, r) => {
        const g = rowGender(r);
        if (g === "F") acc.F += 1;
        else if (g === "M") acc.M += 1;
        if (isKidsCategory(r.category)) acc.kids += 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, F: 0, M: 0, kids: 0 }
    );
  }, [baseFiltered]);

  const shirtCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of baseFiltered) {
      const sz = (r.shirt_size || "").trim().toUpperCase();
      if (!sz) continue;
      map.set(sz, (map.get(sz) ?? 0) + 1);
    }
    const order = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
    return Array.from(map.entries()).sort(
      (a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0]))
    );
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    if (genderFilter === "all") return baseFiltered;
    if (genderFilter === "kids") return baseFiltered.filter((r) => isKidsCategory(r.category));
    return baseFiltered.filter((r) => rowGender(r) === genderFilter);
  }, [baseFiltered, genderFilter]);


  const updateStatus = async (id: string, status: string) => {
    let query = supabase
      .from("event_signups")
      .update({ status })
      .eq("id", id)
      .select("id");
    if (!isAdmin) {
      if (!eventIds.length) {
        toast.error("Inscrição não pertence às suas provas.");
        return;
      }
      query = query.in("event_id", eventIds);
    }
    const { data, error } = await query.maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (!data) {
      toast.error("Inscrição não pertence às suas provas.");
      return;
    }
    toast.success("Status atualizado");
    refetch();

    if (status === "confirmada") {
      const { error: fnError } = await supabase.functions.invoke("send-confirmation-email", {
        body: { signup_id: id },
      });
      if (fnError) toast.error("Status salvo, mas erro ao enviar email.");
      else toast.success("Email de confirmação enviado ao atleta!");
    }
  };

  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AdminSignupDetailRow | null>(null);

  const exportXlsx = async () => {
    try {
      setExporting(true);
      const eventName = eventFilter !== "all" ? (events as any[]).find((e) => e.id === eventFilter)?.name : undefined;
      await exportSignupsXlsx(filtered as any, events as any, eventName);
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar planilha");
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Inscrições em provas</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportXlsx} disabled={exporting}>
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? "Gerando..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Input placeholder="Buscar atleta, e-mail, CPF, prova..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger><SelectValue placeholder="Prova" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as provas</SelectItem>
            {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ativas (pendente + confirmada)</SelectItem>
            <SelectItem value="pendente">Em andamento</SelectItem>
            <SelectItem value="confirmada">Aprovada</SelectItem>
            <SelectItem value="cancelada">Canceladas (histórico)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "Todas"], ["corp", "Corporação"], ["external", "Organizadores externos"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setOwnership(k); setOrgFilter("all"); }}
              className={[
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                ownership === k ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <select
            className="ml-auto border border-input bg-background rounded-md h-9 px-3 text-sm"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="all">{ownership === "external" ? "Todos os parceiros" : "Todos os organizadores"}</option>
            {ownership !== "external" && <option value="corp">Corporação</option>}
            {(ownership === "external" ? partnerOrganizers : organizers).map((o: any) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "Todos", counts.all],
          ["F", "Feminino", counts.F],
          ["M", "Masculino", counts.M],
          ["kids", "Kids", counts.kids],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setGenderFilter(value)}
            className={[
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              genderFilter === value
                ? "border-brand bg-brand text-brand-foreground font-semibold"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {shirtCounts.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-2">Camisetas {eventFilter !== "all" ? "(prova filtrada)" : "(todas as provas)"}</h2>
          <div className="flex flex-wrap gap-2">
            {shirtCounts.map(([size, count]) => (
              <span key={size} className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm">
                <span className="font-bold">{size}</span> — {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState
          title="Não foi possível carregar as inscrições"
          description="Tente novamente. Se o problema continuar, verifique sua conexão."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma inscrição encontrada"
          description={
            statusFilter !== "all" || search || eventFilter !== "all"
              ? "Nada corresponde aos filtros atuais. Ajuste a busca ou o status e tente de novo."
              : "Quando houver inscrições nas provas, elas aparecem aqui para conferência e confirmação."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Prova</th><th className="p-3">Atleta</th>
                <th className="p-3">Contato</th><th className="p-3">Categoria</th>
                <th className="p-3">Status</th><th className="p-3">Data</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => setDetail(r)}
                >
                  <td className="p-3">
                    <div className="font-medium">{r.events?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.events?.date}</div>
                    {isAdmin && (() => {
                      const own = ownerOf(r.event_id);
                      return (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {own.name} •{" "}
                          <span className={own.corp ? "font-semibold text-brand" : "font-semibold text-foreground/70"}>
                            {own.corp ? "Corporação" : "Organizador"}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{athleteNameOf(r)}</div>
                    <div className="text-xs text-muted-foreground">CPF {athleteCpfOf(r)}</div>
                    {r.profiles?.full_name && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Responsável: {r.profiles.full_name}
                      </div>
                    )}
                    {needsParticipantData(r) && (
                      <div className="mt-1 text-[11px] font-semibold text-warning">
                        Dados da criança incompletos
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div>{r.profiles?.email}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.whatsapp}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.category || "-"}</div>
                    {(r.kit_option || r.shirt_size || r.team_name || r.coupon_code) && (
                      <div className="text-xs text-muted-foreground">
                        {r.kit_option && <>Kit: {formatKitOption(r.kit_option)} </>}
                        {r.shirt_size && <>· Camiseta: <span className="font-semibold text-foreground">{r.shirt_size}</span> </>}
                        {r.team_name && <>· Equipe: {r.team_name} </>}
                        {r.coupon_code && <>· Cupom: {r.coupon_code}</>}
                      </div>
                    )}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className={`h-8 w-40 font-medium ${
                        r.status === "pendente" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40" :
                        r.status === "confirmada" ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40" :
                        r.status === "cancelada" ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40" : ""
                      }`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Em andamento</SelectItem>
                        <SelectItem value="confirmada">Aprovada (pago)</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setDetail(r)}
                    >
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminSignupDetailSheet
        signup={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onSaved={(opts) => {
          if (opts?.patch && detail) {
            setDetail({ ...detail, ...opts.patch });
          }
          if (opts?.closeSheet) setDetail(null);
          refetch();
        }}
      />
    </div>
  );
};

export default AdminEventSignups;
