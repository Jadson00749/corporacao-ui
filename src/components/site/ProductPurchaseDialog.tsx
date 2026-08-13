import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import type { Product } from "@/data/products";

type Props = {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const ProductPurchaseDialog = ({ product, open, onOpenChange }: Props) => {
  const { productPayment } = useSettings();
  const buildWhats = useWhatsappLink();

  if (!product) return null;

  const copyPix = () => {
    if (!productPayment.pixKey) return;
    navigator.clipboard.writeText(productPayment.pixKey);
    toast.success("Chave PIX copiada!");
  };

  const whatsMessage =
    `Olá! Quero comprar o produto: ${product.name}` +
    (product.price ? ` (${product.price})` : "") +
    `. Vou enviar o comprovante do PIX e combinar a entrega/retirada.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{product.name}</DialogTitle>
          <DialogDescription>
            Pague via PIX e envie o comprovante no WhatsApp para combinar entrega ou retirada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {product.price && (
            <div className="bg-secondary/40 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="font-display text-xl font-bold text-brand">{product.price}</span>
            </div>
          )}

          {(productPayment.pixKey || productPayment.pixRecipient || productPayment.instructions) ? (
            <div className="border border-brand/40 bg-brand/5 rounded-xl p-4 space-y-3">
              <h3 className="font-display font-bold text-brand">Pagamento via PIX</h3>
              {productPayment.pixRecipient && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Recebedor: </span>
                  <span className="font-medium">{productPayment.pixRecipient}</span>
                </div>
              )}
              {productPayment.pixKey && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Chave PIX</div>
                  <div className="flex gap-2">
                    <Input readOnly value={productPayment.pixKey} className="font-mono text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={copyPix} aria-label="Copiar chave PIX">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {productPayment.instructions && (
                <p className="text-sm whitespace-pre-line text-foreground/80">{productPayment.instructions}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Toque em "Falar no WhatsApp" para combinar pagamento e entrega com o time.
            </p>
          )}

          <Button asChild variant="brand" size="lg" className="w-full">
            <a href={buildWhats(whatsMessage)} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4" /> Enviar comprovante no WhatsApp
            </a>
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            A entrega ou retirada da camiseta é combinada direto com o time pelo WhatsApp.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
