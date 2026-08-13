import { Check, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plan } from "@/data/plans";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

// ============================================================
// Helpers de preço
// ============================================================

const PERIOD_MAP: Record<string, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const detectPeriodMonths = (name: string): number => {
  const lower = name.toLowerCase();
  for (const key of Object.keys(PERIOD_MAP)) {
    if (lower.includes(key)) return PERIOD_MAP[key];
  }
  return 1;
};

const parsePrice = (price?: string): number | null => {
  if (!price) return null;
  const cleaned = price
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });

const PERIOD_LABEL: Record<number, string> = {
  1: "mensal",
  3: "trimestral",
  6: "semestral",
  12: "anual",
};

// ============================================================
// Bullets: destaca "TrainingPeaks" como detalhe pequeno
// ============================================================

const isOperationalBullet = (_text: string) => false;

// ============================================================
// PlanCard
// ============================================================

type Props = {
  plan: Plan;
  /** Preço mensal de referência (plano mensal) na mesma categoria, em número. */
  monthlyReference?: number | null;
};

export const PlanCard = ({ plan, monthlyReference }: Props) => {
  const whatsappLink = useWhatsappLink();

  const totalPrice = parsePrice(plan.price);
  const periodMonths = detectPeriodMonths(plan.name);
  const monthlyEquivalent =
    totalPrice != null ? totalPrice / periodMonths : null;

  const savings =
    monthlyReference && totalPrice && periodMonths > 1
      ? monthlyReference * periodMonths - totalPrice
      : 0;

  const perDay =
    monthlyEquivalent != null ? monthlyEquivalent / 30 : null;

  const isBestValue = plan.highlight;

  return (
    <div
      className={cn(
        "group relative rounded-2xl p-7 flex flex-col h-full transition-all duration-500",
        isBestValue
          ? "bg-gradient-to-b from-card to-card border-2 border-brand shadow-[0_24px_70px_-30px_hsl(var(--brand)/0.55)] hover:shadow-[0_28px_80px_-30px_hsl(var(--brand)/0.7)]"
          : "bg-card border border-border/60 hover:border-brand/40"
      )}
    >
      {isBestValue && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-brand text-brand-foreground text-[10px] font-semibold px-3.5 py-1 rounded-full uppercase tracking-[0.22em] whitespace-nowrap shadow-md">
          <Sparkles className="w-3 h-3" strokeWidth={2.5} />
          Mais popular
        </span>
      )}

      <div>
        <p className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand">
          {plan.name}
        </p>
        {plan.tagline && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
            {plan.tagline}
          </p>
        )}

        {/* Preço principal: valor MENSAL em destaque */}
        {monthlyEquivalent != null ? (
          <div className="mt-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                R$
              </span>
              <span className="font-display text-5xl font-bold text-foreground tracking-tight leading-none">
                {Math.round(monthlyEquivalent).toLocaleString("pt-BR")}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                /mês
              </span>
            </div>



            {/* Badge de economia */}
            {savings > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
                Economize {formatBRL(savings)}
              </div>
            )}
          </div>
        ) : (
          plan.price && (
            <div className="mt-5">
              <div className="font-display text-4xl font-bold text-foreground tracking-tight">
                {plan.price}
                {plan.priceNote && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    {plan.priceNote}
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <span
        aria-hidden
        className="mt-6 h-px w-10 bg-brand/50 transition-all duration-500 group-hover:w-20"
      />

      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((f) => {
          const operational = isOperationalBullet(f);
          return (
            <li
              key={f}
              className={cn(
                "flex items-start gap-2.5",
                operational
                  ? "text-[11px] text-muted-foreground/80 italic"
                  : "text-sm"
              )}
            >
              <Check
                className={cn(
                  "mt-0.5 shrink-0",
                  operational ? "w-3 h-3 text-muted-foreground" : "w-4 h-4 text-brand"
                )}
                strokeWidth={2.5}
              />
              <span
                className={cn(
                  operational ? "leading-snug" : "text-foreground/85 leading-relaxed"
                )}
              >
                {f}
              </span>
            </li>
          );
        })}
      </ul>

      <Button
        asChild
        variant={isBestValue ? "brand" : "outline"}
        className={cn(
          "mt-7 w-full rounded-full font-semibold",
          isBestValue && "shadow-lg shadow-brand/20 hover:shadow-brand/40"
        )}
        size="lg"
      >
        <a href={whatsappLink(plan.ctaMessage)} target="_blank" rel="noreferrer">
          Quero começar agora
        </a>
      </Button>
    </div>
  );
};

// Exporta helpers para uso no carousel (cálculo de referência)
export const __planHelpers = { parsePrice, detectPeriodMonths };
