/**
 * Loja por prova — MOCK visual (localhost only).
 *
 * Ativo quando:
 *   ambiente de desenvolvimento (ou hostname local)
 *   E query ?storeMock=1 na URL do browser
 *
 * Em hosts de produção a aba nunca aparece.
 *
 * NÃO memoizar o resultado com deps só do router: o TanStack pode omitir
 * params não declarados em searchStr, e um useMemo(false) fica preso.
 * Fonte de verdade: window.location.search, lida a cada render.
 */
import { useLocation, useSearchParams } from "@/lib/router-compat";

export const STORE_MOCK_PARAM = "storeMock";
export const STORE_MOCK_VALUE = "1";

function paramsHaveStoreMock(params: URLSearchParams | null | undefined): boolean {
  return params?.get(STORE_MOCK_PARAM) === STORE_MOCK_VALUE;
}

function parseSearch(raw: string | null | undefined): URLSearchParams {
  const s = String(raw ?? "");
  const q = s.startsWith("?") ? s.slice(1) : s;
  return new URLSearchParams(q);
}

/** Dev Vite OU localhost — nunca em domínio de produção. */
function isMockRuntimeAllowed(): boolean {
  if (import.meta.env.DEV === true) return true;
  if (import.meta.env.MODE === "development") return true;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  }
  return false;
}

export function isStoreMockEnabled(
  search?: string | URLSearchParams | null,
): boolean {
  if (!isMockRuntimeAllowed()) return false;
  if (search instanceof URLSearchParams) {
    return paramsHaveStoreMock(search);
  }
  if (typeof search === "string") {
    return paramsHaveStoreMock(parseSearch(search));
  }
  if (typeof window !== "undefined") {
    return paramsHaveStoreMock(parseSearch(window.location.search));
  }
  return false;
}

/**
 * Hook reativo. Assina o router para re-render em navegação,
 * mas o valor vem de window.location.search (sem useMemo).
 */
export function useStoreMockEnabled(): boolean {
  // Assinaturas — forçam re-render se a location do router mudar
  useSearchParams();
  useLocation();

  if (!isMockRuntimeAllowed()) return false;

  if (typeof window !== "undefined") {
    return paramsHaveStoreMock(parseSearch(window.location.search));
  }

  return false;
}

export function withStoreMockQuery(path: string): string {
  if (!isMockRuntimeAllowed()) return path;
  const [base, hash = ""] = path.split("#");
  const [pathname, qs = ""] = base.split("?");
  const usp = new URLSearchParams(qs);
  usp.set(STORE_MOCK_PARAM, STORE_MOCK_VALUE);
  const next = usp.toString();
  return `${pathname}?${next}${hash ? `#${hash}` : ""}`;
}
