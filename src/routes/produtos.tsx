import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Produtos from "@/screens/Produtos";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: buildMeta({
      title: "Produtos",
      description: "Camisetas, acessórios e produtos oficiais da equipe.",
      path: "/produtos",
    }),
  }),
  component: Produtos,
});
