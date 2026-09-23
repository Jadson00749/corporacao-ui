import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, Clock, Handshake, TrendingUp, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl } from "./dashboardUtils";

export type PartnerCommissionRow = {
  organizerId: string;
  name: string;
  approvedValue: number;
  commissionPct: number;
  commission: number;
};

/** Números do parceiro selecionado (Visão do Parceiro). */
export type PartnerFinancialView = {
  approvedValue: number;
  commissionPct: number;
  commission: number;
  confirmed: number;
  pendingRevenue: number;
  pending: number;
};

export type FinancialMetrics = {
  /** Totais mistos — usados no modo organizador (não-admin). */
  revenue: number;
  confirmed: number;
  pendingRevenue: number;
  pending: number;
  ticket: number;
  estimatedCommission: number;
  /** Corporação (somente provas próprias / org principal). */
  revenueCorporate?: number;
  pendingRevenueCorporate?: number;
  confirmedCorporate?: number;
  ticketCorporate?: number;
  /** Parceiros. */
  revenueOrganizers?: number;
  pendingRevenueOrganizers?: number;
  confirmedPartners?: number;
  partnerEventsWithMovement?: number;
  partners?: PartnerCommissionRow[];
  /** Quebra sem duplicar signup_bundle. */
  revenueRegistration?: number;
  revenueProducts?: number;
  pendingSignupCount?: number;
  pendingStandaloneCount?: number;
  productsSoldQty?: number;
};

type Props = {
  metrics: FinancialMetrics;
  /** Super admin vê blocos Corp / Parceiros separados. */
  isAdmin: boolean;
  /** Quando presente, exibe somente o bloco azul do parceiro selecionado. */
  partnerView?: PartnerFinancialView;
  /** Atalho da faixa compacta de parceiros (foca o seletor do topo). */
  onOpenPartners?: () => void;
  className?: string;
};

type Tone = "brand" | "blue" | "muted" | "default";

const Card = ({
  icon: Icon,
  label,
  value,
  hint,
  hint2,
  tone = "default",
  to,
  className: classNameProp,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  hint2?: string;
  tone?: Tone;
  to?: string;
  className?: string;
}) => {
  const className = cn(
    "flex h-full flex-col rounded-xl border p-2.5 text-left transition-colors sm:p-3",
    tone === "brand" && "border-brand/40 bg-brand/10",
    tone === "blue" && "border-blue-500/30 bg-blue-500/10",
    tone === "muted" && "border-border/60 bg-card/60",
    tone === "default" && "border-border bg-card",
    to &&
      "cursor-pointer hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
    classNameProp
  );
  const body = (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide",
          tone === "muted" ? "text-muted-foreground/70" : "text-muted-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tone === "brand" && "text-brand",
            tone === "blue" && "text-blue-600 dark:text-blue-400",
            tone === "muted" && "opacity-60"
          )}
        />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-bold leading-none tabular-nums sm:text-[1.35rem]",
          tone === "brand" && "text-brand",
          tone === "blue" && "text-blue-600 dark:text-blue-400",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-[11px] leading-snug",
            tone === "muted" ? "text-muted-foreground/60" : "text-muted-foreground"
          )}
        >
          {hint}
        </div>
      )}
      {hint2 && <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground/70">{hint2}</div>}
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

function SectionTitle({
  tone,
  children,
}: {
  tone: "brand" | "blue";
  children: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "brand" ? "bg-brand" : "bg-blue-500"
        )}
        aria-hidden
      />
      <h2
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wider",
          tone === "brand" ? "text-brand" : "text-blue-600 dark:text-blue-400"
        )}
      >
        {children}
      </h2>
    </div>
  );
}

