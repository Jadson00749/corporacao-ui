import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/products";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";

type Props = {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function parsePrice(price?: string): number {
  if (!price) return 0;
  return parseFloat(price.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

export const ProductPurchaseDialog = ({ product, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!product) return null;

  const value = parsePrice(product.price);

  const handleCheckout = () => {
    onOpenChange(false);
    navigate(`/checkout/${product.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {product.image && (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/50 bg-card">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-display text-base font-bold leading-tight text-foreground">
                {product.name}
              </h3>
              {product.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>

            {product.price && (
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produto</span>
                  <span className="font-medium">{product.name}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-brand">{product.price}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Pagamento via PIX ou cartão de crédito.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            A retirada do produto é combinada com a equipe após a confirmação do pagamento.
          </p>

          {!user && (
            <p className="text-sm text-center text-muted-foreground">
              Faça login para prosseguir com a compra.
            </p>
          )}

          <Button
            variant="brand"
            size="lg"
            className="w-full"
            disabled={!user || value <= 0}
            onClick={handleCheckout}
          >
            Ir para o pagamento <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
