/**
 * Loja por prova — feature flags.
 *
 * ADMIN:
 *   Sempre habilitado na UI do editor de provas.
 *   Segurança real = auth + roles + RLS (não esconder UI).
 *
 * PÚBLICO (inscrição + Produtos da prova + checkout standalone):
 *   Habilitado por padrão em todos os ambientes (incluindo produção).
 *   Kill switch opcional: VITE_ENABLE_EVENT_STORE_PUBLIC=false
 */

/** Kill switch / enable explícito da loja pública. */
export const EVENT_STORE_PUBLIC_ENV = "VITE_ENABLE_EVENT_STORE_PUBLIC";

/** @deprecated Prefer EVENT_STORE_PUBLIC_ENV — mantido por compatibilidade local. */
export const EVENT_STORE_DEV_ENV = "VITE_ENABLE_EVENT_STORE_DEV";

function isPublicEnvDisabled(): boolean {
  const raw = String(import.meta.env.VITE_ENABLE_EVENT_STORE_PUBLIC ?? "true")
    .trim()
    .toLowerCase();
  return raw === "false" || raw === "0" || raw === "off";
}

/** @deprecated Usado só em tooling local legado. */
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
 * Catálogo público + compra avulsa + produtos na inscrição.
 * ON por padrão; desligar com VITE_ENABLE_EVENT_STORE_PUBLIC=false.
 */
export function isEventStorePublicEnabled(): boolean {
  return !isPublicEnvDisabled();
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