export function DashboardFinancialStats({ metrics, isAdmin, partnerView, onOpenPartners, className }: Props) {
  if (isAdmin && partnerView) {
    return (
      <section className={className}>
        <SectionTitle tone="blue">Financeiro — Parceiro</SectionTitle>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card
            icon={Wallet}
            label="Valor aprovado"
            value={brl(partnerView.approvedValue)}
            hint="Inscrições confirmadas das provas do parceiro"
          />
          <Card
            icon={Handshake}
            label="Comissão da Corporação"
            value={brl(partnerView.commission)}
            hint={
              partnerView.commissionPct > 0
                ? `Comissão contratada: ${partnerView.commissionPct}%`
                : "Comissão não definida"
            }
            tone={partnerView.commission > 0 ? "blue" : "muted"}
            to="/admin/organizers"
          />
          <Card
            icon={Users}
            label="Inscrições confirmadas"
            value={String(partnerView.confirmed)}
            hint="Somente provas deste parceiro"
            to="/admin/event-signups?status=confirmada"
          />
          <Card
            icon={Clock}
            label="A receber"
            value={brl(partnerView.pendingRevenue)}
            hint={`${partnerView.pending} pendentes`}
            to="/admin/event-signups?tab=pagamentos&status=pendente"
          />
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    const reg = metrics.revenueRegistration ?? 0;
    const prod = metrics.revenueProducts ?? 0;
    const pendingSignups = metrics.pendingSignupCount ?? metrics.pending;
    const pendingBuys = metrics.pendingStandaloneCount ?? 0;
    const soldQty = metrics.productsSoldQty ?? 0;
    return (
      <section className={className}>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Financeiro
        </h2>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          <Card
            icon={Wallet}
            label="Receita confirmada"
            value={brl(metrics.revenue)}
            hint={`Inscrições ${brl(reg)} · Produtos ${brl(prod)}`}
            tone={metrics.revenue > 0 ? "brand" : "default"}
            to="/admin/event-signups?tab=pagamentos&status=confirmada"
          />
          <Card
            icon={Clock}
            label="A receber"
            value={brl(metrics.pendingRevenue)}
            hint={`${pendingSignups} ${pendingSignups === 1 ? "inscrição" : "inscrições"}${
              pendingBuys > 0
                ? ` · ${pendingBuys} ${pendingBuys === 1 ? "compra" : "compras"}`
                : ""
            }`}
            to="/admin/event-signups?tab=pagamentos&status=pendente"
          />
          <Card
            icon={TrendingUp}
            label="Produtos vendidos"
            value={brl(prod)}
            hint={`${soldQty} ${soldQty === 1 ? "item" : "itens"}`}
            className="col-span-2 xl:col-span-1"
            to="/admin/store-orders"
          />
        </div>
      </section>
    );
  }
  const corpRevenue = metrics.revenueCorporate ?? 0;
  const corpPending = metrics.pendingRevenueCorporate ?? 0;
  const corpConfirmed = metrics.confirmedCorporate ?? 0;
  const corpTicket = metrics.ticketCorporate ?? 0;
  const partnerRevenue = metrics.revenueOrganizers ?? 0;
  const partnerConfirmed = metrics.confirmedPartners ?? 0;
  const partnerEvents = metrics.partnerEventsWithMovement ?? 0;
  const commission = metrics.estimatedCommission;

  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <SectionTitle tone="brand">Financeiro — Corporação</SectionTitle>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card
            icon={Wallet}
            label="Receita confirmada"
            value={brl(corpRevenue)}
            hint="Somente provas da Corporação"
            tone={corpRevenue > 0 ? "brand" : "default"}
            to="/admin/event-signups?tab=pagamentos&status=confirmada"
          />
          <Card
            icon={Clock}
            label="A receber"
            value={brl(corpPending)}
            hint="Pendentes das provas próprias"
            to="/admin/event-signups?tab=pagamentos&status=pendente"
          />
          <Card
            icon={TrendingUp}
            label="Ticket médio"
            value={brl(corpTicket)}
            hint="Por inscrição confirmada (Corp.)"
          />
          <Card
            icon={Users}
            label="Inscrições confirmadas"
            value={String(corpConfirmed)}
            hint="Provas da Corporação"
            to="/admin/event-signups?status=confirmada"
          />
        </div>
      </div>

      <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Parceiros
              </span>
            </div>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 sm:text-[1.35rem]">
              {brl(commission)}
              <span className="ml-1.5 align-middle text-[11px] font-medium text-muted-foreground">
                comissão acumulada
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {brl(partnerRevenue)} aprovados em provas parceiras · {partnerConfirmed} inscrições confirmadas ·{" "}
              {partnerEvents} {partnerEvents === 1 ? "prova" : "provas"} com movimento
            </p>
          </div>
          {onOpenPartners ? (
            <button
              type="button"
              onClick={onOpenPartners}
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-blue-500/40 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400 sm:self-center"
            >
              Ver parceiros <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              to="/admin/organizers"
              className="inline-flex shrink-0 items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 sm:self-center"
            >
              Ver parceiros <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
