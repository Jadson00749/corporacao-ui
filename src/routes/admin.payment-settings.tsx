import { createFileRoute } from "@tanstack/react-router";
import OrganizerPaymentSettings from "@/screens/admin/OrganizerPaymentSettings";

export const Route = createFileRoute("/admin/payment-settings")({
  head: () => ({
    meta: [
      { title: "Dados de pagamento — Corporação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrganizerPaymentSettings,
});
