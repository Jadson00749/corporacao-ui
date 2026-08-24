import { createFileRoute } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import Auth from "@/screens/Auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: buildMeta({
      title: "Entrar",
      description: "Acesse sua conta para gerenciar inscrições e seu perfil.",
      path: "/auth",
    }),
  }),
  component: Auth,
});
