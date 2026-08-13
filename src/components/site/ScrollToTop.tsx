import { useEffect } from "react";
import { useLocation } from "@/lib/router-compat";

/**
 * Garante que cada navegação entre rotas começa no topo da página.
 * Preserva a posição quando o usuário usa voltar/avançar do navegador.
 */
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // permite âncoras dentro da página
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
};
