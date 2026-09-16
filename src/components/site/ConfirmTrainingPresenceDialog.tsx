import { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Confetti } from "@/components/site/Confetti";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { organizationAccent, organizationCtaVariant } from "@/lib/eventOrganizer";
import {
  isTrainingPresenceConfirmedInSession,
  markTrainingPresenceConfirmedInSession,
} from "@/lib/trainingPresenceSession";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Training } from "@/data/trainings";
import { toast } from "sonner";

type Props = {
  training: Training | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Notifica o card após INSERT bem-sucedido (atualiza botão). */
  onConfirmed?: () => void;
};

const presenceIdentity = (userId?: string | null, email?: string | null) => {
  if (userId) return `u:${userId}`;
  const e = (email || "").trim().toLowerCase();
  return e ? `e:${e}` : null;
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const whatsappDigits = (v: string) => v.replace(/\D/g, "");

const formatShortDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export const ConfirmTrainingPresenceDialog = ({
  training,
  open,
  onOpenChange,
  onConfirmed,
}: Props) => {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  /** Confete só no INSERT real desta abertura — não ao reabrir já confirmado. */
  const [celebrate, setCelebrate] = useState(false);
  /** true = já estava confirmado na sessão ao abrir (sem novo INSERT). */
  const [revisit, setRevisit] = useState(false);
  const [sponsorConsent, setSponsorConsent] = useState(false);

  const orgContext = training?.organizationContext ?? "main";
  const accent = organizationAccent(orgContext);
  const ctaVariant = organizationCtaVariant(orgContext);

  useEffect(() => {
    if (!open || !training) return;

    const identity = presenceIdentity(user?.id, user?.email || profile?.email);
    const already = isTrainingPresenceConfirmedInSession(training.id, identity);

    setDone(already);
    setRevisit(already);
    setCelebrate(false);
    setSponsorConsent(false);
    setErrors({});
    setSubmitting(false);

    if (already) return;

    const name = (profile?.full_name || user?.user_metadata?.full_name || "").trim();
    const phone = (profile?.whatsapp || profile?.phone || "").trim();
    const mail = (profile?.email || user?.email || "").trim();
    setFullName(name);
    setWhatsapp(phone);
    setEmail(mail);
  }, [open, training?.id, profile, user]);

  if (!training) return null;

  const validate = () => {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = "Informe seu nome completo.";
    const digits = whatsappDigits(whatsapp);
    if (digits.length < 10) next.whatsapp = "Informe um WhatsApp válido.";
    if (!isEmail(email)) next.email = "Informe um e-mail válido.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting || done) return;
    if (isTrainingPresenceConfirmedInSession(training.id)) {
      setDone(true);
      setRevisit(true);
      setCelebrate(false);
      return;
    }
    if (!validate()) return;
    setSubmitting(true);
    // sponsorConsent: state local; persistência no banco ainda pendente.
    const { error } = await supabase.from("training_signups").insert({
      training_id: training.id,
      full_name: fullName.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim().toLowerCase(),
      notes: "",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível confirmar sua presença. Tente novamente.");
      return;
    }
    markTrainingPresenceConfirmedInSession(training.id);
    setDone(true);
    setRevisit(false);
    setCelebrate(true);
    onConfirmed?.();
    toast.success("Presença confirmada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {done
              ? revisit
                ? "Você já confirmou sua presença neste treino ✓"
                : "Presença confirmada! 🎉"
              : "Confirmar presença"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          {training.title}
          <span className="mx-1.5 text-border">·</span>
          {formatShortDate(training.date)} · {training.time}
        </p>

        {done ? (
          <div className="relative py-5 text-center space-y-4 animate-fade-in">
            <Confetti fire={celebrate} />
            <div
              className={cn(
                "mx-auto w-14 h-14 rounded-full grid place-items-center",
                orgContext === "partner" ? "bg-partner/15 text-partner" : "bg-brand/15 text-brand",
                celebrate ? "animate-presence-check-pop" : ""
              )}
            >
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-medium text-foreground">Nos vemos no treino.</p>
              <p className="text-sm text-muted-foreground">
                {training.title}
                <span className="mx-1.5 text-border">·</span>
                {formatShortDate(training.date)} · {training.time}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className={cn(
                "w-full rounded-full h-11 pointer-events-none opacity-90 border",
                accent.border
              )}
              disabled
              aria-disabled="true"
            >
              <Check className="w-4 h-4" />
              Presença confirmada
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form
            className="space-y-4 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <Label htmlFor="tp-name">Nome completo *</Label>
              <Input
                id="tp-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="mt-1.5 h-11 text-base"
              />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <Label htmlFor="tp-wa">WhatsApp *</Label>
              <Input
                id="tp-wa"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                className="mt-1.5 h-11 text-base"
              />
              {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
            </div>
            <div>
              <Label htmlFor="tp-email">E-mail *</Label>
              <Input
                id="tp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1.5 h-11 text-base"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div
              className={cn(
                "rounded-xl border bg-white/[0.03] p-3.5 transition-colors",
                sponsorConsent ? accent.border : "border-border/60"
              )}
            >
              <label
                htmlFor="tp-sponsor-consent"
                className="flex cursor-pointer items-start gap-3 touch-manipulation select-none"
              >
                <Checkbox
                  id="tp-sponsor-consent"
                  checked={sponsorConsent}
                  onCheckedChange={(v) => setSponsorConsent(v === true)}
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0 rounded-md border-muted-foreground/50 transition-all duration-200",
                    "data-[state=checked]:scale-110 data-[state=checked]:border-transparent",
                    orgContext === "partner"
                      ? "data-[state=checked]:bg-partner data-[state=checked]:text-partner-foreground"
                      : "data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
                  )}
                />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold leading-snug text-foreground">
                      Quero receber benefícios e ofertas dos patrocinadores deste treino
                    </span>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Opcional
                    </span>
                  </span>
                  <span className="block text-[11px] leading-relaxed text-muted-foreground">
                    Ao marcar, autorizo o uso do meu nome, e-mail e WhatsApp para comunicações dos
                    patrocinadores oficiais deste treino. Posso retirar essa autorização depois.
                  </span>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant={ctaVariant}
              className="w-full rounded-full h-12 text-base"
              disabled={submitting || done}
            >
              {submitting ? "Confirmando…" : "Confirmar presença"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
