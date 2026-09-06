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
};

/**
 * Bloco contextual de pendências. Não renderiza nada se a lista estiver vazia.
 */
export function AttentionNeeded({
  items,
  title = "Precisa da sua atenção",
  className,
}: Props) {
  if (!items.length) return null;

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

          const className =
            "flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-warning/50 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

          if (item.to) {
            return (
              <li key={item.id}>
                <Link to={item.to} className={className}>
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <button type="button" onClick={item.onClick} className={className}>
                {body}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
