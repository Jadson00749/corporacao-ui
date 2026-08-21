import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import fundadores from "@/assets/fundadores.jpg";

type Props = {
  firstName?: string;
};

export const WelcomeDialog = ({ firstName }: Props) => {
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("show_welcome") === "1") {
        setOpen(true);
        localStorage.removeItem("show_welcome");
      }
    } catch {}
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-muted">
          <img
            src={settings.images?.welcome || fundadores}
            alt="Lucas e Heloiza Teixeira, fundadores da Corporação Assessoria Esportiva"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent h-24" />
        </div>

        <div className="px-6 pb-6 pt-2 space-y-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-brand font-semibold">Bem-vindo à família</p>
            <h2 className="font-display text-2xl font-bold mt-1">
              {firstName ? `Que bom ter você aqui, ${firstName}!` : "Que bom ter você aqui!"}
            </h2>
          </div>

          <div className="text-sm text-foreground/80 leading-relaxed space-y-3">
            <p>
              É um enorme prazer receber você na Corporação Assessoria Esportiva. Aqui você não é mais um número: é parte de uma comunidade que treina junto, vibra junto e cresce junto.
            </p>
            <p>
              Nosso compromisso é te acompanhar de perto, do primeiro passo até a linha de chegada que você sonha cruzar. Conte com a gente para treinar com propósito, evoluir com segurança e celebrar cada conquista.
            </p>
            <p className="font-medium text-foreground">
              Vamos juntos? O ritmo é seu, o caminho é nosso.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-sm font-display font-semibold">Lucas e Heloiza Teixeira</p>
            <p className="text-xs text-muted-foreground">Fundadores, Corporação Assessoria Esportiva</p>
          </div>

          <Button variant="brand" className="w-full" onClick={() => setOpen(false)}>
            Vamos lá
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
