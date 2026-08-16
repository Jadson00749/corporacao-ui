import { isValidCPF, onlyDigits } from "@/lib/cpf";

/** Campos mínimos exigidos para inscrição em provas. */
export const isProfileComplete = (p: Record<string, any> | null | undefined) => {
  if (!p) return false;
  const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return (
    filled(p.full_name) &&
    isValidCPF(p.cpf || "") &&
    filled(p.birth_date) &&
    onlyDigits(p.whatsapp || "").length >= 10 &&
    onlyDigits(p.cep || "").length === 8 &&
    filled(p.street) &&
    filled(p.number) &&
    filled(p.neighborhood) &&
    filled(p.city) &&
    (p.state || "").length === 2
  );
};
