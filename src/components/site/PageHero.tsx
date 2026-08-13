import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  image?: string;
  light?: boolean;
  eyebrow?: string;
};

export const PageHero = ({ title, subtitle, image, light = true, eyebrow }: Props) => (
  <section
    className={cn(
      "relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden",
      light ? "text-white" : "text-foreground",
      !image && "bg-[#080808]"
    )}
  >
    {image && (
      <>
        <img
          src={image}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
      </>
    )}

    {/* Halo verde sutil + linha editorial */}
    {!image && (
      <>
        <div
          aria-hidden
          className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent-brand) / 0.55), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent-brand) / 0.4), transparent 70%)" }}
        />
      </>
    )}

    <div className="container-page relative">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-5">
          <span aria-hidden className="h-px w-10 bg-brand" />
          <span className="text-[10px] font-semibold tracking-[0.32em] uppercase text-brand">
            {eyebrow ?? "Corporação"}
          </span>
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] tracking-tight text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className={cn(
            "mt-6 text-base md:text-lg max-w-2xl font-light leading-relaxed",
            light ? "text-white/70" : "text-muted-foreground"
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>

    {/* base divider */}
    {!image && (
      <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    )}
  </section>
);
