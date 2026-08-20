import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt: string;
  /** classes de proporção do quadro, ex: "aspect-[16/9] md:aspect-[21/9]" */
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
  loading?: "lazy" | "eager";
};

/**
 * Moldura de banner que preserva a proporção original da imagem.
 * A imagem aparece inteira (object-contain) sobre um fundo desfocado
 * gerado da própria imagem — evita cortes em banners largos.
 */
export const BannerFrame = ({
  src,
  alt,
  className,
  imgClassName,
  children,
  loading = "lazy",
}: Props) => (
  <div className={cn("relative overflow-hidden bg-[#0b0b0b]", className)}>
    {src && (
      <>
        <img
          src={src}
          alt=""
          aria-hidden
          loading={loading}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
        />
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={cn("relative w-full h-full object-contain", imgClassName)}
        />
      </>
    )}
    {children}
  </div>
);
