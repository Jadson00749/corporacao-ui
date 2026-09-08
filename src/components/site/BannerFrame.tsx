import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** URL preferencial no desktop (banner_image). */
  src?: string | null;
  /** URL preferencial no mobile; se omitida, usa `src`. */
  mobileSrc?: string | null;
  alt: string;
  /** classes de proporção do quadro, ex: "aspect-[16/9] md:aspect-[21/9]" */
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
 * Moldura de banner que preserva a proporção original da imagem.
 * Mobile: um único <img> + fundo sólido (sem 2ª requisição).
 * Desktop: imagem inteira (object-contain por padrão) sobre blur da própria foto.
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
      {displaySrc && (
        <>
          {mdUp && (
            <img
              src={displaySrc}
              alt=""
              aria-hidden
              loading={loading}
              decoding="async"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
            />
          )}
          <img
            key={displaySrc}
            src={displaySrc}
            alt={alt}
            loading={loading}
            decoding="async"
            className={cn(
              "relative h-full w-full",
              mdUp ? "object-contain" : "object-cover",
              imgClassName
            )}
          />
        </>
      )}
      {children}
    </div>
  );
};
