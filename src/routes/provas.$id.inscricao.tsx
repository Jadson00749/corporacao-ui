import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import ProvaInscricao from "@/screens/ProvaInscricao";

export const Route = createFileRoute("/provas/$id/inscricao")({
  head: () => ({
    meta: buildMeta({
      title: "Inscrição na prova",
      description: "Faça sua inscrição na prova com a Corporação Assessoria Esportiva.",
      path: "/provas",
    }),
  }),
  component: ProvaInscricao,
});
