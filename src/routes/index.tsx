import { createFileRoute } from "@tanstack/react-router";
import Index from "@/screens/Index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corporação Running — Treinos, provas e planos" },
      { name: "description", content: "Assessoria de corrida: planos de treino, provas, agenda e produtos da Corporação." },
      { property: "og:title", content: "Corporação Running — Treinos, provas e planos" },
      { property: "og:description", content: "Assessoria de corrida: planos de treino, provas, agenda e produtos da Corporação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
