import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  intervalMs?: number;
  className?: string;
};

export const MobileAutoCarousel = ({ children, intervalMs = 3800, className = "" }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onDown = () => { pausedRef.current = true; };
    const onUp = () => { setTimeout(() => { pausedRef.current = false; }, 2500); };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    const id = setInterval(() => {
      if (pausedRef.current || !el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      const step = card ? card.offsetWidth + 16 : 240;
      let next = el.scrollLeft + step * dirRef.current;
      if (next >= max - 2) { next = max; dirRef.current = -1; }
      else if (next <= 0) { next = 0; dirRef.current = 1; }
      el.scrollTo({ left: next, behavior: "smooth" });
    }, intervalMs);

    return () => {
      clearInterval(id);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [intervalMs]);

  return (
    <div
      ref={ref}
      className={`md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="flex gap-4 pb-2">
        {children}
        <div className="shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
};
