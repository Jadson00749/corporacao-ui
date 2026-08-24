import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCPF, formatPhone } from "@/lib/cpf";
import {
  Participant,
  RELATIONSHIP_OPTIONS,
  maskCpf,
  useParticipantMutations,
  useParticipants,
  findExistingParticipant,
} from "@/hooks/useParticipants";

const formatBirth = (d?: string | null) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "";

type FormState = {
  full_name: string;
  birth_date: string;
  gender: string;
  cpf: string;
  phone: string;
  relationship: string;
};

const EMPTY: FormState = { full_name: "", birth_date: "", gender: "", cpf: "", phone: "", relationship: "" };

export const ParticipantForm = ({
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<FormState>;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (v: FormState) => void;
}) => {
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...initial });
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const submit = () => {
    if (!form.full_name.trim()) return toast.error("Informe o nome completo.");
    if (!form.birth_date) return toast.error("Informe a data de nascimento.");
    if (!form.gender) return toast.error("Selecione o sexo.");
    onSubmit(form);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="pt-name">Nome completo *</Label>
        <Input id="pt-name" className="mt-1" maxLength={160} value={form.full_name}
          onChange={(e) => patch({ full_name: e.target.value })} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pt-birth">Data de nascimento *</Label>
          <Input id="pt-birth" type="date" className="mt-1" value={form.birth_date}
            onChange={(e) => patch({ birth_date: e.target.value })} />
        </div>
        <div>
          <Label>Sexo *</Label>
          <Select value={form.gender} onValueChange={(v) => patch({ gender: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pt-cpf">CPF (opcional)</Label>
          <Input id="pt-cpf" className="mt-1" inputMode="numeric" maxLength={14} value={form.cpf}
            onChange={(e) => patch({ cpf: formatCPF(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="pt-phone">Telefone/WhatsApp (opcional)</Label>
          <Input id="pt-phone" className="mt-1" maxLength={20} value={form.phone}
            onChange={(e) => patch({ phone: formatPhone(e.target.value) })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Quem é essa pessoa? (opcional)</Label>
          <Select value={form.relationship} onValueChange={(v) => patch({ relationship: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} className="min-h-11">Cancelar</Button>
        <Button variant="brand" onClick={submit} disabled={submitting} className="min-h-11">
          {submitting ? "Salvando..." : "Salvar participante"}
        </Button>
      </div>
    </div>
  );
};

export const ParticipantsPanel = () => {
  const { data: participants = [], isLoading } = useParticipants();
  const { create, update, remove } = useParticipantMutations();
  const [editing, setEditing] = useState<Participant | null>(null);
  const [creating, setCreating] = useState(false);
  const [removingItem, setRemovingItem] = useState<Participant | null>(null);

  const handleCreate = async (v: FormState) => {
    const dup = findExistingParticipant(participants, v);
    if (dup) {
      toast.info("Este participante já está salvo em Meus participantes.");
      setCreating(false);
      return;
    }
    try {
      await create.mutateAsync(v);
      toast.success("Participante salvo!");
      setCreating(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    }
  };

  const handleUpdate = async (v: FormState) => {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, ...v });
      toast.success("Participante atualizado!");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível atualizar.");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-xl font-bold">Meus participantes</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre pessoas que você costuma inscrever e economize tempo nas próximas provas.
          </p>
        </div>
        <Button variant="brand" size="sm" className="hidden sm:flex shrink-0" onClick={() => setCreating(true)}>
          + Adicionar participante
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : participants.length === 0 ? (
        <div className="text-center py-10 md:py-14">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold">Você ainda não salvou ninguém.</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Cadastre familiares, amigos ou alunos para tornar suas próximas inscrições mais rápidas.
          </p>
          <Button variant="brand" onClick={() => setCreating(true)}>+ Adicionar participante</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {participants.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
              <p className="font-display text-lg font-bold leading-tight truncate">{p.full_name}</p>
              {p.relationship && <p className="text-sm text-muted-foreground">{p.relationship}</p>}
              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {p.birth_date && <p>Nascimento: {formatBirth(p.birth_date)}</p>}
                {p.cpf && <p>CPF {maskCpf(p.cpf)}</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 min-h-10" onClick={() => setEditing(p)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="min-h-10 text-destructive" onClick={() => setRemovingItem(p)}>
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {participants.length > 0 && (
        <Button variant="outline" className="w-full min-h-11 mt-4 sm:hidden" onClick={() => setCreating(true)}>
          + Adicionar participante
        </Button>
      )}

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar participante</DialogTitle>
            <DialogDescription>Esses dados serão reutilizados nas próximas inscrições.</DialogDescription>
          </DialogHeader>
          {creating && (
            <ParticipantForm submitting={create.isPending} onCancel={() => setCreating(false)} onSubmit={handleCreate} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar participante</DialogTitle>
            <DialogDescription>Inscrições anteriores não são alteradas.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ParticipantForm
              key={editing.id}
              submitting={update.isPending}
              initial={{
                full_name: editing.full_name,
                birth_date: editing.birth_date || "",
                gender: editing.gender || "",
                cpf: editing.cpf || "",
                phone: editing.phone || "",
                relationship: editing.relationship || "",
              }}
              onCancel={() => setEditing(null)}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removingItem} onOpenChange={(o) => !o && setRemovingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este participante?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove apenas o cadastro salvo para futuras inscrições. Inscrições anteriores não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removingItem) return;
                try {
                  await remove.mutateAsync(removingItem.id);
                  toast.success("Participante removido.");
                } catch (e: any) {
                  toast.error(e?.message || "Não foi possível remover.");
                }
                setRemovingItem(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ParticipantsPanel;
