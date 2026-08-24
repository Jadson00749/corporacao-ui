import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export type CoachStep = {
  el: HTMLElement | null;
  title: string;
  text: string;
};

type Rect = { top: number; left: number; width: number; height: number };

interface Props {
  steps: CoachStep[];
  storageKey?: string;
  onFinish?: () => void;
}

export const TabsCoachmark = ({ steps, storageKey = "athlete_area_onboarding_v1", onFinish }: Props) => {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "completed") {
        const t = setTimeout(() => setActive(true), 550);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [storageKey]);

  const current = steps[index];

  useLayoutEffect(() => {
    if (!active || !current?.el) return;
    const el = current.el;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, index, current?.el]);

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "completed");
    } catch {}
    setActive(false);
    onFinish?.();
  };

  if (!active || !current || !rect) return null;

  const pad = 6;
  const isLast = index === steps.length - 1;
  const tooltipTop = rect.top + rect.height + pad + 10;
  const maxW = Math.min(320, window.innerWidth - 24);
  let tooltipLeft = rect.left + rect.width / 2 - maxW / 2;
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - maxW - 12));

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Tour da Área do Atleta">
      {/* dim + spotlight */}
      <div
        className="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out coachmark-glow"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
        }}
      />
      {/* click catcher */}
      <div className="absolute inset-0" onClick={finish} />

      <div
        className="absolute rounded-2xl border border-border bg-card shadow-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300"
        style={{ top: tooltipTop, left: tooltipLeft, width: maxW }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-bold text-sm mb-1">{current.title}</p>
        <p className="text-sm text-muted-foreground leading-snug">{current.text}</p>
        <div className="flex items-center justify-between gap-3 mt-4">
          <button type="button" onClick={finish} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Pular
          </button>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-1">
              {steps.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-brand" : "bg-border"}`} />
              ))}
            </div>
            <Button size="sm" className="h-9 px-4" onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}>
              {isLast ? "Entendi" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
