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

/** Classes de proporção para o banner na página da prova (mobile → desktop). */
export const bannerAspectClass = (v?: string | null) => {
  switch (normalizeBannerAspect(v)) {
    case "9:16":
      return "aspect-[9/16] sm:aspect-[3/4] lg:aspect-[4/5] max-h-[78vh]";
    case "3:4":
      return "aspect-[3/4] lg:aspect-[4/5] max-h-[78vh]";
    case "1:1":
      return "aspect-square max-h-[78vh]";
    case "16:9":
    default:
      return "aspect-[16/9]";
  }
};

/** Proporção pura (usada em previews do Admin). */
export const bannerRatioStyle = (v?: string | null) => {
  const a = normalizeBannerAspect(v).split(":");
  return { aspectRatio: `${a[0]} / ${a[1]}` };
};
