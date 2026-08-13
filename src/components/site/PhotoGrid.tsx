import { useState } from "react";
import { GalleryItem } from "@/data/gallery";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  items: GalleryItem[];
  showCategories?: boolean;
};

export const PhotoGrid = ({ items, showCategories = false }: Props) => {
  const [active, setActive] = useState<GalleryItem | null>(null);
  const [filter, setFilter] = useState<string>("Todas");

  const categories = ["Todas", ...Array.from(new Set(items.map((i) => i.category)))];
  const filtered = filter === "Todas" ? items : items.filter((i) => i.category === filter);

  return (
    <div>
      {showCategories && (
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                filter === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground/70 hover:bg-secondary/70"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setActive(item)}
            className={cn(
              "group relative overflow-hidden rounded-xl bg-secondary aspect-square shadow-card hover-lift",
              i === 0 && "md:col-span-2 md:row-span-2 md:aspect-auto"
            )}
          >
            <img
              src={item.src}
              alt={item.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <div className="text-white">
                <p className="text-xs uppercase tracking-wider text-brand-glow">{item.category}</p>
                <p className="font-display font-semibold">{item.title}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-0">
          {active && (
            <div>
              <img src={active.src} alt={active.title} className="w-full h-auto" />
              <div className="p-4">
                <p className="text-xs uppercase tracking-wider text-brand">{active.category}</p>
                <p className="font-display text-lg font-semibold">{active.title}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
