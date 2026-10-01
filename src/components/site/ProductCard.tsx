import { useState } from "react";
import { Product } from "@/data/products";
import { MessageCircle, ChevronLeft, ChevronRight, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { useCart } from "@/contexts/CartContext";

export const ProductCard = ({
  product,
  onBuy,
}: {
  product: Product;
  onBuy?: (size?: string) => void;
}) => {
  const whatsappLink = useWhatsappLink();
  const { items } = useCart();
  const inCart = items.some((i) => i.product.id === product.id);
  const hasSizes = (product.sizes?.length ?? 0) > 0;
  // Count per size already in cart for this product
  const sizeCountsInCart = items
    .filter((i) => i.product.id === product.id)
    .reduce<Record<string, number>>((acc, i) => {
      if (i.selectedSize) acc[i.selectedSize] = (acc[i.selectedSize] ?? 0) + i.quantity;
      return acc;
    }, {});

  const gallery = (product.images && product.images.length > 0
    ? product.images
    : [product.image]
  ).filter(Boolean);
  const [index, setIndex] = useState(0);
  const hasMultiple = gallery.length > 1;

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i - 1 + gallery.length) % gallery.length);
  };
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + 1) % gallery.length);
  };

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-card rounded-2xl border border-border/50 transition-all duration-500 group-hover:border-brand/30">
        {gallery.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={`${product.name} ${i === 0 ? "frente" : i === 1 ? "verso" : `vista ${i + 1}`}`}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-all duration-700",
              i === index ? "opacity-100" : "opacity-0",
              "group-hover:scale-[1.04]"
            )}
          />
        ))}

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/85 hover:bg-background border border-border/60 flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/85 hover:bg-background border border-border/60 flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  aria-label={`Ver imagem ${i + 1}`}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === index ? "w-5 bg-brand" : "w-1 bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col flex-1">
        <h3 className="font-display text-base font-semibold text-foreground leading-snug">{product.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 flex-1">{product.description}</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          {product.price && (
            <div className="font-display text-lg font-semibold text-foreground tracking-tight">{product.price}</div>
          )}
          {onBuy && !hasSizes ? (
            <button
              type="button"
              onClick={() => onBuy()}
              className={cn(
                "group/cta inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
                inCart ? "text-brand" : "text-foreground hover:text-brand"
              )}
            >
              {inCart ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {inCart ? "Adicionado" : "Adicionar"}
              <span className={cn("h-px transition-all duration-300", inCart ? "w-8 bg-brand" : "w-4 bg-foreground/40 group-hover/cta:w-8 group-hover/cta:bg-brand")} />
            </button>
          ) : !onBuy ? (
            <a
              data-whatsapp-cta
              href={whatsappLink(
                product.ctaMessage ||
                  `Olá! Tenho interesse no produto: ${product.name}${product.price ? ` (${product.price})` : ""}. Quero combinar a retirada.`
              )}
              target="_blank"
              rel="noreferrer"
              className="group/cta inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-foreground hover:text-brand transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Pedir
              <span className="w-4 h-px bg-foreground/40 group-hover/cta:w-8 group-hover/cta:bg-brand transition-all duration-300" />
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/cta:opacity-100 group-hover/cta:translate-x-0 transition-all duration-300" />
            </a>
          ) : null}
        </div>

        {/* Tamanhos sempre visíveis — clicar adiciona ao carrinho */}
        {hasSizes && onBuy && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.sizes!.map((size) => {
              const qty = sizeCountsInCart[size] ?? 0;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onBuy(size)}
                  className={cn(
                    "relative px-2.5 py-1 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-all",
                    qty > 0
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-background text-foreground hover:border-brand hover:text-brand hover:bg-brand/10"
                  )}
                >
                  {size}
                  {qty > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-brand text-background text-[9px] font-bold leading-none">
                      {qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};
