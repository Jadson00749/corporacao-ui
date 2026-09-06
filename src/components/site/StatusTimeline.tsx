import { cn } from "@/lib/utils";

export type TimelineStep = {
  id: string;
  label: string;
};

type Props = {
  steps: TimelineStep[];
  /** Índice da etapa atual (0-based). Etapas anteriores = concluídas. */
  currentIndex: number;
  /** Se true, a etapa atual é estado terminal negativo (ex.: cancelada). */
  failed?: boolean;
  className?: string;
};

/**
 * Linha do tempo de status. Mobile: vertical. Desktop: horizontal.
 * Usa apenas etapas reais passadas pelo caller — sem status inventados.
 */
export function StatusTimeline({ steps, currentIndex, failed = false, className }: Props) {
  if (steps.length < 2) return null;
  const idx = Math.max(0, Math.min(currentIndex, steps.length - 1));

  return (
    <ol
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-0",
        className
      )}
      aria-label="Status"
    >
      {steps.map((step, i) => {
        const done = !failed && i < idx;
        const current = i === idx;
        const upcoming = i > idx;

        return (
          <li
            key={step.id}
            className={cn(
              "flex items-start gap-2 sm:min-w-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5",
              i < steps.length - 1 && "sm:relative"
            )}
          >
            <div className="flex items-center gap-2 sm:flex-col sm:gap-1.5 w-full sm:w-auto">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  done && "border-success/50 bg-success/15 text-success",
                  current && !failed && "border-brand/50 bg-brand/15 text-brand",
                  current && failed && "border-destructive/50 bg-destructive/10 text-destructive",
                  upcoming && "border-border bg-muted text-muted-foreground"
                )}
                aria-current={current ? "step" : undefined}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs leading-snug sm:text-center",
                  current ? "font-semibold text-foreground" : "text-muted-foreground",
                  failed && current && "text-destructive"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "ml-3 hidden h-px flex-1 self-center sm:ml-0 sm:mt-0 sm:block sm:absolute sm:left-[calc(50%+14px)] sm:right-[calc(-50%+14px)] sm:top-3 sm:h-px sm:w-auto",
                  done ? "bg-success/40" : "bg-border"
                )}
              />
            )}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "ml-3 block h-4 w-px shrink-0 sm:hidden",
                  done ? "bg-success/40" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Timeline de inscrição com status reais do produto. */
export const SIGNUP_TIMELINE_STEPS: TimelineStep[] = [
  { id: "created", label: "Inscrição criada" },
  { id: "pending", label: "Aguardando pagamento" },
  { id: "confirmed", label: "Confirmada" },
];

export function signupTimelineIndex(status?: string | null): { index: number; failed: boolean } {
  const s = (status || "").toLowerCase();
  if (s === "cancelada") return { index: 1, failed: true };
  if (s === "confirmada") return { index: 2, failed: false };
  return { index: 1, failed: false }; // pendente / em andamento
}

/** Etapas de locação (sem rascunho/cancelado na linha principal). */
export const RENTAL_TIMELINE_STEPS: TimelineStep[] = [
  { id: "requested", label: "Solicitada" },
  { id: "under_review", label: "Em análise" },
  { id: "approved", label: "Aprovada" },
  { id: "contracted", label: "Contratada" },
  { id: "delivered", label: "Entregue" },
  { id: "returned", label: "Devolvida" },
  { id: "completed", label: "Concluída" },
];

export function rentalTimelineIndex(status?: string | null): { index: number; failed: boolean } {
  const s = (status || "").trim();
  if (s === "cancelled" || s === "draft") return { index: 0, failed: s === "cancelled" };
  const i = RENTAL_TIMELINE_STEPS.findIndex((x) => x.id === s);
  return { index: i >= 0 ? i : 0, failed: false };
}
