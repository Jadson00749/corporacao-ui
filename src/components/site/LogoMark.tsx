import logoCorporacao from "@/assets/logo-corporacao.png";
import { cn } from "@/lib/utils";

type LogoMarkProps = {
  className?: string;
  alt?: string;
  /** Adds the entrance reveal animation */
  reveal?: boolean;
  /** Adds the subtle continuous breathing loop */
  breathe?: boolean;
  /** Hover micro-interaction (scale + glow). Default: true */
  interactive?: boolean;
};

/**
 * Brand mark of Corporação Assessoria Esportiva.
 * Shared across header, hero and decorative usages.
 */
export const LogoMark = ({
  className,
  alt = "Corporação Assessoria Esportiva",
  reveal = false,
  breathe = false,
  interactive = true,
}: LogoMarkProps) => {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        interactive && "group/logo",
        className,
      )}
    >
      <img
        src={logoCorporacao}
        alt={alt}
        draggable={false}
        className={cn(
          "block w-full h-full object-contain select-none",
          "transition-[transform,filter] duration-500 ease-out",
          interactive &&
            "group-hover/logo:scale-[1.03] group-hover/logo:translate-y-[-1px] group-hover/logo:[filter:drop-shadow(0_0_18px_hsl(121_100%_59%/0.65))]",
          reveal && "animate-logo-reveal",
          breathe && "animate-breathe",
        )}
      />
    </span>
  );
};
