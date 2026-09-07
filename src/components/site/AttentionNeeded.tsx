import { Link } from "@/lib/router-compat";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  id: string;
  title: string;
  description?: string;
  /** Rota interna ou #âncora */
  to?: string;
  onClick?: () => void;
};

type Props = {
  items: AttentionItem[];
  title?: string;
  className?: string;
  /** Faixa compacta (dashboard operacional). */
  compact?: boolean;
};

/**
 * Bloco contextual de pendências. Não renderiza nada se a lista estiver vazia.
 */
export function AttentionNeeded({
  items,
  title = "Precisa da sua atenção",
  className,
  compact = false,
}: Props) {
  if (!items.length) return null;

  if (compact) {
    return (
      <section
        className={cn("rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2", className)}
        aria-label={title}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-warning">
            {title}
          </h2>
          <span className="rounded-full bg-warning/20 px-1.5 py-px text-[10px] font-semibold text-warning">
            {items.length}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1">
          {items.map((item) => {
            const chip = (
              <>
                <span className="min-w-0 truncate text-[12px] font-medium leading-none">{item.title}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              </>
            );
            const chipClass =
              "inline-flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 text-left transition-colors hover:border-warning/50 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";
            if (item.to) {
              return (
                <li key={item.id} className="min-w-0">
                  <Link to={item.to} className={chipClass} title={item.description || item.title}>
                    {chip}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.id} className="min-w-0">
                <button type="button" onClick={item.onClick} className={chipClass} title={item.description || item.title}>
                  {chip}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-warning/40 bg-warning/10 p-3.5 sm:p-4",
        className
      )}
      aria-label={title}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <h2 className="font-display text-sm font-bold sm:text-base">{title}</h2>
        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning">
          {items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{item.title}</span>
                {item.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                    {item.description}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </>
          );

          const itemClass =
            "flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-warning/50 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

          if (item.to) {
            return (
              <li key={item.id}>
                <Link to={item.to} className={itemClass}>
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <button type="button" onClick={item.onClick} className={itemClass}>
                {body}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
