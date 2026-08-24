import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Planos from "@/screens/Planos";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: buildMeta({
      title: "Planos de treino",
      description: "Escolha entre corrida, fortalecimento ou o plano completo com acompanhamento do treinador.",
      path: "/planos",
    }),
  }),
  component: Planos,
});
