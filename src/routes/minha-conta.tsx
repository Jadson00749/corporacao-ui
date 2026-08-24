import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import MinhaConta from "@/screens/MinhaConta";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: buildMeta({
      title: "Área do atleta",
      description: "Gerencie seus dados, treinos, provas e inscrições.",
      path: "/minha-conta",
    }),
  }),
  component: MinhaConta,
});
