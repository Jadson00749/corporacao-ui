import { useEffect, useRef } from "react";

type ConfettiProps = {
  fire: boolean;
  /** Duração do burst em ms (padrão 1800 — usado em provas). */
  durationMs?: number;
  /** `subtle` = menos partículas (microcelebração). */
  density?: "default" | "subtle";
};

/**
 * Confete leve e discreto — roda uma única vez, respeita prefers-reduced-motion
 * e usa menos partículas no mobile.
 */
export const Confetti = ({ fire, durationMs = 1800, density = "default" }: ConfettiProps) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!fire) {
      played.current = false;
      return;
    }
    if (played.current) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    played.current = true;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const isMobile = window.innerWidth < 640;
    const base = density === "subtle" ? (isMobile ? 22 : 36) : isMobile ? 45 : 90;
    const count = base;
    const colors = ["#4ade80", "#22c55e", "#a3e635", "#ffffff", "#facc15"];
    const spread = density === "subtle" ? 0.28 : 0.5;
    const parts = Array.from({ length: count }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * spread,
      y: h * 0.28 + Math.random() * 40,
      vx: (Math.random() - 0.5) * (density === "subtle" ? 4 : 6) * dpr,
      vy: (Math.random() * -5 - 2) * dpr,
      size: (Math.random() * (density === "subtle" ? 4 : 5) + 2.5) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const start = performance.now();
    const duration = Math.max(400, durationMs);
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const life = 1 - elapsed / duration;
      ctx.clearRect(0, 0, w, h);
      if (life <= 0) {
        cancelAnimationFrame(raf);
        return;
      }
      ctx.globalAlpha = Math.min(1, life * 1.6);
      for (const p of parts) {
        p.vy += 0.18 * dpr;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, durationMs, density]);

  if (!fire) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
};
