/**
 * Data de calendário YYYY-MM-DD (sem regra de nascimento).
 * Não usa `new Date("YYYY-MM-DD")` — evita shift de fuso.
 */

export type DateYmdParseOk = { ok: true; iso: string };
export type DateYmdParseErr = { ok: false; error: string };
export type DateYmdParseResult = DateYmdParseOk | DateYmdParseErr;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const daysInMonth = (y: number, m: number) => {
  if (m === 2 && isLeap(y)) return 29;
  return DAYS_IN_MONTH[m - 1] ?? 0;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Máscara digitável DD/MM/AAAA. */
export function maskDateYmdBR(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const buildIso = (
  year: number,
  month: number,
  day: number,
): DateYmdParseResult => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { ok: false, error: "Data inválida." };
  }
  if (year < 2000 || year > 2100) {
    return { ok: false, error: "Ano inválido." };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "Mês inválido." };
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    return { ok: false, error: "Dia inválido para o mês informado." };
  }
  return { ok: true, iso: `${year}-${pad2(month)}-${pad2(day)}` };
};

/**
 * Aceita YYYY-MM-DD, ISO datetime, DD/MM/AAAA ou 8 dígitos.
 * Vazio → erro (caller trata opcional).
 */
export function parseDateYmdInput(
  raw: string | null | undefined,
): DateYmdParseResult {
  if (raw == null) return { ok: false, error: "Informe a data." };
  const s = String(raw).trim();
  if (!s) return { ok: false, error: "Informe a data." };

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) {
    return buildIso(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const brMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (brMatch) {
    return buildIso(
      Number(brMatch[3]),
      Number(brMatch[2]),
      Number(brMatch[1]),
    );
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) {
    return buildIso(
      Number(digits.slice(4, 8)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(0, 2)),
    );
  }

  if (digits.length > 0 && digits.length < 8) {
    return { ok: false, error: "Data incompleta." };
  }

  return { ok: false, error: "Data inválida." };
}

/** Exibição pt-BR a partir de YYYY-MM-DD (sem new Date). */
export function formatDateYmdBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = parseDateYmdInput(iso);
  if (!parsed.ok) return "";
  const [y, m, d] = parsed.iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Compara YYYY-MM-DD (lexicográfico = cronológico). */
export function compareDateYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
