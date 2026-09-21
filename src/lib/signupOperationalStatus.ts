/**
 * Labels / badges de status de inscrição (valores REAIS do banco).
 * A regra de 48h vive no banco (mark_overdue_event_signups + pg_cron).
 */

export type SignupDbStatus =
  | "pendente"
  | "pagamento_atrasado"
  | "confirmada"
  | "cancelada"
  | string;

export type SignupStatusInfo = {
  dbStatus: string;
  label: string;
  badgeClassName: string;
  overdue: boolean;
  overdueHint: string | null;
};

const LABELS: Record<string, string> = {
  confirmada: "Aprovado",
  pendente: "Em andamento",
  pagamento_atrasado: "Em atraso",
  cancelada: "Cancelado",
};

const BADGE: Record<string, string> = {
  confirmada:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40",
  pendente:
    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/40",
  pagamento_atrasado:
    "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50",
  cancelada:
    "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40",
};

export function normalizeSignupDbStatus(status?: string | null): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

export function signupStatusLabel(status?: string | null): string {
  const s = normalizeSignupDbStatus(status);
  return LABELS[s] || status || "—";
}

export function signupStatusBadgeClass(status?: string | null): string {
  const s = normalizeSignupDbStatus(status);
  return (
    BADGE[s] ||
    "bg-muted text-muted-foreground border-border"
  );
}

/** @deprecated Use getSignupStatusInfo — nome legado. */
export function getSignupOperationalStatus(signup: {
  status?: string | null;
}): SignupStatusInfo {
  return getSignupStatusInfo(signup);
}

export function getSignupStatusInfo(signup: {
  status?: string | null;
}): SignupStatusInfo {
  const dbStatus = normalizeSignupDbStatus(signup.status);
  const overdue = dbStatus === "pagamento_atrasado";
  return {
    dbStatus,
    label: LABELS[dbStatus] || signup.status || "—",
    badgeClassName: signupStatusBadgeClass(dbStatus),
    overdue,
    overdueHint: overdue
      ? "Pagamento não confirmado há mais de 48h."
      : null,
  };
}

/** Filtros da lista admin = valores reais do banco (+ all). */
export type SignupStatusFilter =
  | "all"
  | "confirmada"
  | "pendente"
  | "pagamento_atrasado"
  | "cancelada";

/** @deprecated alias */
export type SignupOperationalFilter = SignupStatusFilter;

export function matchesSignupStatusFilter(
  signup: { status?: string | null },
  filter: SignupStatusFilter,
): boolean {
  if (filter === "all") return true;
  return normalizeSignupDbStatus(signup.status) === filter;
}

/** @deprecated alias */
export function matchesSignupOperationalFilter(
  signup: { status?: string | null },
  filter: SignupStatusFilter,
): boolean {
  return matchesSignupStatusFilter(signup, filter);
}

export function countSignupDbStatuses(
  rows: { status?: string | null }[],
): Record<"confirmada" | "pendente" | "pagamento_atrasado" | "cancelada", number> {
  const acc = {
    confirmada: 0,
    pendente: 0,
    pagamento_atrasado: 0,
    cancelada: 0,
  };
  for (const row of rows) {
    const s = normalizeSignupDbStatus(row.status);
    if (s === "confirmada") acc.confirmada += 1;
    else if (s === "pendente") acc.pendente += 1;
    else if (s === "pagamento_atrasado") acc.pagamento_atrasado += 1;
    else if (s === "cancelada") acc.cancelada += 1;
  }
  return acc;
}

/** @deprecated alias */
export function countSignupOperationalStatuses(
  rows: { status?: string | null }[],
) {
  const c = countSignupDbStatuses(rows);
  return {
    aprovado: c.confirmada,
    em_andamento: c.pendente,
    pagamento_atrasado: c.pagamento_atrasado,
    cancelado: c.cancelada,
  };
}

export function parseSignupStatusFilterFromUrl(
  raw: string | null | undefined,
): SignupStatusFilter {
  const v = String(raw ?? "all")
    .trim()
    .toLowerCase();
  if (
    v === "all" ||
    v === "confirmada" ||
    v === "pendente" ||
    v === "pagamento_atrasado" ||
    v === "cancelada"
  ) {
    return v;
  }
  // Legado UI keys
  if (v === "aprovado") return "confirmada";
  if (v === "em_andamento") return "pendente";
  if (v === "cancelado") return "cancelada";
  return "all";
}

/** @deprecated alias */
export function parseSignupOperationalFilterFromUrl(
  raw: string | null | undefined,
): SignupStatusFilter {
  return parseSignupStatusFilterFromUrl(raw);
}

/** @deprecated */
export const PAYMENT_OVERDUE_HOURS = 48;
