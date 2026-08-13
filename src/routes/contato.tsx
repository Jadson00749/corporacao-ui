import { createFileRoute } from "@tanstack/react-router";
import Contato from "@/screens/Contato";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Corporação Running" },
      { name: "description", content: "Fale com a equipe e tire suas dúvidas sobre treinos e planos." },
      { property: "og:title", content: "Contato — Corporação Running" },
      { property: "og:description", content: "Fale com a equipe e tire suas dúvidas sobre treinos e planos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contato,
});
