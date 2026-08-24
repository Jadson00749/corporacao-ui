import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Treinos from "@/screens/Treinos";

export const Route = createFileRoute("/treinos")({
  head: () => ({
    meta: buildMeta({
      title: "Treinos coletivos",
      description: "Confira os treinos coletivos da semana, horários e pontos de encontro.",
      path: "/treinos",
    }),
  }),
  component: Treinos,
});
