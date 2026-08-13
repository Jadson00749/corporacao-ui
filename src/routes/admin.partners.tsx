import { createFileRoute } from "@tanstack/react-router";
import AdminPartners from "@/screens/admin/AdminPartners";

export const Route = createFileRoute("/admin/partners")({
  head: () => ({
    meta: [
      { title: "Parceiros — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPartners,
});
