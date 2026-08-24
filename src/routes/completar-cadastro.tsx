import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import CompletarCadastro from "@/screens/CompletarCadastro";

export const Route = createFileRoute("/completar-cadastro")({
  head: () => ({
    meta: buildMeta({
      title: "Completar cadastro",
      description: "Finalize seu cadastro na Corporação Assessoria Esportiva.",
      path: "/completar-cadastro",
    }),
  }),
  component: CompletarCadastro,
});
