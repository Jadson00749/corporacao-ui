import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Agenda from "@/screens/Agenda";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: buildMeta({
      title: "Agenda",
      description: "Calendário com todos os treinos e provas do mês.",
      path: "/agenda",
    }),
  }),
  component: Agenda,
});
