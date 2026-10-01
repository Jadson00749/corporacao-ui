import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/data/products";

export function showCartToast(product: Product) {
  toast.custom(() => (
    <div className="flex items-center gap-3 w-full max-w-sm rounded-2xl border border-brand/30 bg-card shadow-2xl px-4 py-3">
      {product.image && (
        <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-border/60 bg-background">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand mb-0.5">
          Adicionado ao carrinho
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
        {product.price && (
          <p className="text-xs text-muted-foreground mt-0.5">{product.price}</p>
        )}
      </div>
      <div className="shrink-0 w-8 h-8 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
        <ShoppingCart className="w-4 h-4 text-brand" />
      </div>
    </div>
  ), { duration: 2500, position: "bottom-right" });
}
