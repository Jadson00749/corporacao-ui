import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, ClipboardList, Package, Flag } from "lucide-react";

const STORAGE_KEY = "corp_account_tour_v1";

const steps = [
  {
    icon: Trophy,
    title: "Encontre suas provas",
    text: "Consulte as próximas provas e faça sua inscrição diretamente pela plataforma.",
  },
  {
    icon: ClipboardList,
    title: "Suas inscrições em um só lugar",
    text: "Acompanhe modalidade, categoria, pagamento, kit e status das suas inscrições.",
  },
  {
    icon: Package,
    title: "Informações do seu kit",
    text: "Consulte data, horário e orientações para retirada do seu kit.",
  },
  {
    icon: Flag,
    title: "Tudo pronto para sua próxima prova",
    text: "Acompanhe sua jornada com a Corporação.",
  },
];

export const OnboardingTour = () => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      // não concorre com o dialog de boas-vindas do primeiro cadastro
      if (localStorage.getItem("show_welcome") === "1") return;
      setOpen(true);
    } catch {}
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <div className="relative bg-gradient-to-br from-brand/15 via-transparent to-transparent px-6 pt-8 pb-6 text-center">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/25">
            <Icon className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            {index + 1} de {steps.length}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-balance">{step.title}</h2>
          <p className="mx-auto mt-2 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        </div>

        <div className="flex justify-center gap-1.5 pb-5">
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

        <div className="flex gap-2 border-t border-border/60 p-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Anterior
          </Button>
          {isLast ? (
            <Button asChild variant="brand" className="min-h-11 flex-1">
              <Link to="/provas" onClick={finish}>
                Explorar provas
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="brand" className="min-h-11 flex-1" onClick={() => setIndex((i) => i + 1)}>
              Próximo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
