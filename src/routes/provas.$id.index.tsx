import { createFileRoute } from "@tanstack/react-router";
import ProvaDetalhe from "@/screens/ProvaDetalhe";

export const Route = createFileRoute("/provas/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes da prova — Corporação Running" },
      { name: "description", content: "Informações completas da prova: percurso, kit, valores e inscrição." },
      { property: "og:title", content: "Detalhes da prova — Corporação Running" },
      { property: "og:description", content: "Informações completas da prova: percurso, kit, valores e inscrição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProvaDetalhe,
});
