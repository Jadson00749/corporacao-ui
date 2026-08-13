import { createFileRoute } from "@tanstack/react-router";
import ProvaInscricao from "@/screens/ProvaInscricao";

export const Route = createFileRoute("/provas/$id/inscricao")({
  head: () => ({
    meta: [
      { title: "Inscrição na prova — Corporação Running" },
      { name: "description", content: "Faça sua inscrição na prova com a equipe Corporação." },
      { property: "og:title", content: "Inscrição na prova — Corporação Running" },
      { property: "og:description", content: "Faça sua inscrição na prova com a equipe Corporação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProvaInscricao,
});
