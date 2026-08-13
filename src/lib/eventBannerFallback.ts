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
