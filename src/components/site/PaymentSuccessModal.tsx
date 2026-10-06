import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onNavigate: () => void;
  title?: string;
  description?: string;
  buttonLabel?: string;
  whatsappHref?: string;
  whatsappLabel?: string;
};

export function PaymentSuccessModal({
  open,
  onNavigate,
  title = "Pagamento confirmado!",
  description = "Seu pedido foi registrado com sucesso.",
  buttonLabel = "Ver produtos",
  whatsappHref,
  whatsappLabel = "Chamar nosso time no WhatsApp",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md text-center">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 border border-success/30">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="font-display text-xl font-bold">{title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {whatsappHref && (
            <Button className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white" asChild>
              <a href={whatsappHref} target="_blank" rel="noreferrer">{whatsappLabel}</a>
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={onNavigate}>
            {buttonLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
