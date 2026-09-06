import { createFileRoute } from "@tanstack/react-router";
import AdminRentalOrders from "@/screens/admin/AdminRentalOrders";

export const Route = createFileRoute("/admin/rental-orders")({
  head: () => ({
    meta: [
      { title: "Pedidos de Locação — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRentalOrders,
});
