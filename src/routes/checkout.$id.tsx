import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import ProdutoCheckout from "@/screens/ProdutoCheckout";

export const Route = createFileRoute("/checkout/$id")({
  head: () => ({
    meta: buildMeta({
      title: "Finalizar compra",
      description: "Conclua sua compra com segurança.",
      path: "/produtos",
    }),
  }),
  component: ProdutoCheckout,
});
