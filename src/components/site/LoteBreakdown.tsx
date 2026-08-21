import { DistancePricing, loteList, formatBRL, formatDateBR } from "@/lib/eventPricing";
import { cn } from "@/lib/utils";

/** Lista visual dos lotes de uma distância: encerrado / lote atual / futuro. */
export const LoteBreakdown = ({
  distance,
  className,
}: {
  distance: DistancePricing;
  className?: string;
}) => {
  const lotes = loteList(distance);
  if (lotes.length <= 1) return null;

  return (
    <ul className={cn("space-y-1", className)}>
      {lotes.map((l) => (
        <li
          key={l.n}
          className={cn(
            "flex items-center justify-between gap-2 text-[11px] rounded-md px-2 py-1 border",
            l.state === "current"
              ? "border-success/40 bg-success/10 text-foreground"
              : l.state === "past"
                ? "border-border/50 text-muted-foreground line-through decoration-muted-foreground/50"
                : "border-border/50 text-muted-foreground"
          )}
        >
          <span className="font-semibold tracking-wide uppercase">{l.n}º lote</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("font-semibold", l.state === "current" && "text-success")}>
              {formatBRL(l.price)}
            </span>
            {l.state === "past" && <span className="no-underline">— encerrado</span>}
            {l.state === "current" && (
              <span className="inline-flex items-center gap-1 font-semibold text-success no-underline">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                lote atual
              </span>
            )}
            {l.state === "future" && l.startsAt && <span>— a partir de {formatDateBR(l.startsAt)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
};
