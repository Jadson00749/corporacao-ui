import { useEffect, useRef } from "react";
import {
  clearSessionKey,
  readSessionEnvelope,
  writeSessionEnvelope,
} from "@/lib/sessionDraft";

type Args<T> = {
  /** null/undefined desliga persistência */
  key: string | null | undefined;
  value: T | null | undefined;
  enabled?: boolean;
  debounceMs?: number;
};

/**
 * Autosave debounce de `value` em sessionStorage.
 * Não restaura — a restauração fica no open/init do formulário.
 * No unmount, faz flush imediato do valor atual.
 */
export function useSessionDraft<T>({
  key,
  value,
  enabled = true,
  debounceMs = 400,
}: Args<T>) {
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!enabled || !key || value == null) return;
    const t = window.setTimeout(() => {
      writeSessionEnvelope(key, value);
    }, debounceMs);
    return () => {
      window.clearTimeout(t);
      if (valueRef.current != null) {
        writeSessionEnvelope(key, valueRef.current);
      }
    };
  }, [key, value, enabled, debounceMs]);

  return {
    clear: () => {
      if (key) clearSessionKey(key);
    },
    read: () => (key ? readSessionEnvelope<T>(key)?.data ?? null : null),
  };
}

/** Lê draft uma vez (fora do ciclo de render do form). */
export function loadSessionDraftData<T>(key: string): T | null {
  return readSessionEnvelope<T>(key)?.data ?? null;
}
