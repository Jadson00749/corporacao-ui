import { createFileRoute } from "@tanstack/react-router";
import Planos from "@/screens/Planos";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de treino — Corporação Running" },
      { name: "description", content: "Escolha entre corrida, fortalecimento ou o plano completo com acompanhamento do treinador." },
      { property: "og:title", content: "Planos de treino — Corporação Running" },
      { property: "og:description", content: "Escolha entre corrida, fortalecimento ou o plano completo com acompanhamento do treinador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planos,
});
