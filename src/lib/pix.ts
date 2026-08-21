/**
 * Geração de payload PIX estático (BR Code / EMV MPM) conforme o padrão do Banco Central.
 * Nenhuma integração bancária: apenas monta a string e o CRC16-CCITT (0x1021, init 0xFFFF).
 */

const sanitize = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, "")
    .trim()
    .slice(0, max)
    .trim();

const tag = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

export const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

/** Normaliza a chave PIX (remove máscaras de CPF/CNPJ e telefone). */
export const normalizePixKey = (raw: string) => {
  const key = (raw || "").trim();
  if (!key) return "";
  if (key.includes("@")) return key.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase();
  const digits = key.replace(/\D/g, "");
  if (!digits) return key;
  if (key.startsWith("+") || digits.length === 12 || digits.length === 13) return `+${digits}`;
  if (digits.length === 10) return `+55${digits}`;
  if (digits.length === 11) return /^\d{2}9/.test(digits) && /[()\s-]/.test(key) ? `+55${digits}` : digits;
  return digits.length === 14 ? digits : key;
};

export type PixPayloadInput = {
  key: string;
  amount?: number | null;
  recipient?: string | null;
  city?: string | null;
  txid?: string | null;
  description?: string | null;
};

export const buildPixPayload = ({
  key,
  amount,
  recipient,
  city,
  txid,
}: PixPayloadInput): string => {
  const pixKey = normalizePixKey(key);
  if (!pixKey) return "";

  const merchantAccount = tag("00", "br.gov.bcb.pix") + tag("01", pixKey);

  const name = sanitize(recipient || "RECEBEDOR", 25) || "RECEBEDOR";
  const town = sanitize(city || "BRASIL", 15).toUpperCase() || "BRASIL";
  const ref = sanitize((txid || "***").toUpperCase().replace(/[^A-Z0-9*]/g, ""), 25) || "***";

  let payload =
    tag("00", "01") +
    tag("01", "11") + // QR estático reutilizável
    tag("26", merchantAccount) +
    tag("52", "0000") +
    tag("53", "986");

  if (amount && amount > 0) payload += tag("54", amount.toFixed(2));

  payload +=
    tag("58", "BR") +
    tag("59", name) +
    tag("60", town) +
    tag("62", tag("05", ref)) +
    "6304";

  return payload + crc16(payload);
};
