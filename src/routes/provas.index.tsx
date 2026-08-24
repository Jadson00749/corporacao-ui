import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Provas from "@/screens/Provas";

export const Route = createFileRoute("/provas/")({
  head: () => ({
    meta: buildMeta({
      title: "Provas e corridas",
      description: "Provas confirmadas pela equipe, com inscrições e informações de cada percurso.",
      path: "/provas",
    }),
  }),
  component: Provas,
});
