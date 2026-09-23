import { createFileRoute } from "@tanstack/react-router";
import AdminStoreOrders from "@/screens/admin/AdminStoreOrders";

export const Route = createFileRoute("/admin/store-orders")({
  head: () => ({
    meta: [
      { title: "Pedidos de produtos — Admin Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminStoreOrders,
});
