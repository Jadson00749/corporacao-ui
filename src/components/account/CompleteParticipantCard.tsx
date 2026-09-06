import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ParticipantForm, type FormState } from "@/components/account/ParticipantsPanel";
import {
  findExistingParticipant,
  useParticipantMutations,
  useParticipants,
} from "@/hooks/useParticipants";
import { incompleteKidsSignups, kidsBracketLabel } from "@/lib/participantCompletion";
import { sportAgeAtEvent } from "@/lib/eventPricing";
import type { EventSignup } from "@/hooks/useProfile";

/**
 * Pede ao titular os dados do participante nas inscrições Kids antigas.
 * Reaproveita o formulário e a tabela de "Meus participantes" para não criar
 * um segundo fluxo de cadastro.
 */
export const CompleteParticipantCard = ({
  signups,
  onSaved,
}: {
  signups: EventSignup[];
  onSaved: () => void;
}) => {
  const { user } = useAuth();
  const { data: participants = [] } = useParticipants();
  const { create, update } = useParticipantMutations();
  const [target, setTarget] = useState<EventSignup | null>(null);
  const [saving, setSaving] = useState(false);

  const pending = useMemo(() => incompleteKidsSignups(signups), [signups]);
  if (!pending.length) return null;

  /** Aproveita o que a inscrição já tem e completa com o participante salvo de mesmo nome. */
  const initialFor = (s: EventSignup): Partial<FormState> => {
    const saved = findExistingParticipant(participants, {
      full_name: s.participant_full_name || "",
      cpf: s.participant_cpf,
      birth_date: s.participant_birth_date,
    });
    return {
      full_name: s.participant_full_name || saved?.full_name || "",
      birth_date: s.participant_birth_date || saved?.birth_date || "",
      gender: s.participant_gender || saved?.gender || "",
      cpf: s.participant_cpf || saved?.cpf || "",
      phone: s.participant_phone || saved?.phone || "",
      relationship: saved?.relationship || "",
    };
  };

  const save = async (v: FormState) => {
    if (!target || !user) return;
    setSaving(true);

    // Somente os campos do participante. Status, valores e pagamento não entram
    // no update, e user_id continua sendo o titular que fez a inscrição.
    const patch: Record<string, string | null> = {
      participant_full_name: v.full_name.trim(),
      participant_birth_date: v.birth_date || null,
      participant_gender: v.gender || null,
    };
    if (v.cpf.trim()) patch.participant_cpf = v.cpf.trim();
    if (v.phone.trim()) patch.participant_phone = v.phone.trim();

    const { error } = await supabase
      .from("event_signups")
      .update(patch as any)
      .eq("id", target.id)
      .eq("user_id", user.id);

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Espelha em "Meus participantes", completando o cadastro existente em vez
    // de duplicar. Falha aqui não invalida o que já foi gravado na inscrição.
    try {
      const dup = findExistingParticipant(participants, v);
      if (dup) {
        await update.mutateAsync({
          id: dup.id,
          full_name: v.full_name || dup.full_name,
          birth_date: v.birth_date || dup.birth_date,
          gender: v.gender || dup.gender,
          cpf: v.cpf || dup.cpf,
          phone: v.phone || dup.phone,
          relationship: v.relationship || dup.relationship,
        });
      } else {
        await create.mutateAsync(v);
      }
    } catch {
      /* cadastro reutilizável é conveniência, não requisito */
    }

    const bracket = kidsBracketLabel(sportAgeAtEvent(v.birth_date, target.events?.date));
    setSaving(false);
    setTarget(null);
    toast.success(bracket ? `Dados salvos. Categoria Kids: ${bracket}.` : "Dados do participante salvos.");
    onSaved();
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Complete os dados do participante</p>
            <p className="text-xs text-muted-foreground leading-tight">
              Precisamos de algumas informações para classificar corretamente a inscrição na
              Corrida Kids.
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {pending.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.events?.name || "Prova"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.participant_full_name
                    ? `Falta a data de nascimento de ${s.participant_full_name}`
                    : "Falta informar quem vai participar"}
                </p>
              </div>
              <Button size="sm" variant="brand" className="shrink-0" onClick={() => setTarget(s)}>
                Completar dados
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados do participante</DialogTitle>
            <DialogDescription>
              {target?.events?.name
                ? `Quem vai participar da ${target.events.name}. A idade na data da prova define a faixa Kids.`
                : "A idade na data da prova define a faixa Kids."}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <ParticipantForm
              key={target.id}
              initial={initialFor(target)}
              submitting={saving}
              onCancel={() => setTarget(null)}
              onSubmit={save}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompleteParticipantCard;
