/**
 * Normalização segura de data de nascimento.
 *
 * Regras:
 * - Aceita DD/MM/AAAA (legado), YYYY-MM-DD (input type="date" / banco) e ISO datetime.
 * - Nunca usa `new Date("18/05/1977")` (parsing nativo inválido).
 * - Nunca substitui vazio/inválido pela data atual.
 * - Datas impossíveis (ex.: 31/02/2000) são rejeitadas.
 * - Para o seletor nativo mobile, o formulário deve guardar só YYYY-MM-DD (string).
 */

export type BirthDateParseOk = { ok: true; iso: string };
export type BirthDateParseErr = { ok: false; error: string };
export type BirthDateParseResult = BirthDateParseOk | BirthDateParseErr;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const daysInMonth = (y: number, m: number) => {
  if (m === 2 && isLeap(y)) return 29;
  return DAYS_IN_MONTH[m - 1] ?? 0;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Hoje no calendário local (evita toISOString / UTC). Só para atributo max do input. */
export function todayLocalYMD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

/** Monta YYYY-MM-DD só a partir de componentes numéricos validados (sem Date parsing). */
const buildIso = (year: number, month: number, day: number): BirthDateParseResult => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { ok: false, error: "Data de nascimento inválida." };
  }
  if (year < 1900 || year > 2100) {
    return { ok: false, error: "Ano de nascimento inválido." };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "Mês inválido." };
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    return { ok: false, error: "Dia inválido para o mês informado." };
  }

  // Comparação calendário local, sem toISOString (evita shift de fuso).
  const now = new Date();
  const ty = now.getFullYear();
  const tm = now.getMonth() + 1;
  const td = now.getDate();
  if (year > ty || (year === ty && month > tm) || (year === ty && month === tm && day > td)) {
    return { ok: false, error: "Data de nascimento não pode ser no futuro." };
  }

  return { ok: true, iso: `${year}-${pad2(month)}-${pad2(day)}` };
};

/**
 * Converte qualquer entrada aceita em YYYY-MM-DD.
 * Vazio / incompleto / impossível → erro (nunca data atual).
 */
export function parseBirthDateInput(raw: string | null | undefined): BirthDateParseResult {
  if (raw == null) return { ok: false, error: "Informe a data de nascimento." };
  const s = String(raw).trim();
  if (!s) return { ok: false, error: "Informe a data de nascimento." };

  // YYYY-MM-DD ou ISO datetime (1977-05-18T12:00:00.000Z)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) {
    return buildIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // DD/MM/YYYY | DD-MM-YYYY | DD.MM.YYYY (legado / digitação)
  const brMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (brMatch) {
    return buildIso(Number(brMatch[3]), Number(brMatch[2]), Number(brMatch[1]));
  }

  // Apenas dígitos: 18051977
  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) {
    return buildIso(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)));
  }

  if (digits.length > 0 && digits.length < 8) {
    return { ok: false, error: "Data incompleta. Selecione a data de nascimento." };
  }

  return { ok: false, error: "Informe a data de nascimento." };
}

/**
 * Valor seguro para `<input type="date" value={...}>`.
 * Só "" ou YYYY-MM-DD. Nunca inventa a data de hoje.
 */
export function toBirthDateInputValue(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "";
  const parsed = parseBirthDateInput(raw);
  return parsed.ok ? parsed.iso : "";
}

/** Alias: formulário guarda YYYY-MM-DD para o input nativo. */
export function birthDateToFormValue(raw: string | null | undefined): string {
  return toBirthDateInputValue(raw);
}

/** ISO para persistir, ou null se vazio/inválido (sem fallback). */
export function birthDateToISOOrNull(raw: string | null | undefined): string | null {
  const parsed = parseBirthDateInput(raw);
  return parsed.ok ? parsed.iso : null;
}

/** Exige ISO válido; lança Error com mensagem amigável. */
export function requireBirthDateISO(raw: string | null | undefined): string {
  const parsed = parseBirthDateInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.iso;
}

/** Exibição pt-BR a partir de ISO (sem new Date em string ambígua). */
export function formatBirthDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = parseBirthDateInput(iso);
  if (!parsed.ok) return "";
  const [y, m, d] = parsed.iso.split("-");
  return `${d}/${m}/${y}`;
}
