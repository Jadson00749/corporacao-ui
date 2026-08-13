// ============================================================
// PLANOS / PACOTES
// Adicione, remova ou edite planos livremente.
// ============================================================

export type PlanCategory = "corrida" | "fortalecimento" | "completo";

export const PLAN_CATEGORIES: { value: PlanCategory; label: string }[] = [
  { value: "corrida", label: "Corrida" },
  { value: "fortalecimento", label: "Fortalecimento" },
  { value: "completo", label: "Completo" },
];

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  price?: string;
  priceNote?: string;
  priceInstallments?: string;
  footerNote?: string;
  highlight?: boolean;
  features: string[];
  ctaMessage: string;
  categories: PlanCategory[];
};

export const plans: Plan[] = [
  {
    id: "start",
    name: "Start",
    tagline: "Para quem está começando agora",
    price: "R$ 149",
    priceNote: "/mês",
    features: [
      "Planilha personalizada semanal",
      "Avaliação inicial completa",
      "Treinos em grupo 2x por semana",
      "Suporte via WhatsApp",
      "Acesso à comunidade PACE",
      "Acesso a benefícios exclusivos em produtos esportivos",
    ],
    ctaMessage: "Olá! Tenho interesse no plano Start da PACE.",
    categories: ["corrida"],
  },
  {
    id: "performance",
    name: "Performance",
    tagline: "Evolua e bata novas metas",
    price: "R$ 249",
    priceNote: "/mês",
    highlight: true,
    features: [
      "Planilha personalizada com periodização",
      "Treinos em grupo ilimitados",
      "Avaliação física trimestral",
      "Acompanhamento de pace e zonas",
      "Acesso ao app de treinos",
      "Suporte prioritário",
      "Acesso a benefícios exclusivos em produtos esportivos",
    ],
    ctaMessage: "Olá! Tenho interesse no plano Performance da PACE.",
    categories: ["corrida", "completo"],
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Foco total em provas e resultado",
    price: "R$ 399",
    priceNote: "/mês",
    features: [
      "Tudo do plano Performance",
      "Consultoria individual mensal",
      "Plano específico para sua prova-alvo",
      "Acompanhamento nutricional básico",
      "Análise de vídeo da técnica",
      "Day-of-race com a equipe",
      "Acesso a benefícios exclusivos em produtos esportivos",
    ],
    ctaMessage: "Olá! Tenho interesse no plano Elite da PACE.",
    categories: ["completo", "fortalecimento"],
  },
];
