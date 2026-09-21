import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  urls: string[];
  alt?: string;
  className?: string;
};

/**
 * Galeria 1:1 no card da inscrição.
 * 1 foto → sem controles. >1 → setas (desktop hover) + dots + swipe.
 * Sem autoplay.
 */
export function EventStoreProductCarousel({ urls, alt = "", className }: Props) {
  const images = urls.filter((u) => String(u ?? "").trim());
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const count = images.length;
  const safeIndex = count ? ((index % count) + count) % count : 0;

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  if (count === 0) {
    return (
      <div
        className={cn(
          "aspect-square w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative aspect-square w-full overflow-hidden bg-zinc-900 select-none",
        className,
      )}
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null || count < 2) return;
        const x = e.changedTouches[0]?.clientX;
        if (x == null) return;
        const dx = x - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      {images.map((url, i) => (
        <img
          key={`${url}-${i}`}
          src={url}
          alt={alt}
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out",
            i === safeIndex ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hidden sm:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hidden sm:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Foto ${i + 1}`}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === safeIndex ? "bg-white" : "bg-white/40",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
