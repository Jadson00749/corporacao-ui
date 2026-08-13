import { createFileRoute } from "@tanstack/react-router";
import AdminTrainings from "@/screens/admin/AdminTrainings";

export const Route = createFileRoute("/admin/trainings")({
  head: () => ({
    meta: [
      { title: "Treinos — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTrainings,
});
