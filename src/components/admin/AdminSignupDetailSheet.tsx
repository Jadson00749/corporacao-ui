import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ParticipantForm, type FormState } from "@/components/account/ParticipantsPanel";
import { BirthDateInput } from "@/components/account/BirthDateInput";
import {
  buildKidsParticipantPatch,
  needsParticipantData,
} from "@/lib/participantCompletion";
import { getSignupStatusInfo } from "@/lib/signupOperationalStatus";
import { cn } from "@/lib/utils";
import {
  ageAtEvent,
  isKidsCategory,
  kidsBracketFor,
  kidsCategoryForAge,
} from "@/lib/eventPricing";
import { formatBirthDateBR, parseBirthDateInput, toBirthDateInputValue } from "@/lib/birthDate";
import { formatCPF, formatPhone } from "@/lib/cpf";

export type AdminSignupDetailRow = {
  id: string;
  category: string;
  status: string;
  notes: string;
  created_at: string;
  user_id: string;
  event_id: string;
  kit_option: string;
  shirt_size: string | null;
  coupon_code: string;
  team_name: string;
  participant_full_name?: string | null;
  participant_cpf?: string | null;
  participant_birth_date?: string | null;
  participant_gender?: string | null;
  participant_phone?: string | null;
  events: { id: string; name: string; date: string; city: string } | null;
  profiles: {
    full_name: string;
    cpf: string;
    email: string;
    whatsapp: string;
    team_name: string;
    city: string;
    state: string;
    gender: string;
    birth_date?: string | null;
  } | null;
};

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG", "XG", "XGG"];

const dash = (v?: string | null) => {
  const t = (v || "").trim();
  return t || "—";
};

const formatKit = (value: string) => {
  if (!value) return "—";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ") || "—";
  } catch {
    /* texto simples */
  }
  return value;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm break-words">{value}</dd>
  </div>
);

type EditDraft = {
  name: string;
  cpf: string;
  birth: string;
  gender: string;
  phone: string;
  shirtSize: string;
};

const draftFrom = (s: AdminSignupDetailRow): EditDraft => ({
  name: s.participant_full_name || "",
  cpf: s.participant_cpf || "",
  birth: toBirthDateInputValue(s.participant_birth_date),
  gender: s.participant_gender || "",
  phone: s.participant_phone || "",
  shirtSize: (s.shirt_size || "").toUpperCase(),
});

export type AdminSignupSavedOpts = {
  closeSheet?: boolean;
  patch?: Partial<AdminSignupDetailRow>;
};

type Props = {
  signup: AdminSignupDetailRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (opts?: AdminSignupSavedOpts) => void;
};

/**
 * Detalhe da inscrição no Admin + completar Kids histórico + editar participante.
 * participant_* = atleta; profiles = responsável. Não altera user_id.
 */
