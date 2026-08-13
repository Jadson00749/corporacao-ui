import { createFileRoute } from "@tanstack/react-router";
import Produtos from "@/screens/Produtos";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Corporação Running" },
      { name: "description", content: "Camisetas, acessórios e produtos oficiais da equipe." },
      { property: "og:title", content: "Produtos — Corporação Running" },
      { property: "og:description", content: "Camisetas, acessórios e produtos oficiais da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Produtos,
});
