import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Trophy,
  FileSpreadsheet,
  Tent,
  Wallet,
  Rocket,
} from "lucide-react";

/**
 * Tour do organizador em modal (não aponta para itens do menu desktop/sidebar),
 * para funcionar igual no drawer mobile.
 */
const steps = [
  {
    icon: LayoutDashboard,
    title: "Painel do organizador",
    text: "Na Visão geral você acompanha inscrições e desempenho das suas provas.",
    textDesktop:
      "Na Visão geral você acompanha em tempo real as inscrições, o faturamento e o desempenho das suas provas.",
  },
  {
    icon: Trophy,
    title: "Minhas provas",
    text: "Crie e edite eventos: datas, lotes, banner e regras.",
    textDesktop:
      "Em Minhas provas você cria e edita seus eventos: datas, valores por lote, banner e regras de inscrição.",
  },
  {
    icon: FileSpreadsheet,
    title: "Inscrições provas",
    text: "Confira pagamentos, confirme inscritos e exporte em Excel.",
    textDesktop:
      "Em Inscrições provas você confere pagamentos, confirma inscritos e exporta a lista completa em Excel.",
  },
  {
    icon: Tent,
    title: "Locação de Estruturas",
    text: "Monte a estrutura do evento e acompanhe o pedido.",
    textDesktop:
      "Em Locação de Estruturas você monta a estrutura do evento e acompanha o pedido de locação.",
  },
  {
    icon: Wallet,
    title: "Dados de pagamento",
    text: "Configure PIX e contato para receber das suas provas.",
    textDesktop:
      "Em Dados de pagamento configure PIX e o contato usados para receber das suas provas.",
  },
  {
    icon: Rocket,
    title: "Tudo pronto",
    text: "Crie sua primeira prova e acompanhe as inscrições.",
    textDesktop:
      "Crie sua primeira prova e acompanhe as inscrições chegando. Conte com a Corporação no suporte.",
  },
];

export const OrganizerOnboardingTour = ({ storageKey }: { storageKey: string }) => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) return;
      setOpen(true);
    } catch {}
  }, [storageKey]);

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
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
            <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground sm:hidden">
              {step.text}
            </p>
            <p className="mx-auto mt-2 hidden max-w-[32ch] text-sm leading-relaxed text-muted-foreground sm:block">
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
            {index === 0 ? (
              <Button type="button" variant="ghost" className="h-11 min-h-11 flex-1 touch-manipulation" onClick={finish}>
                Pular
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 flex-1 touch-manipulation"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Voltar
              </Button>
            )}
            {isLast ? (
              <Button type="button" variant="brand" className="h-11 min-h-11 flex-1 touch-manipulation" onClick={finish}>
                Concluir
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
          {index > 0 && (
            <button
              type="button"
              onClick={finish}
              className="mx-auto block min-h-10 w-full py-2 text-center text-xs text-muted-foreground touch-manipulation hover:text-foreground"
            >
              Pular
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
