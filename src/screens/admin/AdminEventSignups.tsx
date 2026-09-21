import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, ClipboardList, Clock } from "lucide-react";
import { exportSignupsXlsx, hasParticipantSnapshot } from "@/lib/exportSignupsXlsx";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isMainOrg } from "@/hooks/useOrganizerStats";
import { useSearchParams } from "@/lib/router-compat";
import { EmptyState, ErrorState } from "@/components/site/EmptyState";
import { isKidsCategory } from "@/lib/eventPricing";
import { needsParticipantData } from "@/lib/participantCompletion";
import { AdminSignupDetailSheet, type AdminSignupDetailRow } from "@/components/admin/AdminSignupDetailSheet";
import {
  countSignupDbStatuses,
  getSignupStatusInfo,
  matchesSignupStatusFilter,
  parseSignupStatusFilterFromUrl,
  signupStatusLabel,
  type SignupStatusFilter,
} from "@/lib/signupOperationalStatus";
import { cn } from "@/lib/utils";

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

type OwnerInfo = {
  corp: boolean;
  name: string;
  organizerId: string | null;
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

const PAGE_SIZES = [50, 100, 0] as const; // 0 = Todos

type SignupRowProps = {
  row: Row;
  isAdmin: boolean;
  owner: OwnerInfo | null;
  onOpen: (row: Row) => void;
  onStatusChange: (id: string, status: string) => void;
};

const SignupRow = memo(function SignupRow({
  row: r,
  isAdmin,
  owner,
  onOpen,
  onStatusChange,
}: SignupRowProps) {
  const info = getSignupStatusInfo(r);
  const phone = (r.participant_phone || r.profiles?.whatsapp || "").replace(/\D/g, "");
  const email = (r.profiles?.email || "").trim();
  const db = info.dbStatus;
  const createdLabel = useMemo(
    () => new Date(r.created_at).toLocaleDateString("pt-BR"),
    [r.created_at],
  );

  return (
    <tr
      className="border-t border-border cursor-pointer hover:bg-secondary/40 transition-colors"
      onClick={() => onOpen(r)}
    >
      <td className="p-3">
        <div className="font-medium">{r.events?.name}</div>
        <div className="text-xs text-muted-foreground">{r.events?.date}</div>
        {isAdmin && owner ? (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {owner.name} •{" "}
            <span
              className={
                owner.corp
                  ? "font-semibold text-brand"
                  : "font-semibold text-foreground/70"
              }
            >
              {owner.corp ? "Corporação" : "Organizador"}
            </span>
          </div>
        ) : null}
      </td>
      <td className="p-3">
        <div className="font-medium">{athleteNameOf(r)}</div>
        <div className="text-xs text-muted-foreground">CPF {athleteCpfOf(r)}</div>
        {r.profiles?.full_name ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            Responsável: {r.profiles.full_name}
          </div>
        ) : null}
        {needsParticipantData(r) ? (
          <div className="mt-1 text-[11px] font-semibold text-warning">
            Dados da criança incompletos
          </div>
        ) : null}
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
            {r.shirt_size && (
              <>
                · Camiseta:{" "}
                <span className="font-semibold text-foreground">{r.shirt_size}</span>{" "}
              </>
            )}
            {r.team_name && <>· Equipe: {r.team_name} </>}
            {r.coupon_code && <>· Cupom: {r.coupon_code}</>}
          </div>
        )}
      </td>
      <td className="p-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1.5 min-w-[11rem]">
          <Select value={r.status} onValueChange={(v) => onStatusChange(r.id, v)}>
            <SelectTrigger
              className={cn("h-9 w-full font-medium border", info.badgeClassName)}
            >
              <SelectValue>
                <span className="inline-flex items-center gap-1.5">
                  {info.overdue ? <Clock className="w-3.5 h-3.5 shrink-0" /> : null}
                  {signupStatusLabel(r.status)}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {db === "pagamento_atrasado" ? (
                <SelectItem value="pagamento_atrasado" disabled>
                  Em atraso
                </SelectItem>
              ) : null}
              {db === "pendente" || db === "confirmada" || db === "cancelada" ? (
                <SelectItem value="pendente">Em andamento</SelectItem>
              ) : null}
              <SelectItem value="confirmada">Aprovado</SelectItem>
              <SelectItem value="cancelada">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          {info.overdueHint ? (
            <p className="text-[11px] leading-snug text-amber-800/90 dark:text-amber-300/90">
              {info.overdueHint}
            </p>
          ) : null}
          {info.overdue && (phone || email) ? (
            <div className="flex flex-wrap gap-1.5">
              {phone ? (
                <a
                  href={`https://wa.me/55${phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  WhatsApp
                </a>
              ) : null}
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  E-mail
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>
      <td className="p-3 text-xs text-muted-foreground">{createdLabel}</td>
      <td className="p-3" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onOpen(r)}
        >
          Ver detalhes
        </Button>
      </td>
    </tr>
  );
});

const AdminEventSignups = () => {
  const qc = useQueryClient();
  const { isAdmin, organizerId } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status") || "all";
  const eventFromUrl = searchParams.get("event") || "all";

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [eventFilter, setEventFilter] = useState<string>(eventFromUrl);
  const [statusFilter, setStatusFilter] = useState<SignupStatusFilter>(
    parseSignupStatusFilterFromUrl(statusFromUrl),
  );
  const [genderFilter, setGenderFilter] = useState<"all" | "F" | "M" | "kids">("all");
  const [ownership, setOwnership] = useState<"all" | "corp" | "external">("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AdminSignupDetailRow | null>(null);

  const { data: organizers = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin_signups_organizers"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("organizers" as any).select("id,name").order("name");
      return (data ?? []) as any[];
    },
  });
  const organizerMap = useMemo(
    () => new Map(organizers.map((o: any) => [o.id, o])),
    [organizers],
  );
  const partnerOrganizers = useMemo(
    () => organizers.filter((o: any) => !isMainOrg(o.name)),
    [organizers],
  );

  const { data: events = [] } = useQuery({
    queryKey: ["admin_events_list", isAdmin ? "all" : organizerId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("events")
        .select("id,name,distances,organizer_id")
        .order("date", { ascending: false });
      if (!isAdmin && organizerId) q = q.eq("organizer_id" as any, organizerId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: isAdmin || !!organizerId,
  });

  const eventIds = useMemo(() => (events as any[]).map((e) => e.id as string), [events]);
  const eventIdsKey = useMemo(() => eventIds.slice().sort().join(","), [eventIds]);

  const signupsQueryKey = useMemo(
    () =>
      [
        "admin_event_signups",
        isAdmin ? "all" : "org",
        isAdmin ? "all" : organizerId ?? "",
        // Organizador: escopo por IDs estáveis; admin não depende da lista de provas.
        isAdmin ? "" : eventIdsKey,
      ] as const,
    [isAdmin, organizerId, eventIdsKey],
  );

  const {
    data: allSignups = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: signupsQueryKey,
    enabled: isAdmin || (!!organizerId && eventIds.length > 0),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select(
            "user_id,full_name,cpf,email,whatsapp,team_name,city,state,gender,birth_date",
          )
          .in("user_id", userIds);
        const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => {
          r.profiles = map.get(r.user_id) ?? null;
        });
      }
      return rows as Row[];
    },
  });

  const ownerByEventId = useMemo(() => {
    const map = new Map<string, OwnerInfo>();
    for (const ev of events as any[]) {
      const org = ev?.organizer_id ? organizerMap.get(ev.organizer_id) : null;
      const corp = !ev?.organizer_id || isMainOrg((org as any)?.name);
      map.set(ev.id, {
        corp,
        name: corp
          ? (org as any)?.name || "Corporação Assessoria Esportiva"
          : (org as any)?.name || "Organizador",
        organizerId: ev.organizer_id ?? null,
      });
    }
    return map;
  }, [events, organizerMap]);

  const scopedSignups = useMemo(() => {
    if (isAdmin) return allSignups;
    const allowed = new Set(eventIds);
    return allSignups.filter((s) => allowed.has(s.event_id));
  }, [allSignups, isAdmin, eventIds]);

  /** Escopo sem filtro de status (para KPIs de status). */
  const scopeWithoutStatus = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return scopedSignups.filter((r) => {
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (isAdmin) {
        const own = ownerByEventId.get(r.event_id);
        if (ownership === "corp" && !own?.corp) return false;
        if (ownership === "external" && own?.corp) return false;
        if (orgFilter === "corp" && !own?.corp) return false;
        if (orgFilter !== "all" && orgFilter !== "corp" && own?.organizerId !== orgFilter) {
          return false;
        }
      }
      if (q) {
        const hay =
          `${r.participant_full_name || ""} ${r.profiles?.full_name || ""} ${r.profiles?.email || ""} ${r.participant_cpf || ""} ${r.profiles?.cpf || ""} ${r.events?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    scopedSignups,
    deferredSearch,
    eventFilter,
    isAdmin,
    ownership,
    orgFilter,
    ownerByEventId,
  ]);

  const statusCounts = useMemo(
    () => countSignupDbStatuses(scopeWithoutStatus),
    [scopeWithoutStatus],
  );

  const baseFiltered = useMemo(
    () =>
      scopeWithoutStatus.filter((r) => matchesSignupStatusFilter(r, statusFilter)),
    [scopeWithoutStatus, statusFilter],
  );

  const genderCounts = useMemo(() => {
    return baseFiltered.reduce(
      (acc, r) => {
        const g = rowGender(r);
        if (g === "F") acc.F += 1;
        else if (g === "M") acc.M += 1;
        if (isKidsCategory(r.category)) acc.kids += 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, F: 0, M: 0, kids: 0 },
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
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
    );
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    if (genderFilter === "all") return baseFiltered;
    if (genderFilter === "kids") {
      return baseFiltered.filter((r) => isKidsCategory(r.category));
    }
    return baseFiltered.filter((r) => rowGender(r) === genderFilter);
  }, [baseFiltered, genderFilter]);

  // Reset página ao mudar filtros (evita página vazia)
  useEffect(() => {
    setPage(0);
  }, [
    statusFilter,
    eventFilter,
    genderFilter,
    ownership,
    orgFilter,
    deferredSearch,
    pageSize,
  ]);

  const pageCount =
    pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    if (pageSize === 0) return filtered;
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const patchSignupStatus = useCallback(
    (id: string, status: string) => {
      qc.setQueryData<Row[]>(signupsQueryKey, (prev) => {
        if (!prev) return prev;
        return prev.map((r) => (r.id === id ? { ...r, status } : r));
      });
      setDetail((d) => (d && d.id === id ? { ...d, status } : d));
    },
    [qc, signupsQueryKey],
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      const previous = allSignups.find((r) => r.id === id)?.status;
      patchSignupStatus(id, status);

      let query = supabase
        .from("event_signups")
        .update({ status })
        .eq("id", id)
        .select("id");
      if (!isAdmin) {
        if (!eventIds.length) {
          if (previous) patchSignupStatus(id, previous);
          toast.error("Inscrição não pertence às suas provas.");
          return;
        }
        query = query.in("event_id", eventIds);
      }
      const { data, error } = await query.maybeSingle();
      if (error) {
        if (previous) patchSignupStatus(id, previous);
        toast.error(error.message);
        return;
      }
      if (!data) {
        if (previous) patchSignupStatus(id, previous);
        toast.error("Inscrição não pertence às suas provas.");
        return;
      }
      toast.success("Status atualizado");

      if (status === "confirmada") {
        const { error: fnError } = await supabase.functions.invoke(
          "send-confirmation-email",
          { body: { signup_id: id } },
        );
        if (fnError) toast.error("Status salvo, mas erro ao enviar email.");
        else toast.success("Email de confirmação enviado ao atleta!");
      }
    },
    [allSignups, eventIds, isAdmin, patchSignupStatus],
  );

  const openDetail = useCallback((row: Row) => setDetail(row), []);

  const setStatusFilterSafe: Dispatch<SetStateAction<SignupStatusFilter>> = setStatusFilter;

  const exportXlsx = async () => {
    try {
      setExporting(true);
      const eventName =
        eventFilter !== "all"
          ? (events as any[]).find((e) => e.id === eventFilter)?.name
          : undefined;
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
        <div>
          <h1 className="font-display text-2xl font-bold">Inscrições em provas</h1>
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground mt-0.5">Atualizando…</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Atualizar
          </Button>
          <Button onClick={exportXlsx} disabled={exporting}>
            <FileSpreadsheet className="w-4 h-4" />{" "}
            {exporting ? "Gerando..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Input
          placeholder="Buscar atleta, e-mail, CPF, prova..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Prova" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as provas</SelectItem>
            {events.map((e: any) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilterSafe(v as SignupStatusFilter)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="confirmada">Aprovados</SelectItem>
            <SelectItem value="pendente">Em andamento</SelectItem>
            <SelectItem value="pagamento_atrasado">Em atraso</SelectItem>
            <SelectItem value="cancelada">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["confirmada", "Aprovados", statusCounts.confirmada],
            ["pendente", "Em andamento", statusCounts.pendente],
            ["pagamento_atrasado", "Em atraso", statusCounts.pagamento_atrasado],
            ["cancelada", "Cancelados", statusCounts.cancelada],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              setStatusFilterSafe((prev) => (prev === key ? "all" : key))
            }
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              statusFilter === key
                ? "border-brand bg-brand/10"
                : "border-border/60 bg-card/40 hover:border-border",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {count}
            </p>
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "Todas"],
              ["corp", "Corporação"],
              ["external", "Organizadores externos"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setOwnership(k);
                setOrgFilter("all");
              }}
              className={[
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                ownership === k
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground",
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
            <option value="all">
              {ownership === "external"
                ? "Todos os parceiros"
                : "Todos os organizadores"}
            </option>
            {ownership !== "external" && <option value="corp">Corporação</option>}
            {(ownership === "external" ? partnerOrganizers : organizers).map(
              (o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Todos", genderCounts.all],
            ["F", "Feminino", genderCounts.F],
            ["M", "Masculino", genderCounts.M],
            ["kids", "Kids", genderCounts.kids],
          ] as const
        ).map(([value, label, count]) => (
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
          <h2 className="text-sm font-semibold mb-2">
            Camisetas{" "}
            {eventFilter !== "all" ? "(prova filtrada)" : "(todas as provas)"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {shirtCounts.map(([size, count]) => (
              <span
                key={size}
                className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm"
              >
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {filtered.length}{" "}
              {filtered.length === 1 ? "inscrição" : "inscrições"}
              {pageSize !== 0
                ? ` · página ${safePage + 1} de ${pageCount}`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <span>Por página</span>
              <select
                className="border border-input bg-background rounded-md h-8 px-2 text-xs"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n || "all"} value={n}>
                    {n === 0 ? "Todos" : n}
                  </option>
                ))}
              </select>
              {pageSize !== 0 && pageCount > 1 ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={safePage >= pageCount - 1}
                    onClick={() =>
                      setPage((p) => Math.min(pageCount - 1, p + 1))
                    }
                  >
                    Próxima
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Prova</th>
                  <th className="p-3">Atleta</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Data</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <SignupRow
                    key={r.id}
                    row={r}
                    isAdmin={!!isAdmin}
                    owner={ownerByEventId.get(r.event_id) ?? null}
                    onOpen={openDetail}
                    onStatusChange={updateStatus}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminSignupDetailSheet
        signup={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onSaved={(opts) => {
          if (opts?.patch && detail) {
            const patch = opts.patch;
            setDetail({ ...detail, ...patch });
            if (patch.status) {
              patchSignupStatus(detail.id, patch.status);
            } else {
              qc.setQueryData<Row[]>(signupsQueryKey, (prev) => {
                if (!prev) return prev;
                return prev.map((r) =>
                  r.id === detail.id ? { ...r, ...patch } : r,
                );
              });
            }
          }
          if (opts?.closeSheet) setDetail(null);
        }}
      />
    </div>
  );
};

export default AdminEventSignups;
