import { createFileRoute } from "@tanstack/react-router";
import Provas from "@/screens/Provas";

export const Route = createFileRoute("/provas")({
  head: () => ({
    meta: [
      { title: "Provas e corridas — Corporação Running" },
      { name: "description", content: "Provas confirmadas pela equipe, com inscrições e informações de cada percurso." },
      { property: "og:title", content: "Provas e corridas — Corporação Running" },
      { property: "og:description", content: "Provas confirmadas pela equipe, com inscrições e informações de cada percurso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Provas,
});
