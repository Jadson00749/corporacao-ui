import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** URL preferencial no desktop (banner_image). */
  src?: string | null;
  /** URL preferencial no mobile; se omitida, usa `src`. */
  mobileSrc?: string | null;
  alt: string;
  /** classes de proporção do quadro, ex: "aspect-[16/9]" */
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
  loading?: "lazy" | "eager";
};

const useIsMdUp = () => {
  const [mdUp, setMdUp] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setMdUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mdUp;
};

/**
 * Moldura de banner que preserva a arte completa.
 * Mesma URL: fundo blur + foreground object-contain (sem 2ª requisição).
 */
export const BannerFrame = ({
  src,
  mobileSrc,
  alt,
  className,
  imgClassName,
  children,
  loading = "lazy",
}: Props) => {
  const mdUp = useIsMdUp();
  const desktop = (src || "").trim();
  const mobile = (mobileSrc || src || "").trim();
  const displaySrc = mdUp ? desktop || mobile : mobile || desktop;

  return (
    <div className={cn("relative overflow-hidden bg-[#0b0b0b]", className)}>
      {displaySrc ? (
        <>
          <img
            src={displaySrc}
            alt=""
            aria-hidden
            loading={loading}
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
          />
          <img
            key={displaySrc}
            src={displaySrc}
            alt={alt}
            loading={loading}
            decoding="async"
            className={cn(
              "relative z-[1] h-full w-full object-contain object-center",
              imgClassName
            )}
          />
        </>
      ) : null}
      {children}
    </div>
  );
};
