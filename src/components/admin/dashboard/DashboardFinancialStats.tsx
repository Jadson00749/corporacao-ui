import { Link } from "@/lib/router-compat";
import { Clock, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "./dashboardUtils";

export type FinancialMetrics = {
  revenue: number;
  confirmed: number;
  pendingRevenue: number;
  pending: number;
  ticket: number;
  estimatedCommission: number;
  revenueCorporate?: number;
  revenueOrganizers?: number;
  pendingRevenueCorporate?: number;
  pendingRevenueOrganizers?: number;
};

type Props = {
  metrics: FinancialMetrics;
  /** Super admin vê breakdown Corp/Org e comissão. */
  isAdmin: boolean;
  className?: string;
};

const Card = ({
  icon: Icon,
  label,
  value,
  hint,
  hint2,
  accent,
  muted,
  to,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  hint2?: string;
  /** Destaque verde — só para receita confirmada com valor. */
  accent?: boolean;
  /** Estilo neutro (ex.: comissão R$ 0). */
  muted?: boolean;
  to?: string;
}) => {
  const className = cn(
    "flex h-full flex-col rounded-xl border p-2.5 text-left transition-colors sm:p-3",
    accent && !muted && "border-brand/40 bg-brand/10",
    muted && "border-border/60 bg-card/60",
    !accent && !muted && "border-border bg-card",
    to && "cursor-pointer hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
  );
  const body = (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide",
          muted ? "text-muted-foreground/70" : "text-muted-foreground"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accent && !muted && "text-brand", muted && "opacity-60")} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-bold leading-none tabular-nums sm:text-[1.35rem]",
          accent && !muted && "text-brand",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-[11px] leading-snug",
            muted ? "text-muted-foreground/60" : "text-muted-foreground"
          )}
        >
          {hint}
        </div>
      )}
      {hint2 && (
        <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground/70">{hint2}</div>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
};

export function DashboardFinancialStats({ metrics, isAdmin, className }: Props) {
  const revenueAccent = metrics.revenue > 0;
  const commissionMuted = metrics.estimatedCommission <= 0;

  return (
    <section className={className}>
      <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        Financeiro
      </h2>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Card
          icon={Wallet}
          label="Receita confirmada"
          value={brl(metrics.revenue)}
          hint={`${metrics.confirmed} inscrições pagas`}
          hint2={
            isAdmin
              ? `Corp. ${brl(metrics.revenueCorporate ?? 0)} · Org. ${brl(metrics.revenueOrganizers ?? 0)}`
              : undefined
          }
          accent={revenueAccent}
          to="/admin/event-signups?status=confirmada"
        />
        <Card
          icon={Clock}
          label="Receita em aberto"
          value={brl(metrics.pendingRevenue)}
          hint={`${metrics.pending} pendentes`}
          hint2={
            isAdmin
              ? `Corp. ${brl(metrics.pendingRevenueCorporate ?? 0)} · Org. ${brl(metrics.pendingRevenueOrganizers ?? 0)}`
              : undefined
          }
          to="/admin/event-signups?status=pendente"
        />
        <Card icon={TrendingUp} label="Ticket médio" value={brl(metrics.ticket)} hint="Por inscrição confirmada" />
        {isAdmin ? (
          <Card
            icon={Wallet}
            label="Comissão estimada"
            value={brl(metrics.estimatedCommission)}
            hint="Sobre confirmadas de parceiros"
            muted={commissionMuted}
            to="/admin/organizers"
          />
        ) : (
          <Card
            icon={Wallet}
            label="Inscrições vendidas"
            value={String(metrics.confirmed)}
            hint={`${metrics.pending} pendentes`}
            to="/admin/event-signups?status=confirmada"
          />
        )}
      </div>
    </section>
  );
}
