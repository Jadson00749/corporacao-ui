/**
 * Persistência leve em sessionStorage (filtros UI + rascunhos de formulário).
 * Envelope comum: { version, updatedAt, data }
 */

export type SessionEnvelope<T> = {
  version: 1;
  updatedAt: string;
  data: T;
};

export function readSessionEnvelope<T>(key: string): SessionEnvelope<T> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionEnvelope<T>;
    if (!parsed || parsed.version !== 1 || parsed.data == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionEnvelope<T>(key: string, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const safe = JSON.parse(JSON.stringify(data)) as T;
    const envelope: SessionEnvelope<T> = {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: safe,
    };
    sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // quota / circular — ignora silenciosamente
  }
}

export function clearSessionKey(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function peekSessionDraft(key: string): boolean {
  return readSessionEnvelope(key) != null;
}

/** Chaves de rascunho de formulário */
export const eventDraftKey = (id?: string | null) =>
  id ? `admin:event-draft:${id}` : "admin:event-draft:new";

export const EVENT_DRAFT_ACTIVE_KEY = "admin:event-draft:active";

export const trainingDraftKey = (id?: string | null) =>
  id ? `admin:training-draft:${id}` : "admin:training-draft:new";

export const TRAINING_DRAFT_ACTIVE_KEY = "admin:training-draft:active";

export type ActiveDraftPointer = {
  kind: "new" | "edit";
  id?: string | null;
};

export const SIGNUPS_UI_SESSION_KEY = "admin:event-signups:ui";

export type SignupsUiSession = {
  tab?: "inscricoes" | "pagamentos";
  search?: string;
  eventFilter?: string;
  statusFilter?: string;
  genderFilter?: "all" | "F" | "M" | "kids";
  ownership?: "all" | "corp" | "external";
  orgFilter?: string;
  page?: number;
  pageSize?: number;
  payments?: {
    search?: string;
    eventFilter?: string;
    statusFilter?: string;
    originFilter?: string;
    ownership?: "all" | "corp" | "external";
    orgFilter?: string;
  };
};

export function readSignupsUiSession(): SignupsUiSession | null {
  return readSessionEnvelope<SignupsUiSession>(SIGNUPS_UI_SESSION_KEY)?.data ?? null;
}

export function writeSignupsUiSession(data: SignupsUiSession): void {
  writeSessionEnvelope(SIGNUPS_UI_SESSION_KEY, data);
}
