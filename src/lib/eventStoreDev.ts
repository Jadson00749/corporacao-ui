/**
 * Loja por prova — feature flags.
 *
 * ADMIN (produção):
 *   Sempre habilitado na UI do editor de provas.
 *   Segurança real = auth + roles + RLS (não esconder UI).
 *
 * PÚBLICO (inscrição):
 *   Somente localhost/DEV + VITE_ENABLE_EVENT_STORE_DEV=true.
 *   Produção NÃO mostra carrinho/produtos na inscrição ainda
 *   (PixPayment ainda não inclui produtos).
 */

export const EVENT_STORE_DEV_ENV = "VITE_ENABLE_EVENT_STORE_DEV";

function isLocalRuntimeAllowed(): boolean {
  if (import.meta.env.DEV === true) return true;
  if (import.meta.env.MODE === "development") return true;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  }
  return false;
}

export function isEventStoreDevEnvOn(): boolean {
  return (
    String(import.meta.env.VITE_ENABLE_EVENT_STORE_DEV ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

/** Admin / organizador — Loja no editor de provas (produção). */
export function isEventStoreAdminEnabled(): boolean {
  return true;
}

/**
 * Catálogo + carrinho visual na inscrição pública.
 * Só localhost/DEV com a env local — nunca em build de produção na Vercel.
 */
export function isEventStorePublicEnabled(): boolean {
  return isLocalRuntimeAllowed() && isEventStoreDevEnvOn();
}

/** @deprecated Use isEventStorePublicEnabled */
export function isEventStoreDevEnabled(): boolean {
  return isEventStorePublicEnabled();
}

export function useEventStoreAdminEnabled(): boolean {
  return isEventStoreAdminEnabled();
}

export function useEventStorePublicEnabled(): boolean {
  return isEventStorePublicEnabled();
}

/** @deprecated Use useEventStorePublicEnabled */
export function useEventStoreDevEnabled(): boolean {
  return isEventStorePublicEnabled();
}