export const AdminSignupDetailSheet = ({ signup, open, onOpenChange, onSaved }: Props) => {
  const [completing, setCompleting] = useState(false);
  const [pending, setPending] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [localPatch, setLocalPatch] = useState<Partial<AdminSignupDetailRow> | null>(null);

  const row = signup ? { ...signup, ...localPatch } : null;

  useEffect(() => {
    if (!open || !signup) {
      setEditing(false);
      setDraft(null);
      setConfirmEdit(false);
      setLocalPatch(null);
      setCompleting(false);
      setPending(null);
      return;
    }
    setLocalPatch(null);
    setEditing(false);
    setDraft(null);
    setConfirmEdit(false);
  }, [open, signup?.id]);

  const incompleteKids = row ? needsParticipantData(row) : false;
  const isKids = row ? isKidsCategory(row.category) : false;

  const participantAge = useMemo(() => {
    if (!row?.participant_birth_date) return null;
    return ageAtEvent(row.participant_birth_date, row.events?.date);
  }, [row]);

  const editAge = useMemo(() => {
    if (!draft?.birth || !row) return null;
    return ageAtEvent(draft.birth, row.events?.date);
  }, [draft?.birth, row]);

  const editKidsBracket = useMemo(() => kidsBracketFor(editAge), [editAge]);

  const pendingBracket = useMemo(() => {
    if (!pending || !row) return null;
    return kidsBracketFor(ageAtEvent(pending.birth_date, row.events?.date));
  }, [pending, row]);

  const closeAll = () => {
    setCompleting(false);
    setPending(null);
    setEditing(false);
    setDraft(null);
    setConfirmEdit(false);
    onOpenChange(false);
  };

  const startEdit = () => {
    if (!row) return;
    setDraft(draftFrom(row));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
    setConfirmEdit(false);
  };

  const requestSaveEdit = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Informe o nome do participante.");
      return;
    }
    if (draft.birth) {
      const parsed = parseBirthDateInput(draft.birth);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
    }
    if (isKids && draft.birth) {
      const age = ageAtEvent(draft.birth, row?.events?.date);
      if (!kidsCategoryForAge(age)) {
        toast.error("Idade fora das baterias Kids (2 a 13 anos na data da prova).");
        return;
      }
    }
    setConfirmEdit(true);
  };

  const saveEdit = async () => {
    if (!row || !draft) return;
    const birthParsed = draft.birth ? parseBirthDateInput(draft.birth) : null;
    if (draft.birth && birthParsed && !birthParsed.ok) {
      toast.error(birthParsed.error);
      return;
    }
    const birthIso = birthParsed && birthParsed.ok ? birthParsed.iso : null;

    const patch: Record<string, string | null> = {
      participant_full_name: draft.name.trim() || null,
      participant_cpf: draft.cpf.trim() || null,
      participant_birth_date: birthIso,
      participant_gender: draft.gender.trim() || null,
      participant_phone: draft.phone.trim() || null,
      shirt_size: draft.shirtSize.trim() || null,
    };

    if (isKidsCategory(row.category) && birthIso) {
      const kidsCat = kidsCategoryForAge(ageAtEvent(birthIso, row.events?.date));
      if (!kidsCat) {
        toast.error("Idade fora das baterias Kids (2 a 13 anos na data da prova).");
        return;
      }
      patch.category = kidsCat;
    }

    setSaving(true);
    const { error } = await supabase.from("event_signups").update(patch as any).eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setConfirmEdit(false);
      return;
    }

    const uiPatch: Partial<AdminSignupDetailRow> = {
      participant_full_name: patch.participant_full_name,
      participant_cpf: patch.participant_cpf,
      participant_birth_date: patch.participant_birth_date,
      participant_gender: patch.participant_gender,
      participant_phone: patch.participant_phone,
      shirt_size: patch.shirt_size,
      ...(patch.category ? { category: patch.category } : {}),
    };
    setLocalPatch((prev) => ({ ...prev, ...uiPatch }));
    setConfirmEdit(false);
    setEditing(false);
    setDraft(null);
    toast.success("Dados do participante atualizados.");
    onSaved({ patch: uiPatch });
  };

  const saveKids = async () => {
    if (!row || !pending) return;
    const built = buildKidsParticipantPatch(
      {
        full_name: pending.full_name,
        birth_date: pending.birth_date,
        gender: pending.gender,
        cpf: pending.cpf,
        phone: pending.phone,
      },
      row.events?.date,
    );
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("event_signups").update(built.patch as any).eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Participante classificado: ${built.bracket.title}.`);
    setPending(null);
    setCompleting(false);
    const uiPatch: Partial<AdminSignupDetailRow> = {
      participant_full_name: built.patch.participant_full_name,
      participant_birth_date: built.patch.participant_birth_date,
      participant_gender: built.patch.participant_gender,
      participant_cpf: built.patch.participant_cpf ?? row.participant_cpf,
      participant_phone: built.patch.participant_phone ?? row.participant_phone,
      category: built.patch.category || row.category,
    };
    setLocalPatch((prev) => ({ ...prev, ...uiPatch }));
    onSaved({ patch: uiPatch });
  };

  const formInitial: Partial<FormState> = {
    full_name: row?.participant_full_name || "",
    birth_date: row?.participant_birth_date || "",
    gender: row?.participant_gender || "",
    cpf: row?.participant_cpf || "",
    phone: row?.participant_phone || "",
    relationship: "",
  };

  const birthDisplay = formatBirthDateBR(row?.participant_birth_date) || "—";

  return (
    <>
      <Sheet open={open && !!row} onOpenChange={(o) => (!o ? closeAll() : onOpenChange(o))}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {row && (
            <>
              <SheetHeader className="pr-16 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <SheetTitle>Detalhes da inscrição</SheetTitle>
                    <SheetDescription>{row.events?.name || "Prova"}</SheetDescription>
                  </div>
                  {!editing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-12 top-4 h-8 w-8"
                      aria-label="Editar participante"
                      onClick={startEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="absolute right-12 top-3 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={saving}
                        onClick={cancelEdit}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={saving}
                        onClick={requestSaveEdit}
                      >
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {incompleteKids && !editing && (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 space-y-3">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold">Dados da criança incompletos</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Esta inscrição é antiga e não possui todos os dados do participante.
                          Complete os dados abaixo para classificar a criança na bateria correta.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="brand" onClick={() => setCompleting(true)}>
                      Completar participante
                    </Button>
                  </div>
                )}

                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Participante{editing ? " · editando" : ""}
                  </h3>

                  {editing && draft ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3">
                      <div className="sm:col-span-2">
                        <Label htmlFor="adm-p-name">Nome</Label>
                        <Input
                          id="adm-p-name"
                          className="mt-1"
                          maxLength={160}
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adm-p-cpf">CPF</Label>
                        <Input
                          id="adm-p-cpf"
                          className="mt-1"
                          inputMode="numeric"
                          maxLength={14}
                          value={draft.cpf}
                          onChange={(e) => setDraft({ ...draft, cpf: formatCPF(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adm-p-birth">Data de nascimento</Label>
                        <BirthDateInput
                          id="adm-p-birth"
                          className="mt-1"
                          value={draft.birth}
                          onChange={(iso) => setDraft({ ...draft, birth: iso })}
                        />
                      </div>
                      <div>
                        <Label>Gênero</Label>
                        <Select
                          value={draft.gender || undefined}
                          onValueChange={(v) => setDraft({ ...draft, gender: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Masculino">Masculino</SelectItem>
                            <SelectItem value="Feminino">Feminino</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="adm-p-phone">Telefone</Label>
                        <Input
                          id="adm-p-phone"
                          className="mt-1"
                          maxLength={20}
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: formatPhone(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Tamanho da camiseta</Label>
                        <Select
                          value={draft.shirtSize || "__none__"}
                          onValueChange={(v) =>
                            setDraft({ ...draft, shirtSize: v === "__none__" ? "" : v })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {[...new Set([...SHIRT_SIZES, draft.shirtSize].filter(Boolean))].map((sz) => (
                              <SelectItem key={sz} value={sz}>
                                {sz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 text-xs text-muted-foreground">
                        Idade na data do evento:{" "}
                        <span className="font-semibold text-foreground">
                          {editAge != null ? `${editAge} anos` : "—"}
                        </span>
                        {isKids && editKidsBracket && (
                          <>
                            {" "}
                            · Bateria:{" "}
                            <span className="font-semibold text-foreground">
                              {editKidsBracket.title} · {editKidsBracket.raceDistance}
                            </span>
                          </>
                        )}
                      </div>
                      <Field label="Categoria (atual)" value={dash(row.category)} />
                      <Field label="Kit" value={formatKit(row.kit_option || "")} />
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/20 p-3">
                      <Field label="Nome" value={dash(row.participant_full_name)} />
                      <Field label="CPF" value={dash(row.participant_cpf)} />
                      <Field label="Data de nascimento" value={birthDisplay} />
                      <Field
                        label="Idade na data do evento"
                        value={participantAge != null ? `${participantAge} anos` : "—"}
                      />
                      <Field label="Gênero" value={dash(row.participant_gender)} />
                      <Field label="Telefone" value={dash(row.participant_phone)} />
                      <Field label="Categoria" value={dash(row.category)} />
                      <Field label="Kit" value={formatKit(row.kit_option || "")} />
                      <Field label="Camiseta" value={dash(row.shirt_size)} />
                    </dl>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Responsável
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/20 p-3">
                    <Field label="Nome" value={dash(row.profiles?.full_name)} />
                    <Field label="CPF" value={dash(row.profiles?.cpf)} />
                    <Field label="E-mail" value={dash(row.profiles?.email)} />
                    <Field label="Telefone/WhatsApp" value={dash(row.profiles?.whatsapp)} />
                    <Field
                      label="Cidade"
                      value={
                        row.profiles?.city
                          ? `${row.profiles.city}${row.profiles.state ? ` / ${row.profiles.state}` : ""}`
                          : "—"
                      }
                    />
                  </dl>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Inscrição
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/20 p-3">
                    <Field label="Prova" value={dash(row.events?.name)} />
                    <div className="min-w-0 sm:col-span-1">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Status
                      </dt>
                      <dd className="mt-1 space-y-1">
                        {(() => {
                          const op = getSignupStatusInfo(row);
                          return (
                            <>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  op.badgeClassName,
                                )}
                              >
                                {op.overdue ? <Clock className="w-3.5 h-3.5" /> : null}
                                {op.label}
                              </span>
                              {op.overdueHint ? (
                                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-snug">
                                  {op.overdueHint}
                                </p>
                              ) : null}
                            </>
                          );
                        })()}
                      </dd>
                    </div>
                    <Field
                      label="Data da inscrição"
                      value={new Date(row.created_at).toLocaleString("pt-BR")}
                    />
                    <Field label="Equipe" value={dash(row.team_name || row.profiles?.team_name)} />
                    <Field label="Cupom" value={dash(row.coupon_code)} />
                    {row.notes ? <Field label="Observações" value={row.notes} /> : null}
                  </dl>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={completing} onOpenChange={(o) => !o && setCompleting(false)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completar participante</DialogTitle>
            <DialogDescription>
              Informe os dados da criança. A bateria Kids é calculada automaticamente pela idade
              na data da prova
              {row?.events?.date ? ` (${row.events.date})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <ParticipantForm
            key={row?.id || "complete"}
            initial={formInitial}
            submitting={saving}
            onCancel={() => setCompleting(false)}
            onSubmit={(v) => {
              const built = buildKidsParticipantPatch(
                {
                  full_name: v.full_name,
                  birth_date: v.birth_date,
                  gender: v.gender,
                  cpf: v.cpf,
                  phone: v.phone,
                },
                row?.events?.date,
              );
              if (!built.ok) {
                toast.error(built.error);
                return;
              }
              setPending(v);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar classificação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {pendingBracket
                    ? `Confirmar dados do participante e classificar na bateria ${pendingBracket.title.replace(/^Kids -\s*/, "")}?`
                    : "Confirmar dados do participante?"}
                </p>
                {pendingBracket && (
                  <p className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-foreground">
                    Bateria identificada:{" "}
                    <span className="font-semibold">
                      {pendingBracket.title.replace(/^Kids -\s*/, "")} · {pendingBracket.raceDistance}
                    </span>
                  </p>
                )}
                {pending && (
                  <p className="text-foreground">
                    {pending.full_name}
                    {pending.birth_date ? ` · nasc. ${formatBirthDateBR(pending.birth_date) || pending.birth_date}` : ""}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void saveKids();
              }}
            >
              {saving ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEdit} onOpenChange={(o) => !o && setConfirmEdit(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Confirmar alterações nos dados do participante?</p>
                {isKids && editKidsBracket && (
                  <p className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-foreground">
                    Bateria Kids:{" "}
                    <span className="font-semibold">
                      {editKidsBracket.title} · {editKidsBracket.raceDistance}
                    </span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
            >
              {saving ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminSignupDetailSheet;
