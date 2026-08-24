import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Index from "@/screens/Index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: buildMeta({
      title: "Treinos, provas e planos",
      description: "Assessoria de corrida: planos de treino, provas, agenda e produtos da Corporação.",
      path: "/",
    }),
  }),
  component: Index,
});
