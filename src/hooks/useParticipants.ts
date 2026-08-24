import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { onlyDigits } from "@/lib/cpf";

export type Participant = {
  id: string;
  owner_user_id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  relationship: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ParticipantInput = {
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  relationship?: string | null;
};

export const RELATIONSHIP_OPTIONS = [
  "Filho(a)",
  "Cônjuge",
  "Pai/Mãe",
  "Familiar",
  "Amigo(a)",
  "Aluno(a)",
  "Outro",
];

/** Máscara visual de CPF: ***.***.***-32 */
export const maskCpf = (cpf?: string | null) => {
  const d = onlyDigits(cpf || "");
  if (!d) return "";
  return `***.***.***-${d.slice(-2)}`;
};

const db = () => (supabase as any).from("participants");

export const useParticipants = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["participants", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await db()
        .select("*")
        .eq("owner_user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
  });
};

const clean = (input: ParticipantInput) => ({
  full_name: input.full_name.trim(),
  cpf: input.cpf?.trim() ? input.cpf.trim() : null,
  birth_date: input.birth_date || null,
  gender: input.gender || null,
  phone: input.phone?.trim() ? input.phone.trim() : null,
  relationship: input.relationship || null,
});

export const useParticipantMutations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["participants", user?.id] });

  const create = useMutation({
    mutationFn: async (input: ParticipantInput): Promise<Participant> => {
      const { data, error } = await db()
        .insert({ ...clean(input), owner_user_id: user!.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as Participant;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ParticipantInput & { id: string }) => {
      const { error } = await db().update(clean(input)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
};

/** Procura participante já salvo com o mesmo CPF (ou mesmo nome+nascimento). */
export const findExistingParticipant = (
  list: Participant[],
  input: { full_name?: string; cpf?: string | null; birth_date?: string | null }
) => {
  const cpf = onlyDigits(input.cpf || "");
  if (cpf.length === 11) {
    const byCpf = list.find((p) => onlyDigits(p.cpf || "") === cpf);
    if (byCpf) return byCpf;
  }
  const name = (input.full_name || "").trim().toLowerCase();
  if (!name) return undefined;
  return list.find(
    (p) =>
      p.full_name.trim().toLowerCase() === name &&
      (!input.birth_date || !p.birth_date || p.birth_date === input.birth_date)
  );
};
