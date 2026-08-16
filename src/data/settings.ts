// ============================================================
// CONFIGURAÇÕES GLOBAIS DO SITE (fallback estático)
// Os valores oficiais ficam no banco e podem ser editados em /admin.
// ============================================================

export const siteSettings = {
  brand: {
    name: "Corporação Assessoria Esportiva",
    short: "Corporação",
    slogan: "Treine com propósito. Corra com a tribo.",
    description:
      "Corporação Assessoria Esportiva: treinos personalizados, comunidade forte e resultados reais. Da primeira corrida à sua próxima maratona.",
  },

  contact: {
    whatsapp: "5511999999999",
    whatsappDisplay: "(11) 99999-9999",
    email: "contato@corporacaoassessoria.com.br",
    instagram: "https://instagram.com/corporacaoassessoria",
    instagramHandle: "@corporacaoassessoria",
    strava: "https://strava.com/clubs/corporacaoassessoria",
    region: "São Paulo - Capital e Zona Sul",
  },

  hero: {
    eyebrow: "TREINO EM GRUPO • CORRIDA & EVOLUÇÃO",
    title: "Você não treina sozinho.",
    titleAccent: "Tem um time com você.",
    subtitle:
      "Treino em grupo, musculação integrada e acompanhamento de verdade para transformar sua rotina em resultado.",

    primaryCta: "Quero fazer parte",
    secondaryCta: "Conhecer planos",
    image: "",
    stats: [
      { value: "500+", label: "atletas já passaram pela assessoria" },
      { value: "8", label: "anos orientando corredores" },
      { value: "200+", label: "provas mapeadas na região" },
    ],
  },

  cta: {
    finalTitle: "Pronto para a sua próxima passada?",
    finalSubtitle:
      "Agende uma avaliação gratuita e descubra como é ter uma planilha feita pra você, com coach acompanhando cada treino.",
    finalButton: "Agendar avaliação gratuita",
  },

  productPayment: {
    pixKey: "",
    pixRecipient: "",
    instructions: "",
  },

  homeBenefitImages: ["", "", "", "", "", ""],

  images: {
    homeIntro: "/__l5e/assets-v1/c35e59aa-3c12-41b2-aff5-edce0fec2495/quem-somos-duo.jpg",
    homeTeamAvatars: ["", "", "", ""] as string[],
    sobreCoach1: "",
    sobreCoach2: "",
    sobreMain: "",
    sobreGallery: ["", "", ""] as string[],
    sobreRaces: "",
    contato: "",
    welcome: "",
    pathways: ["", "", ""] as string[],
    trainingPeaksHero: "",
    trainingPeaksApp: "",
  },

  trainings: {
    // Proporção padrão dos banners dos cards de treino.
    // Padrão: 9/16 (foto vertical estilo story). Outros: "1/1", "16/10".
    bannerAspect: "9/16",
  },
};

export const whatsappLink = (message?: string) => {
  const base = `https://wa.me/${siteSettings.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
