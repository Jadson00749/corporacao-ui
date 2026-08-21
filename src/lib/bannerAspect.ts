export type BannerAspect = "9:16" | "3:4" | "1:1" | "16:9";

export const BANNER_ASPECT_OPTIONS: {
  value: BannerAspect;
  label: string;
  hint: string;
  size: string;
  recommended?: boolean;
}[] = [
  {
    value: "9:16",
    label: "9:16",
    hint: "Vertical — recomendado para celular",
    size: "1080 × 1920 px",
    recommended: true,
  },
  { value: "3:4", label: "3:4", hint: "Vertical suave", size: "1080 × 1440 px" },
  { value: "1:1", label: "1:1", hint: "Quadrado", size: "1080 × 1080 px" },
  { value: "16:9", label: "16:9", hint: "Horizontal", size: "1920 × 1080 px" },
];

export const normalizeBannerAspect = (v?: string | null): BannerAspect =>
  (BANNER_ASPECT_OPTIONS.some((o) => o.value === v) ? v : "9:16") as BannerAspect;

/** Classes de proporção do banner NO CELULAR (o formato configurado só vale no mobile). */
export const bannerAspectClass = (v?: string | null) => {
  switch (normalizeBannerAspect(v)) {
    case "9:16":
      return "aspect-[9/16] max-h-[80vh]";
    case "3:4":
      return "aspect-[3/4] max-h-[80vh]";
    case "1:1":
      return "aspect-square";
    case "16:9":
    default:
      return "aspect-[16/9]";
  }
};

/** Banner no desktop: sempre horizontal, com altura limitada. */
export const DESKTOP_BANNER_CLASS = "aspect-[16/9] max-h-[420px] xl:max-h-[480px]";

/** Proporção pura (usada em previews do Admin). */
export const bannerRatioStyle = (v?: string | null) => {
  const a = normalizeBannerAspect(v).split(":");
  return { aspectRatio: `${a[0]} / ${a[1]}` };
};
