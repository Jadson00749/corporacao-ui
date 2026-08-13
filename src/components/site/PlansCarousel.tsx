import { useEffect, useMemo, useRef } from "react";
import { PlanCard, __planHelpers } from "@/components/site/PlanCard";
import type { Plan } from "@/data/plans";

export const PlansCarousel = ({ plans }: { plans: Plan[] }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<1 | -1>(1);
  const pausedRef = useRef(false);

  // Calcula a referência mensal (menor preço mensal entre planos mensais)
  const monthlyReference = useMemo(() => {
    const monthlyPrices = plans
      .filter((p) => __planHelpers.detectPeriodMonths(p.name) === 1)
      .map((p) => __planHelpers.parsePrice(p.price))
      .filter((v): v is number => v != null);
    if (monthlyPrices.length === 0) return null;
    return Math.max(...monthlyPrices);
  }, [plans]);

  // Ordena: mais barato primeiro (planos sem preço vão para o fim)
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const pa = __planHelpers.parsePrice(a.price);
      const pb = __planHelpers.parsePrice(b.price);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
  }, [plans]);

  const cheapestId = useMemo(() => {
    const withPrice = sortedPlans.find((p) => __planHelpers.parsePrice(p.price) != null);
    return withPrice?.id ?? null;
  }, [sortedPlans]);

  // Garante que o carrossel comece no início (plano mais barato em destaque)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
  }, [sortedPlans]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = () => { pausedRef.current = true; };
    const onPointerUp = () => { setTimeout(() => { pausedRef.current = false; }, 3000); };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    const interval = setInterval(() => {
      if (pausedRef.current || !el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const card = el.querySelector<HTMLElement>("[data-plan-card]");
      const step = card ? card.offsetWidth + 24 : 200;
      let next = el.scrollLeft + step * directionRef.current;
      if (next >= max - 2) {
        next = max;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      el.scrollTo({ left: next, behavior: "smooth" });
    }, 4500);

    return () => {
      clearInterval(interval);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [sortedPlans.length]);

  return (
    <>
      <div
        ref={scrollerRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pt-6 pb-4 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden items-stretch"
      >
        {sortedPlans.map((p) => {
          const isCheapest = p.id === cheapestId;
          return (
            <div
              key={p.id}
              data-plan-card
              className={`snap-start shrink-0 w-[82%] sm:w-[46%] md:w-[31%] lg:w-[calc((100%-4.5rem)/4)] flex relative ${
                isCheapest ? "md:scale-100" : ""
              }`}
            >
              {isCheapest && (
                <span
                  className="md:hidden absolute -top-1 left-1/2 -translate-x-1/2 z-10
                             inline-flex items-center gap-1 rounded-full
                             bg-brand text-background
                             px-2.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.22em]
                             shadow-[0_6px_20px_-6px_hsl(var(--brand)/0.6)]"
                >
                  Mais acessível
                </span>
              )}
              <div
                className={`flex w-full ${
                  isCheapest
                    ? "rounded-2xl md:rounded-none ring-2 ring-brand/60 md:ring-0 shadow-[0_20px_60px_-25px_hsl(var(--brand)/0.5)] md:shadow-none"
                    : ""
                }`}
              >
                <PlanCard plan={p} monthlyReference={monthlyReference} />
              </div>
            </div>
          );
        })}
        <div className="shrink-0 w-1" aria-hidden />
      </div>
      <p className="md:hidden mt-1 text-center text-[10px] text-muted-foreground/70 tracking-wider uppercase">
        Arraste para ver outros planos
      </p>
    </>
  );
};
