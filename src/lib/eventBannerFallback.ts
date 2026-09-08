// Banners fictícios usados quando uma prova ainda não tem imagem cadastrada.
// Escolhe um banner deterministico com base no id da prova para que cada
// card mantenha sempre a mesma imagem.
const FALLBACK_BANNERS = [
  "/banner-prova-exemplo.jpg",
  "/banner-prova-2.jpg",
  "/banner-prova-3.jpg",
  "/banner-prova-4.jpg",
  "/banner-prova-5.jpg",
];

export const getEventBannerFallback = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_BANNERS[hash % FALLBACK_BANNERS.length];
};

/** Campos reais do evento (Admin: banner_image = desktop; banner_mobile_image = mobile). */
export type EventBannerSources = {
  id?: string;
  /** banner_image — arte principal / desktop */
  bannerImage?: string | null;
  /** banner_mobile_image — arte específica mobile */
  bannerMobileImage?: string | null;
  /** image — fallback genérico legado */
  image?: string | null;
};

const firstUrl = (...candidates: Array<string | null | undefined>) => {
  for (const c of candidates) {
    const v = (c || "").trim();
    if (v) return v;
  }
  return "";
};

/**
 * Desktop: banner_image → image → banner_mobile_image → fallback.
 */
export const pickEventBannerDesktop = (s: EventBannerSources) =>
  firstUrl(s.bannerImage, s.image, s.bannerMobileImage) ||
  (s.id ? getEventBannerFallback(s.id) : "");

/**
 * Mobile: banner_mobile_image → banner_image → image → fallback.
 */
export const pickEventBannerMobile = (s: EventBannerSources) =>
  firstUrl(s.bannerMobileImage, s.bannerImage, s.image) ||
  (s.id ? getEventBannerFallback(s.id) : "");
