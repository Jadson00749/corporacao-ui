/** Capacidade da prova (events.max_slots) — pendente+confirmada ocupam vaga. */

export type EventCapacityStatus = {
  max_slots: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  is_full: boolean;
};

export const parseEventCapacityStatus = (raw: unknown): EventCapacityStatus | null => {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const maxRaw = r.max_slots;
  const max =
    maxRaw == null || maxRaw === ""
      ? null
      : Number.isFinite(Number(maxRaw))
        ? Math.floor(Number(maxRaw))
        : null;
  const used = Math.max(0, Math.floor(Number(r.used) || 0));
  const unlimited = r.unlimited === true || max == null || max <= 0;
  const remaining = unlimited
    ? null
    : r.remaining == null
      ? Math.max((max as number) - used, 0)
      : Math.max(0, Math.floor(Number(r.remaining) || 0));
  const is_full = unlimited ? false : r.is_full === true || used >= (max as number);
  return {
    max_slots: unlimited ? null : max,
    used,
    remaining,
    unlimited,
    is_full,
  };
};

/** Mensagem amigável para o atleta quando a prova lotou no submit. */
export const eventCapacityErrorMessage = (err: unknown): string | null => {
  const msg = String((err as any)?.message || err || "");
  if (/Limite de inscrições desta prova atingido/i.test(msg)) {
    return "As vagas desta prova acabaram agora.";
  }
  return null;
};

/** Mensagens administrativas ao salvar max_slots. */
export const adminEventCapacitySaveErrorMessage = (err: unknown): string | null => {
  const msg = String((err as any)?.message || err || "");
  if (/inscrições ativas/i.test(msg) && /não pode ser menor/i.test(msg)) {
    return msg;
  }
  return null;
};
