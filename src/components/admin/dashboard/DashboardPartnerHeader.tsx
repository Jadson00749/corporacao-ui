import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  commissionPct: number;
  className?: string;
};

/**
 * Cabeçalho compacto da Visão do Parceiro (Admin Master).
 * Apenas filtro de leitura: não troca sessão nem permissões.
 * A troca/volta é feita pelo seletor de contexto no topo.
 */
export function DashboardPartnerHeader({ name, commissionPct, className }: Props) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          <Building2 className="h-3 w-3" aria-hidden /> Parceiro
        </span>
      </div>
      <h1 className="mt-1.5 truncate font-display text-2xl font-bold sm:text-3xl">{name}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Comissão contratada:{" "}
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          {commissionPct > 0 ? `${commissionPct}%` : "não definida"}
        </span>
      </p>
    </div>
  );
}
