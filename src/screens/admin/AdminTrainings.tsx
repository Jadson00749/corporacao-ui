import { useCallback, useState } from "react";
import ExcelJS from "exceljs";
import { Download, Users } from "lucide-react";
import { CrudTable } from "@/components/admin/CrudTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { slugify } from "@/lib/exportSignupsXlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TrainingSignupRow = {
  id: string;
  full_name: string;
  whatsapp: string;
  email: string;
  created_at: string;
};

type ViewingTraining = {
  id: string;
  title: string;
  date: string;
  time: string;
};

const formatListDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const downloadConfirmationsXlsx = async (
  training: ViewingTraining,
  rows: TrainingSignupRow[],
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Corporação";
  const ws = wb.addWorksheet("Confirmações");

  ws.columns = [
    { header: "Nome", key: "nome", width: 28 },
    { header: "WhatsApp", key: "whatsapp", width: 18 },
    { header: "E-mail", key: "email", width: 32 },
    { header: "Treino", key: "treino", width: 36 },
    { header: "Data da confirmação", key: "confirmado_em", width: 22 },
  ];

  for (const r of rows) {
    ws.addRow({
      nome: r.full_name || "",
      whatsapp: r.whatsapp || "",
      email: r.email || "",
      treino: training.title || "",
      confirmado_em: formatDateTime(r.created_at),
    });
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;

  // WhatsApp como texto (evita Excel tratar como número)
  ws.getColumn("whatsapp").numFmt = "@";

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: "A1",
    to: { row: 1, column: ws.columnCount },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `confirmacoes-${slugify(training.title || "treino")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

const TRAINING_FIELDS = [
  { key: "title", label: "Título" },
  { key: "date", label: "Data", type: "date" as const },
  { key: "time", label: "Hora (ex: 06:30)" },
  { key: "location", label: "Local" },
  { key: "map_url", label: "Link do mapa (Google Maps)" },
  { key: "description", label: "Descrição", type: "textarea" as const },
  {
    key: "image",
    label: "Banner do treino (foto vertical, padrão 9:16, ex: 1080 × 1920)",
    type: "image" as const,
  },
  { key: "level", label: "Nível (Iniciante / Intermediário / Avançado / Todos os níveis)" },
  {
    key: "capacity",
    label: "Limite de vagas (deixe vazio = ilimitado)",
    type: "number" as const,
  },
  { key: "active", label: "Ativo (aparece no site)", type: "boolean" as const },
  { key: "sort_order", label: "Ordem", type: "number" as const },
];

const AdminTrainings = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viewing, setViewing] = useState<ViewingTraining | null>(null);
  const [signups, setSignups] = useState<TrainingSignupRow[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);

  const refreshCounts = useCallback(async (rows: any[]) => {
    if (!rows.length) {
      setCounts({});
      return;
    }
    const ids = rows.map((r) => r.id as string);
    const { data, error } = await supabase
      .from("training_signups")
      .select("training_id")
      .in("training_id", ids);
    if (error) {
      // Fallback: RPC por treino (se SELECT agregado falhar por RLS)
      const next: Record<string, number> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data: n, error: rpcErr } = await supabase.rpc("count_training_signups", {
            _training_id: id,
          });
          if (!rpcErr) next[id] = Number(n ?? 0);
        }),
      );
      setCounts(next);
      return;
    }
    const next: Record<string, number> = {};
    for (const id of ids) next[id] = 0;
    for (const row of data ?? []) {
      const tid = (row as { training_id: string }).training_id;
      next[tid] = (next[tid] ?? 0) + 1;
    }
    setCounts(next);
  }, []);

  const openConfirmations = async (row: any) => {
    const training: ViewingTraining = {
      id: row.id,
      title: row.title,
      date: row.date,
      time: row.time,
    };
    setViewing(training);
    setLoadingSignups(true);
    setSignups([]);
    const { data, error } = await supabase
      .from("training_signups")
      .select("id, full_name, whatsapp, email, created_at")
      .eq("training_id", row.id)
      .order("created_at", { ascending: false });
    setLoadingSignups(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSignups((data ?? []) as TrainingSignupRow[]);
    setCounts((prev) => ({ ...prev, [row.id]: (data ?? []).length }));
  };

  return (
    <>
      <CrudTable
        table="trainings"
        queryKey="trainings"
        title="Treinos"
        displayKey="title"
        orderBy={{ column: "date" }}
        inlineToggleKey="active"
        inlineToggleLabel="Ativo"
        fields={TRAINING_FIELDS}
        draftKeyPrefix="admin:training-draft"
        onRowsLoaded={refreshCounts}
        renderSubtitle={(r) => {
          const n = counts[r.id] ?? 0;
          const when = [formatListDate(r.date), r.time].filter(Boolean).join(" · ");
          return (
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              {when && <div>{when}</div>}
              <div className="font-medium text-foreground/80">
                {n} {n === 1 ? "confirmação" : "confirmações"}
              </div>
            </div>
          );
        }}
        extraActions={(r) => (
          <Button onClick={() => void openConfirmations(r)} variant="outline" size="sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Ver confirmações</span>
          </Button>
        )}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl pr-6">
              {viewing?.title ?? "Confirmações"}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {loadingSignups
                    ? "Carregando…"
                    : `${signups.length} ${signups.length === 1 ? "pessoa confirmada" : "pessoas confirmadas"}`}
                  {!loadingSignups && viewing.date && (
                    <span>
                      {" "}
                      · {formatListDate(viewing.date)}
                      {viewing.time ? ` · ${viewing.time}` : ""}
                    </span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingSignups || signups.length === 0}
                  onClick={() => {
                    void downloadConfirmationsXlsx(viewing, signups).catch(() =>
                      toast.error("Não foi possível gerar o Excel."),
                    );
                  }}
                >
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </Button>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {loadingSignups && (
                  <div className="p-4 text-sm text-muted-foreground">Carregando confirmações…</div>
                )}
                {!loadingSignups && signups.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    Nenhuma confirmação neste treino ainda.
                  </div>
                )}
                {signups.map((s) => (
                  <div key={s.id} className="p-4 space-y-1">
                    <div className="font-medium text-foreground">{s.full_name}</div>
                    <div className="text-sm text-muted-foreground break-all">{s.whatsapp}</div>
                    <div className="text-sm text-muted-foreground break-all">{s.email}</div>
                    <div className="text-xs text-muted-foreground/80 pt-1">
                      {formatDateTime(s.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminTrainings;
