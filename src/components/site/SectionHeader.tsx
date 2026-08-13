import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
  light?: boolean;
};

export const SectionHeader = ({ eyebrow, title, subtitle, align = "center", className, light }: Props) => (
  <div
    className={cn(
      "max-w-3xl",
      align === "center" ? "mx-auto text-center" : "text-left",
      className
    )}
  >
    {eyebrow && (
      <span className={cn(
        "inline-block text-xs font-semibold tracking-[0.2em] uppercase mb-3",
        light ? "text-brand-glow" : "text-brand"
      )}>
        {eyebrow}
      </span>
    )}
    <h2 className={cn(
      "font-display text-3xl md:text-4xl lg:text-5xl font-bold text-balance",
      light ? "text-white" : "text-foreground"
    )}>
      {title}
    </h2>
    {subtitle && (
      <p className={cn(
        "mt-4 text-base md:text-lg leading-relaxed",
        light ? "text-white/70" : "text-muted-foreground"
      )}>
        {subtitle}
      </p>
    )}
  </div>
);
