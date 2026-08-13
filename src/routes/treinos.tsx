import { createFileRoute } from "@tanstack/react-router";
import Treinos from "@/screens/Treinos";

export const Route = createFileRoute("/treinos")({
  head: () => ({
    meta: [
      { title: "Treinos coletivos — Corporação Running" },
      { name: "description", content: "Confira os treinos coletivos da semana, horários e pontos de encontro." },
      { property: "og:title", content: "Treinos coletivos — Corporação Running" },
      { property: "og:description", content: "Confira os treinos coletivos da semana, horários e pontos de encontro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Treinos,
});
