import { createFileRoute } from "@tanstack/react-router";
import AdminRentalItems from "@/screens/admin/AdminRentalItems";

export const Route = createFileRoute("/admin/rental-items")({
  head: () => ({
    meta: [
      { title: "Estruturas — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRentalItems,
});
