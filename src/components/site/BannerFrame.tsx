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
  /**
   * contain = arte completa (padrão).
   * cover = preenche o quadro com crop elegante (listagens mobile).
   */
  fit?: "contain" | "cover";
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
 * Moldura de banner.
 * contain: arte completa sobre blur (padrão).
 * cover: preenche o quadro sem deformar (crop central).
 */
export const BannerFrame = ({
  src,
  mobileSrc,
  alt,
  className,
  imgClassName,
  fit = "contain",
  children,
  loading = "lazy",
}: Props) => {
  const mdUp = useIsMdUp();
  const desktop = (src || "").trim();
  const mobile = (mobileSrc || src || "").trim();
  const displaySrc = mdUp ? desktop || mobile : mobile || desktop;
  const useCover = fit === "cover";

  return (
    <div className={cn("relative overflow-hidden bg-[#0b0b0b]", className)}>
      {displaySrc ? (
        <>
          {!useCover ? (
            <img
              src={displaySrc}
              alt=""
              aria-hidden
              loading={loading}
              decoding="async"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
            />
          ) : null}
          <img
            key={displaySrc}
            src={displaySrc}
            alt={alt}
            loading={loading}
            decoding="async"
            className={cn(
              "relative z-[1] h-full w-full object-center",
              useCover ? "object-cover" : "object-contain",
              imgClassName,
            )}
          />
        </>
      ) : null}
      {children}
    </div>
  );
};
