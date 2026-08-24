import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Contato from "@/screens/Contato";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: buildMeta({
      title: "Contato",
      description: "Fale com a equipe e tire suas dúvidas sobre treinos e planos.",
      path: "/contato",
    }),
  }),
  component: Contato,
});
