import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_TOUR_DONE_EVENT,
  ATHLETE_TABS_TOUR_KEY,
  isAccountTourDone,
  isWelcomePending,
  WELCOME_CLOSED_EVENT,
} from "@/lib/firstAccess";

export type CoachStep = {
  el: HTMLElement | null;
  title: string;
  text: string;
};

type Rect = { top: number; left: number; width: number; height: number };

interface Props {
  steps: CoachStep[];
  storageKey?: string;
  /** Só inicia quando true (ex.: perfil completo e abas montadas). */
  enabled?: boolean;
  onFinish?: () => void;
}

/** Tour/spotlight: acima de dialog (z-50), abaixo de toast (z-[100]). */
const TOUR_Z = "z-[60]";

export const TabsCoachmark = ({
  steps,
  storageKey = ATHLETE_TABS_TOUR_KEY,
  enabled = true,
  onFinish,
}: Props) => {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [placeAbove, setPlaceAbove] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "completed");
    } catch {}
    setActive(false);
    onFinish?.();
  }, [storageKey, onFinish]);

  const canStart = useCallback(() => {
    try {
      if (!enabled) return false;
      if (localStorage.getItem(storageKey) === "completed") return false;
      if (isWelcomePending()) return false;
      if (!isAccountTourDone()) return false;
      return true;
    } catch {
      return false;
    }
  }, [enabled, storageKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryStart = () => {
      if (!canStart()) return;
      clearTimeout(timer);
      timer = setTimeout(() => setActive(true), 450);
    };

    tryStart();
    window.addEventListener(WELCOME_CLOSED_EVENT, tryStart);
    window.addEventListener(ACCOUNT_TOUR_DONE_EVENT, tryStart);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(WELCOME_CLOSED_EVENT, tryStart);
      window.removeEventListener(ACCOUNT_TOUR_DONE_EVENT, tryStart);
    };
  }, [canStart]);

  const current = steps[index];

  useEffect(() => {
    if (!active) return;
    if (current?.el) return;
    if (index < steps.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    finish();
  }, [active, current?.el, index, steps.length, finish]);

  useLayoutEffect(() => {
    if (!active || !current?.el) {
      setRect(null);
      return;
    }
    const el = current.el;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });

      const spaceBelow = window.innerHeight - (r.top + r.height);
      const spaceAbove = r.top;
      const tipH = tooltipRef.current?.offsetHeight ?? 160;
      setPlaceAbove(spaceBelow < tipH + 24 && spaceAbove > spaceBelow);
    };

    measure();
    const t1 = setTimeout(measure, 200);
    const t2 = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, index, current?.el]);

  if (!active || !current || !rect) return null;

  const pad = 6;
  const isLast = index === steps.length - 1;
  const tipH = tooltipRef.current?.offsetHeight ?? 160;
  const rawTop = placeAbove ? rect.top - pad - 12 - tipH : rect.top + rect.height + pad + 10;
  const maxW = Math.min(320, window.innerWidth - 24);
  let tooltipLeft = rect.left + rect.width / 2 - maxW / 2;
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - maxW - 12));
  const clampedTop = Math.max(8, Math.min(rawTop, window.innerHeight - tipH - 8));

  return createPortal(
    <div className={`fixed inset-0 ${TOUR_Z}`} role="dialog" aria-label="Tour da Área do Atleta">
      <div
        className="pointer-events-none absolute rounded-xl transition-all duration-300 ease-out coachmark-glow"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
        }}
      />
      <div className="absolute inset-0" aria-hidden />

      <div
        ref={tooltipRef}
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-xl animate-in fade-in duration-300"
        style={{
          top: clampedTop,
          left: tooltipLeft,
          width: maxW,
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <p className="mb-1 font-display text-sm font-bold">{current.title}</p>
        <p className="text-sm leading-snug text-muted-foreground">{current.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="min-h-10 touch-manipulation px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Pular
          </button>
          <div className="flex items-center gap-2">
            <div className="mr-1 flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-brand" : "bg-border"}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="h-10 min-w-[5.5rem] touch-manipulation px-4"
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            >
              {isLast ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
