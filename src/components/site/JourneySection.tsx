import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "./SectionHeader";


const stages = [
  {
    km: "0K",
    label: "Largada",
    title: "Avaliação e planilha individual",
    micro: "Coach entende seu objetivo.",
  },
  {
    km: "5K",
    label: "Split 1",
    title: "O treino começa a fazer sentido",
    micro: "Planilha no app, ritmo seu.",
  },
  {
    km: "10K",
    label: "Split 2",
    title: "Seu corpo responde",
    micro: "Força, fôlego e constância.",
  },
  {
    km: "21K",
    label: "Meia",
    title: "A evolução aparece",
    micro: "Cada treino deixa sua marca.",
  },
  {
    km: "Lifestyle",
    label: "Chegada",
    title: "A corrida vira parte da vida",
    micro: "Método, provas e Treinão mensal.",
  },
];

export const JourneySection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackWrapRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [autoIndex, setAutoIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Auto-avança pelas etapas quando a seção está visível e o usuário não interage
  useEffect(() => {
    if (!hasEntered || isHovering) return;
    const id = window.setInterval(() => {
      setAutoIndex((i) => (i + 1) % stages.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [hasEntered, isHovering]);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh * 0.4;
      const passed = Math.min(Math.max(vh * 0.85 - rect.top, 0), total);
      setScrollProgress(Math.min(passed / total, 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setHasEntered(true)),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setHoverProgress(Math.max(0, Math.min(1, x)));
  };

  // Quando não há hover, o split ativo vem do auto-avanço (independente do mouse)
  const autoProgress = autoIndex / (stages.length - 1);
  const progress = hoverProgress ?? autoProgress;
  const activeIndex =
    hoverProgress !== null
      ? Math.max(
          0,
          Math.min(
            stages.length - 1,
            Math.round(hoverProgress * (stages.length - 1))
          )
        )
      : autoIndex;
  const activeStage = stages[activeIndex];

  return (
    <section
      ref={sectionRef}
      className="relative section-padding overflow-hidden bg-[#080808] text-white"
    >
      {/* Halo verde discreto */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[300px] rounded-full opacity-[0.07] blur-[160px]"
        style={{ background: "radial-gradient(ellipse, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      {/* Grid sutil */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 100%",
        }}
      />
      {/* Grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <style>{`
        @keyframes journey-tick { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
        @keyframes journey-bigfade {
          from { opacity: 0; transform: translateY(8px); letter-spacing: 0.04em; }
          to { opacity: 1; transform: translateY(0); letter-spacing: -0.02em; }
        }
        @keyframes journey-pulse-ring {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes journey-stat-rise {
          from { opacity: 0; transform: translateY(14px); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes journey-dot-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="container-page relative">
        <SectionHeader
          light
          align="left"
          eyebrow="Sua jornada"
          title="Da largada ao estilo de vida."
          subtitle="Com método, planilha individual e coach acompanhando cada fase."
          className="mb-10 md:mb-12"
        />

        {/* DESKTOP: timeline de race splits */}
        <div
          ref={trackWrapRef}
          onMouseEnter={() => setIsHovering(true)}
          onMouseMove={onMouseMove}
          onMouseLeave={() => {
            setHoverProgress(null);
            setIsHovering(false);
          }}
          className="relative hidden md:block"
        >
          {/* Painel da etapa ativa */}
          <div className="grid grid-cols-[auto_1fr] items-end gap-8 mb-5 min-h-[88px]">
            <div
              key={`km-${activeIndex}`}
              className="font-display font-bold leading-[0.9] tabular-nums tracking-tight min-w-0"
              style={{ animation: "journey-bigfade 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
            >
              <div
                className={`text-brand whitespace-nowrap ${
                  activeStage.km.length > 6
                    ? "text-[2rem] lg:text-[2.5rem]"
                    : activeStage.km.length > 4
                    ? "text-[3rem]"
                    : "text-[4.5rem]"
                }`}
              >
                {activeStage.km}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-semibold mt-1.5">
                {activeStage.label}
              </div>
            </div>

            <div
              key={`title-${activeIndex}`}
              className="pb-2"
              style={{ animation: "journey-bigfade 0.55s cubic-bezier(0.22,1,0.36,1) both 0.05s" }}
            >
              <h3 className="font-display text-xl lg:text-2xl font-semibold leading-[1.15] text-white max-w-2xl text-balance">
                {activeStage.title}
              </h3>
              <p className="mt-1.5 text-sm text-white/60 max-w-md leading-relaxed">
                {activeStage.micro}
              </p>
            </div>
          </div>

          {/* Eixo / régua de KM */}
          <div className="relative pt-2">
            {/* Linha base */}
            <div className="relative h-[2px] bg-white/10">
              {/* Ticks */}
              {Array.from({ length: 21 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-0 w-px bg-white/15"
                  style={{
                    left: `${(i / 20) * 100}%`,
                    height: i % 5 === 0 ? "10px" : "5px",
                    transform: "translateY(2px)",
                  }}
                />
              ))}

              {/* Progresso preenchido */}
              <div
                className="absolute inset-y-0 left-0 bg-brand"
                style={{
                  width: `${progress * 100}%`,
                  transition:
                    hoverProgress !== null
                      ? "width 0.18s ease-out"
                      : "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  boxShadow:
                    "0 0 14px hsl(var(--brand) / 0.7), 0 0 30px hsl(var(--brand) / 0.35)",
                }}
              />

              {/* Pontos de checkpoint na linha (sempre visíveis, ativo destacado) */}
              {stages.map((s, i) => {
                const t = i / (stages.length - 1);
                const isActive = activeIndex === i;
                const reached = progress >= t - 0.001;
                return (
                  <span
                    key={`dot-${s.km}`}
                    aria-hidden
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${t * 100}%` }}
                  >
                    {isActive && (
                      <span
                        className="absolute top-1/2 left-1/2 w-[14px] h-[14px] rounded-full"
                        style={{
                          border: "1px solid hsl(var(--brand))",
                          animation: "journey-pulse-ring 1.6s ease-out infinite",
                        }}
                      />
                    )}
                    <span
                      className="block rounded-full transition-all duration-500"
                      style={{
                        width: isActive ? 12 : reached ? 7 : 5,
                        height: isActive ? 12 : reached ? 7 : 5,
                        background: isActive
                          ? "hsl(var(--brand))"
                          : reached
                          ? "rgba(255,255,255,0.85)"
                          : "rgba(255,255,255,0.25)",
                        boxShadow: isActive
                          ? "0 0 14px hsl(var(--brand) / 0.9), 0 0 28px hsl(var(--brand) / 0.5)"
                          : "none",
                      }}
                    />
                  </span>
                );
              })}

              {/* Cabeça/cursor da corrida */}
              <div
                className="absolute -top-2 -translate-x-1/2 flex flex-col items-center"
                style={{
                  left: `${progress * 100}%`,
                  transition:
                    hoverProgress !== null
                      ? "left 0.18s ease-out"
                      : "left 0.8s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <span className="block w-[6px] h-[6px] rounded-full bg-white shadow-[0_0_12px_hsl(var(--brand)),0_0_24px_hsl(var(--brand))]" />
                <span className="mt-1 font-mono text-[9px] tracking-[0.28em] uppercase text-brand font-semibold whitespace-nowrap">
                  {stages[activeIndex >= 0 ? activeIndex : 0].label}
                </span>
              </div>
            </div>

            {/* Checkpoints (KM markers) */}
            <div className="relative mt-4 grid grid-cols-5">
              {stages.map((s, i) => {
                const t = i / (stages.length - 1);
                const reached = progress >= t - 0.02;
                const isActive = activeIndex === i;
                return (
                  <button
                    type="button"
                    key={s.km}
                    onMouseEnter={() => setHoverProgress(t)}
                    onFocus={() => setHoverProgress(t)}
                    className="group relative flex flex-col items-start text-left outline-none"
                    style={{ gridColumnStart: i + 1 }}
                  >
                    {/* Vertical guide do tick até o label */}
                    <span
                      aria-hidden
                      className="absolute -top-3 left-0 w-px transition-all duration-500"
                      style={{
                        height: isActive ? "14px" : "10px",
                        background: reached ? "hsl(var(--brand))" : "rgba(255,255,255,0.2)",
                        boxShadow: isActive ? "0 0 8px hsl(var(--brand) / 0.7)" : "none",
                      }}
                    />
                    <div className="flex items-baseline gap-2 transition-transform duration-500 group-hover:-translate-y-0.5">
                      <span
                        className={`font-display italic font-bold tracking-tight transition-colors ${
                          s.km.length > 4 ? "text-sm" : "text-lg"
                        } tabular-nums ${
                          isActive ? "text-brand" : reached ? "text-white" : "text-white/40 group-hover:text-white/70"
                        }`}
                      >
                        {s.km}
                      </span>
                      <span
                        className={`font-mono text-[9px] tracking-[0.28em] uppercase transition-colors ${
                          isActive ? "text-brand/80" : "text-white/30 group-hover:text-white/55"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <span
                      className={`font-display text-[12px] mt-0.5 leading-tight max-w-[150px] transition-colors duration-500 ${
                        isActive
                          ? "text-white"
                          : reached
                          ? "text-white/70"
                          : "text-white/40 group-hover:text-white/75"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* MOBILE: lista de splits */}
        <div className="md:hidden">
          {/* Header stats */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/40">
                Ritmo da jornada
              </div>
              <div className="font-display italic font-bold text-3xl tabular-nums">
                05<span className="text-brand">.</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/40">
                Tribo
              </div>
              <div className="font-display italic font-bold text-3xl">
                Junto<span className="text-brand">.</span>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="relative h-[2px] bg-white/10 rounded-full overflow-hidden mb-6">
            <div
              className="absolute inset-y-0 left-0 bg-brand rounded-full"
              style={{
                width: `${Math.max(scrollProgress * 100, 6)}%`,
                transition: "width 0.4s ease",
                boxShadow: "0 0 10px hsl(var(--brand) / 0.7)",
              }}
            />
          </div>

          {/* Splits list */}
          <ol className="divide-y divide-white/8">
            {stages.map((s, i) => {
              const t = i / (stages.length - 1);
              const reached = scrollProgress >= t - 0.02;
              return (
                <li
                  key={s.km}
                  className="grid grid-cols-[60px_1fr_auto] items-baseline gap-3 py-3.5"
                  style={{
                    transition: "opacity 0.4s ease",
                    opacity: hasEntered ? 1 : 0,
                  }}
                >
                  <div
                    className={`font-display italic font-bold text-2xl tabular-nums tracking-tight ${
                      reached ? "text-brand" : "text-white/35"
                    }`}
                  >
                    {s.km}
                  </div>
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/35">
                      {s.label}
                    </div>
                    <div
                      className={`font-display italic font-semibold text-[14px] leading-tight mt-0.5 ${
                        reached ? "text-white" : "text-white/55"
                      }`}
                    >
                      {s.title}
                    </div>
                  </div>
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-2 ${
                      reached ? "bg-brand" : "bg-white/20"
                    }`}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default JourneySection;
