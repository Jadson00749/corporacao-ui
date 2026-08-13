import { z } from "zod";
import { isValidCPF, onlyDigits } from "@/lib/cpf";

const baseProfileShape = {
  full_name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido"),
  birth_date: z.string().min(1, "Informe a data de nascimento"),
  gender: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  whatsapp: z.string().refine((v) => onlyDigits(v).length >= 10, "Informe um celular válido"),
  email: z.string().trim().email("E-mail inválido").max(255),
  cep: z.string().refine((v) => onlyDigits(v).length === 8, "CEP inválido"),
  street: z.string().trim().min(2, "Informe a rua"),
  number: z.string().trim().min(1, "Informe o número"),
  complement: z.string().optional().default(""),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  city: z.string().trim().min(2, "Informe a cidade"),
  state: z.string().length(2, "Selecione o estado"),
  team_name: z.string().optional().default(""),
  accepts_marketing: z.boolean().optional().default(false),
};

export const signupSchema = z.object({
  ...baseProfileShape,
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
  accepted_terms: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar as políticas." }),
  }),
});

export const profileSchema = z.object(baseProfileShape);

export type SignupValues = z.infer<typeof signupSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
