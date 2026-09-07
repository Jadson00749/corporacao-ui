import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { athleteName } from "@/lib/exportSignupsXlsx";
import type { ExportSignup } from "@/lib/exportSignupsXlsx";
import { brl, formatSignupWhen, statusLabel } from "./dashboardUtils";

export type RecentSignupRow = {
  signup: ExportSignup;
  value: number | null;
};

type Props = {
  rows: RecentSignupRow[];
  className?: string;
};

export function DashboardRecentSignups({ rows, className }: Props) {
  return (
    <section className={cn("flex h-full flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Últimas inscrições
        </h2>
        <Link
          to="/admin/event-signups"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-brand"
        >
          Ver todas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-5 text-sm text-muted-foreground">Nenhuma inscrição recente em provas ativas.</div>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.map(({ signup: s, value }) => {
            const name = athleteName(s) || "Participante";
            const status = (s.status || "").toLowerCase();
            return (
              <li key={s.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold leading-snug">{name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {s.events?.name || "Prova"}
                      {s.category ? ` · ${s.category}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-semibold tabular-nums">
                      {value != null ? brl(value) : "—"}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        status === "confirmada" && "text-brand",
                        status === "cancelada" && "text-muted-foreground",
                        status !== "confirmada" && status !== "cancelada" && "text-warning"
                      )}
                    >
                      {statusLabel(s.status)}
                    </div>
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80">{formatSignupWhen(s.created_at)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
