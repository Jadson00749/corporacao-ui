import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { notifyWelcomeClosed, WELCOME_FLAG } from "@/lib/firstAccess";
import fundadores from "@/assets/fundadores.jpg";

type Props = {
  firstName?: string;
};

/**
 * Modal de boas-vindas após o primeiro cadastro.
 * Prioridade: completar cadastro → este modal → tour da conta → coachmark.
 * Mantém a flag até fechar para não empilhar overlays.
 */
export const WelcomeDialog = ({ firstName }: Props) => {
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WELCOME_FLAG) === "1") {
        setOpen(true);
      }
    } catch {}
  }, []);

  const close = () => {
    setOpen(false);
    notifyWelcomeClosed();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else setOpen(true);
      }}
    >
      <DialogContent className="flex max-w-lg flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative aspect-[16/10] max-h-[32vh] w-full overflow-hidden bg-muted sm:aspect-[4/3] sm:max-h-[240px]">
            <img
              src={settings.images?.welcome || fundadores}
              alt="Lucas e Heloiza Teixeira, fundadores da Corporação Assessoria Esportiva"
              className="h-full w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
          </div>

          <div className="space-y-3 px-5 pb-4 pt-3 sm:space-y-4 sm:px-6 sm:pb-5 sm:pt-2">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand sm:text-xs">
                Bem-vindo à família
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-tight sm:text-2xl">
                {firstName ? `Que bom ter você aqui, ${firstName}!` : "Que bom ter você aqui!"}
              </h2>
            </div>

            <div className="space-y-2 text-sm leading-relaxed text-foreground/80 sm:space-y-3">
              <p className="sm:hidden">
                Você faz parte de uma comunidade que treina junto e cresce junto. Vamos acompanhar você do
                primeiro passo até a linha de chegada.
              </p>
              <p className="hidden sm:block">
                É um enorme prazer receber você na Corporação Assessoria Esportiva. Aqui você não é mais um
                número: é parte de uma comunidade que treina junto, vibra junto e cresce junto.
              </p>
              <p className="hidden sm:block">
                Nosso compromisso é te acompanhar de perto, do primeiro passo até a linha de chegada que você
                sonha cruzar. Conte com a gente para treinar com propósito, evoluir com segurança e celebrar
                cada conquista.
              </p>
              <p className="font-medium text-foreground">
                Vamos juntos? O ritmo é seu, o caminho é nosso.
              </p>
            </div>

            <div className="border-t border-border pt-2">
              <p className="font-display text-sm font-semibold">Lucas e Heloiza Teixeira</p>
              <p className="text-xs text-muted-foreground">Fundadores, Corporação Assessoria Esportiva</p>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-border bg-background px-5 py-3 sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button variant="brand" className="h-11 w-full touch-manipulation" onClick={close}>
            Vamos lá
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
