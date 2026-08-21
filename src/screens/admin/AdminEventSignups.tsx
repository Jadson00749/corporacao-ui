import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  category: string;
  status: string;
  notes: string;
  created_at: string;
  user_id: string;
  event_id: string;
  kit_option: string;
  coupon_code: string;
  team_name: string;
  events: { id: string; name: string; date: string; city: string } | null;
  profiles: { full_name: string; cpf: string; email: string; whatsapp: string; team_name: string; city: string; state: string; gender: string } | null;
};

const normalizeGender = (g?: string | null): "F" | "M" | "O" => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m")) return "M";
  return "O";
};

/** Gênero real do perfil; fallback no texto da categoria apenas se o perfil estiver vazio. */
const rowGender = (r: Row): "F" | "M" | "O" => {
  const fromProfile = normalizeGender(r.profiles?.gender);
  if (fromProfile !== "O") return fromProfile;
  const cat = (r.category || "").toLowerCase();
  if (/femin/.test(cat)) return "F";
  if (/mascul/.test(cat)) return "M";
  return "O";
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
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "F" | "M">("all");

  const { data: events = [] } = useQuery({
    queryKey: ["admin_events_list"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id,name").order("date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: signups = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_event_signups"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("event_signups")
        .select("*, events(id,name,date,city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      // join profiles manually because there is no FK
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,full_name,cpf,email,whatsapp,team_name,city,state,gender")
          .in("user_id", userIds);
        const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => { r.profiles = map.get(r.user_id) ?? null; });
      }
      return rows as Row[];
    },
  });

  // Base (sem o filtro de gênero) para contadores consistentes com a lista
  const baseFiltered = useMemo(() => {
    return signups.filter((r) => {
      const status = (r.status || "").toLowerCase();
      // Canceladas ficam no histórico do banco, mas fora da lista operacional
      // (só aparecem se o admin filtrar explicitamente por "Cancelada").
      if (statusFilter === "cancelada") {
        if (status !== "cancelada") return false;
      } else if (status === "cancelada") {
        return false;
      }
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (statusFilter !== "all" && statusFilter !== "cancelada" && status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.profiles?.full_name || ""} ${r.profiles?.email || ""} ${r.profiles?.cpf || ""} ${r.events?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [signups, search, eventFilter, statusFilter]);

  const counts = useMemo(() => {
    return baseFiltered.reduce(
      (acc, r) => {
        const g = rowGender(r);
        if (g === "F") acc.F += 1;
        else if (g === "M") acc.M += 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, F: 0, M: 0 }
    );
  }, [baseFiltered]);

  const filtered = useMemo(
    () => (genderFilter === "all" ? baseFiltered : baseFiltered.filter((r) => rowGender(r) === genderFilter)),
    [baseFiltered, genderFilter]
  );


  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("event_signups").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
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

  const exportCsv = () => {
    const headers = ["Prova", "Data", "Atleta", "CPF", "E-mail", "WhatsApp", "Categoria", "Kit", "Cupom", "Equipe", "Cidade", "Status", "Inscrito em"];
    const rows = filtered.map((r) => [
      r.events?.name || "", r.events?.date || "",
      r.profiles?.full_name || "", r.profiles?.cpf || "", r.profiles?.email || "",
      r.profiles?.whatsapp || "", r.category, formatKitOption(r.kit_option || ""), r.coupon_code || "",
      r.team_name || r.profiles?.team_name || "",
      `${r.profiles?.city || ""} ${r.profiles?.state || ""}`.trim(),
      r.status, new Date(r.created_at).toLocaleString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inscricoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Inscrições em provas</h1>
        <Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4" /> Exportar CSV</Button>
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
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Em andamento</SelectItem>
            <SelectItem value="confirmada">Aprovada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "Todos", counts.all],
          ["F", "Feminino", counts.F],
          ["M", "Masculino", counts.M],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setGenderFilter(value as "all" | "F" | "M")}
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

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma inscrição encontrada.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Prova</th><th className="p-3">Atleta</th>
                <th className="p-3">Contato</th><th className="p-3">Categoria</th>
                <th className="p-3">Status</th><th className="p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{r.events?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.events?.date}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{r.profiles?.full_name || "-"}</div>
                    <div className="text-xs text-muted-foreground">CPF {r.profiles?.cpf || "-"}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.profiles?.email}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.whatsapp}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.category || "-"}</div>
                    {(r.kit_option || r.team_name || r.coupon_code) && (
                      <div className="text-xs text-muted-foreground">
                        {r.kit_option && <>Kit: {formatKitOption(r.kit_option)} </>}
                        {r.team_name && <>· Equipe: {r.team_name} </>}
                        {r.coupon_code && <>· Cupom: {r.coupon_code}</>}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminEventSignups;
