import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/screens/admin/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Painel — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});
