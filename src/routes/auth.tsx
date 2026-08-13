import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/screens/Auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Corporação Running" },
      { name: "description", content: "Acesse sua conta para gerenciar inscrições e seu perfil." },
      { property: "og:title", content: "Entrar — Corporação Running" },
      { property: "og:description", content: "Acesse sua conta para gerenciar inscrições e seu perfil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});
