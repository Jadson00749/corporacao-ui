import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type TrendPoint = { date: string; label: string; count: number };
export type TrendTone = "brand" | "blue";

type Props = {
  points: TrendPoint[];
  /** Mini KPIs opcionais acima do gráfico */
  kpis?: { label: string; value: string }[];
  /** Identidade visual: verde (Corporação) ou azul (parceiro). */
  tone?: TrendTone;
  className?: string;
};

const TONES: Record<TrendTone, { line: string; soft: string }> = {
  brand: { line: "hsl(142 72% 45%)", soft: "hsl(142 65% 42%)" },
  blue: { line: "hsl(217 91% 60%)", soft: "hsl(217 85% 55%)" },
};

export function DashboardSignupTrend({ points, kpis, tone = "brand", className }: Props) {
  const LINE = TONES[tone].line;
  const LINE_SOFT = TONES[tone].soft;
  const gradientId = `fillSignupsDash-${tone}`;
  const chartConfig = {
    count: { label: "Inscrições", color: LINE },
  };
  const total = useMemo(() => points.reduce((a, p) => a + p.count, 0), [points]);
  const peak = useMemo(() => Math.max(0, ...points.map((p) => p.count)), [points]);

  const data = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        isPeak: peak > 0 && p.count === peak,
      })),
    [points, peak]
  );

  const peakLabel = useMemo(() => {
    const hit = data.find((p) => p.isPeak);
    return hit ? `${hit.label} · ${hit.count}` : null;
  }, [data]);

  return (
    <section className={cn("flex h-full min-h-[320px] flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
            Inscrições ao longo do tempo
          </h2>
          {peakLabel && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pico: <span className="font-semibold text-foreground">{peakLabel}</span> insc.
            </p>
          )}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{total} no período</span>
      </div>

      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-2 border-b border-border/50 px-4 py-2">
          {kpis.map((k) => (
            <div key={k.label} className="min-w-0">
              <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="font-display text-sm font-bold tabular-nums">{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 px-2 pb-3 pt-3">
        {points.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Sem dados no período.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <AreaChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LINE} stopOpacity={0.45} />
                  <stop offset="55%" stopColor={LINE_SOFT} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={LINE_SOFT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.08)" strokeDasharray="4 6" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fill: "hsl(0 0% 100% / 0.55)", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                width={32}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(0 0% 100% / 0.55)", fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ stroke: "hsl(0 0% 100% / 0.2)", strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as TrendPoint | undefined;
                      if (!row?.date) return "";
                      const [y, m, d] = row.date.split("-");
                      return `${d}/${m}/${y}`;
                    }}
                    formatter={(value) => (
                      <span className="font-semibold tabular-nums">{value} inscrições</span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={LINE}
                fill={`url(#${gradientId})`}
                strokeWidth={2.75}
                name="Inscrições"
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(0 0% 6%)", fill: LINE }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload?.isPeak || cx == null || cy == null) return <g key={props.index} />;
                  return (
                    <g key={`peak-${props.index}`}>
                      <circle cx={cx} cy={cy} r={7} fill={LINE} opacity={0.28} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.75}
                        fill={LINE}
                        stroke="hsl(0 0% 8%)"
                        strokeWidth={2}
                      />
                    </g>
                  );
                }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
