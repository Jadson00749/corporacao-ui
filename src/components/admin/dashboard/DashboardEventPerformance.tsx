import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brl } from "./dashboardUtils";

export type EventPerformanceRow = {
  eventId: string;
  name: string;
  organizerName?: string;
  isCorp?: boolean;
  confirmed: number;
  pending: number;
  revenue: number;
};

type Props = {
  rows: EventPerformanceRow[];
  showOrganizer?: boolean;
  className?: string;
};

export function DashboardEventPerformance({ rows, showOrganizer = true, className }: Props) {
  return (
    <section className={className}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Desempenho por prova
        </h2>
        <Button asChild variant="ghost" size="sm" className="-mt-1 h-8">
          <Link to="/admin/event-signups">
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhuma inscrição no período selecionado.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((e) => {
            const total = e.confirmed + e.pending;
            const pct = total ? Math.round((e.confirmed / total) * 100) : 0;
            return (
              <div
                key={e.eventId}
                className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-4"
              >
                <div className="min-w-0 lg:w-[28%] lg:shrink-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{e.name}</span>
                    {showOrganizer && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          e.isCorp ? "bg-brand/15 text-brand" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {e.isCorp ? "Corp." : "Org."}
                      </span>
                    )}
                  </div>
                  {showOrganizer && e.organizerName && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{e.organizerName}</div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center sm:gap-4 lg:contents lg:text-left">
                  <div className="lg:w-20 lg:shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inscritos</div>
                    <div className="text-sm font-semibold tabular-nums">{total}</div>
                  </div>
                  <div className="lg:w-24 lg:shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Confirmados</div>
                    <div className="text-sm font-semibold tabular-nums">{e.confirmed}</div>
                  </div>
                  <div className="lg:w-20 lg:shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendentes</div>
                    <div className="text-sm font-semibold tabular-nums">{e.pending}</div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-[5.5rem] shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Receita</div>
                    <div className="text-sm font-semibold tabular-nums">{brl(e.revenue)}</div>
                  </div>
                  <div className="min-w-[4rem] flex-1">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Confirmação</span>
                      <span className="tabular-nums font-semibold text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", e.isCorp !== false ? "bg-brand" : "bg-muted-foreground/50")}
                        style={{ width: `${pct}%` }}
                        title={`${e.confirmed} confirmados de ${total}`}
                      />
                    </div>
                  </div>
                </div>

                <Button asChild variant="ghost" size="sm" className="shrink-0 self-start lg:self-center">
                  <Link to={`/admin/event-signups?event=${e.eventId}`}>
                    Ver inscrições <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
