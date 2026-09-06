import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_TOUR_KEY,
  isWelcomePending,
  markAccountTourDone,
  WELCOME_CLOSED_EVENT,
} from "@/lib/firstAccess";
import { Trophy, ClipboardList, Package, Flag } from "lucide-react";

const steps = [
  {
    icon: Trophy,
    title: "Encontre suas provas",
    text: "Veja as próximas provas e se inscreva pela plataforma.",
    textDesktop: "Consulte as próximas provas e faça sua inscrição diretamente pela plataforma.",
  },
  {
    icon: ClipboardList,
    title: "Inscrições em um só lugar",
    text: "Acompanhe modalidade, pagamento, kit e status.",
    textDesktop: "Acompanhe modalidade, categoria, pagamento, kit e status das suas inscrições.",
  },
  {
    icon: Package,
    title: "Informações do kit",
    text: "Data, horário e orientações para retirada.",
    textDesktop: "Consulte data, horário e orientações para retirada do seu kit.",
  },
  {
    icon: Flag,
    title: "Pronto para a próxima prova",
    text: "Acompanhe sua jornada com a Corporação.",
    textDesktop: "Acompanhe sua jornada com a Corporação.",
  },
];

export const OnboardingTour = () => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const tryOpen = () => {
      try {
        if (localStorage.getItem(ACCOUNT_TOUR_KEY)) return;
        if (isWelcomePending()) return;
        setOpen(true);
      } catch {}
    };
    tryOpen();
    window.addEventListener(WELCOME_CLOSED_EVENT, tryOpen);
    return () => window.removeEventListener(WELCOME_CLOSED_EVENT, tryOpen);
  }, []);

  const finish = () => {
    markAccountTourDone();
    setOpen(false);
  };

  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="flex max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative bg-gradient-to-br from-brand/15 via-transparent to-transparent px-5 pb-4 pt-7 text-center sm:px-6 sm:pb-6 sm:pt-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/25 sm:mb-5 sm:h-16 sm:w-16">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              {index + 1} de {steps.length}
            </p>
            <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-balance sm:text-2xl">
              {step.title}
            </h2>
            <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-muted-foreground sm:hidden">
              {step.text}
            </p>
            <p className="mx-auto mt-2 hidden max-w-[30ch] text-sm leading-relaxed text-muted-foreground sm:block">
              {step.textDesktop}
            </p>
          </div>

          <div className="flex justify-center gap-1.5 pb-4">
            {steps.map((s, i) => (
              <span
                key={s.title}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-brand" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
        </div>

        <div
          className="shrink-0 space-y-2 border-t border-border/60 bg-background px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 flex-1 touch-manipulation"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Voltar
            </Button>
            {isLast ? (
              <Button asChild variant="brand" className="h-11 min-h-11 flex-1 touch-manipulation">
                <Link to="/provas" onClick={finish}>
                  Explorar provas
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="brand"
                className="h-11 min-h-11 flex-1 touch-manipulation"
                onClick={() => setIndex((i) => i + 1)}
              >
                Próximo
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={finish}
            className="mx-auto block min-h-10 w-full py-2 text-center text-xs text-muted-foreground touch-manipulation hover:text-foreground"
          >
            Pular
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
