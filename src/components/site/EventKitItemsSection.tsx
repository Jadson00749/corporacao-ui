import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublicKitItem = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
};

type Props = {
  items: PublicKitItem[];
  className?: string;
};

const KitItemCard = ({ item }: { item: PublicKitItem }) => (
  <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60">
    <div className="aspect-square bg-secondary/30">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Package className="h-8 w-8 opacity-50" />
        </div>
      )}
    </div>
    <div className="flex flex-1 flex-col p-3.5">
      <h3 className="font-semibold text-sm leading-snug text-foreground">{item.name}</h3>
      {item.description?.trim() && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {item.description.trim()}
        </p>
      )}
    </div>
  </article>
);

/**
 * Seção pública do kit incluso na prova.
 * Mobile: carrossel horizontal; Desktop: grid.
 * Não renderize o wrapper pai se `items` estiver vazio.
 */
export const EventKitItemsSection = ({ items, className }: Props) => {
  if (!items.length) return null;

  return (
    <div className={cn(className)}>
      {/* Mobile */}
      <div className="md:hidden -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
        {items.map((item) => (
          <div key={item.id} className="w-[72%] max-w-[260px] shrink-0 snap-start">
            <KitItemCard item={item} />
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <KitItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
