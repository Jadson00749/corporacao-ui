import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  className?: string;
};

/** Empty state padronizado — o que aconteceu + o que fazer agora. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-card/40 px-4 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
      )}
      <p className="font-display text-base font-semibold">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {(actionLabel && actionTo) || (actionLabel && onAction) ? (
        <div className="mt-4">
          {actionTo ? (
            <Button asChild variant="brand" size="sm">
              <Link to={actionTo}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button type="button" variant="brand" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

type ErrorProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Tente novamente em instantes. Se o problema continuar, fale com o suporte.",
  onRetry,
  className,
}: ErrorProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center",
        className
      )}
      role="alert"
    >
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
