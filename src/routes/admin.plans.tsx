import { createFileRoute } from "@tanstack/react-router";
import AdminPlans from "@/screens/admin/AdminPlans";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "Planos — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPlans,
});
