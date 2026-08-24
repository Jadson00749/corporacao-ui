import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import ProvaDetalhe from "@/screens/ProvaDetalhe";

export const Route = createFileRoute("/provas/$id/")({
  head: () => ({
    meta: buildMeta({
      title: "Detalhes da prova",
      description: "Informações completas da prova: percurso, kit, valores e inscrição.",
      path: "/provas",
    }),
  }),
  component: ProvaDetalhe,
});
