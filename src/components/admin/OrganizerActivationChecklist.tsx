import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isOrganizerPaymentReady, type OrganizerPayment } from "@/lib/eventPayment";

type EventLike = { id: string; distances?: unknown };

type Props = {
  organizerId: string;
  payment?: OrganizerPayment | null;
  events: EventLike[];
  signupCount: number;
};

/**
 * Checklist de ativação do organizador — progresso inferido de dados reais.
 * Quando concluído, estado discreto com opção de ocultar (localStorage).
 */
export function OrganizerActivationChecklist({
  organizerId,
  payment,
  events,
  signupCount,
}: Props) {
  const storageKey = `organizer_checklist_hidden_v1_${organizerId}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const steps = useMemo(() => {
    const orgDone = !!(
      payment?.name?.trim() &&
      (payment.payment_contact_name?.trim() ||
        payment.payment_email?.trim() ||
        // Sem colunas de contato (migration antiga): nome da org basta.
        (!payment.payment_contact_name && !payment.payment_email && payment.name.trim()))
    );
    const payDone = isOrganizerPaymentReady(payment);
    const firstEvent = events.length > 0;
    const eventConfigured = events.some((e) => Array.isArray(e.distances) && e.distances.length > 0);
    const firstSignup = signupCount > 0;

    return [
      {
        id: "org",
        label: "Complete os dados da organização",
        done: orgDone,
        to: "/admin/payment-settings",
      },
      {
        id: "pay",
        label: "Configure seus dados de pagamento",
        done: payDone,
        to: "/admin/payment-settings",
      },
      {
        id: "event",
        label: "Crie sua primeira prova",
        done: firstEvent,
        to: "/admin/events",
      },
      {
        id: "config",
        label: "Configure inscrições da prova",
        done: eventConfigured,
        to: "/admin/events",
      },
      {
        id: "signup",
        label: "Receba sua primeira inscrição",
        done: firstSignup,
        to: "/admin/event-signups",
      },
    ];
  }, [payment, events, signupCount]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const hide = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setHidden(true);
  };

  if (hidden && allDone) return null;

  if (allDone) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-sm font-medium">Ativação concluída — sua organização está pronta.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={hide}>
          Ocultar
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold sm:text-lg">Comece por aqui</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {doneCount} de {steps.length} concluídos
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-brand">{pct}%</span>
      </div>
      <Progress value={pct} className="mt-3 h-1.5" />

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors touch-manipulation",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                step.done && "opacity-70"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  step.done ? "text-muted-foreground line-through" : "font-medium"
                )}
              >
                {step.label}
              </span>
              {!step.done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
