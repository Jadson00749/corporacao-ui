import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  isOrganizerPaymentReady,
  useOrganizerPayment,
  useSaveOrganizerPayment,
} from "@/lib/eventPayment";

/**
 * Tela do organizador: edita só os dados financeiros da própria organização.
 * Não toca em profiles — o contato financeiro pode ser de um funcionário.
 */
const OrganizerPaymentSettings = () => {
  const { organizerId, isAdmin } = useAuth();
  const { data: pay, isLoading } = useOrganizerPayment(organizerId);
  const save = useSaveOrganizerPayment(organizerId);

  const [pixKey, setPixKey] = useState("");
  const [pixRecipient, setPixRecipient] = useState("");
  const [paymentWhatsapp, setPaymentWhatsapp] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentContactName, setPaymentContactName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!pay || loaded) return;
    setPixKey(pay.pix_key ?? "");
    setPixRecipient(pay.pix_recipient ?? "");
    setPaymentWhatsapp(pay.payment_whatsapp ?? "");
    setPaymentEmail(pay.payment_email ?? "");
    setPaymentContactName(pay.payment_contact_name ?? "");
    setLoaded(true);
  }, [pay, loaded]);

  // Super Admin gerencia isso em Organizadores › Pagamento.
  if (isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Os dados de pagamento dos organizadores são gerenciados em Organizadores › Gerenciar ›
        Pagamento.
      </div>
    );
  }

  const draft = {
    pix_key: pixKey,
    pix_recipient: pixRecipient,
    payment_whatsapp: paymentWhatsapp,
    payment_email: paymentEmail,
    payment_contact_name: paymentContactName,
  };
  const ready = isOrganizerPaymentReady(draft);

  const onSave = async () => {
    if (!pixKey.trim() || !pixRecipient.trim()) {
      return toast.error("Informe a chave PIX e o beneficiário.");
    }
    if (!paymentWhatsapp.replace(/\D/g, "")) {
      return toast.error("Informe o WhatsApp para comprovantes.");
    }
    try {
      await save.mutateAsync(draft);
      toast.success("Dados de pagamento salvos!");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-brand" /> Dados de pagamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Esses dados serão usados nas suas provas para pagamento via PIX e envio de comprovantes.
        </p>
      </div>

      {!ready && loaded && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90">
            Complete seus dados de pagamento antes de publicar novas inscrições.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          Dados da organização — independentes do seu cadastro pessoal. Você pode cadastrar o
          responsável do financeiro com WhatsApp e e-mail comerciais.
        </p>

        {isLoading && !loaded ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <>
            <div>
              <Label>Chave PIX</Label>
              <Input
                className="mt-1"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>

            <div>
              <Label>Beneficiário do PIX</Label>
              <Input
                className="mt-1"
                value={pixRecipient}
                onChange={(e) => setPixRecipient(e.target.value)}
                placeholder="Nome que aparece no comprovante"
              />
            </div>

            <div>
              <Label>WhatsApp para comprovantes</Label>
              <Input
                className="mt-1"
                value={paymentWhatsapp}
                onChange={(e) => setPaymentWhatsapp(e.target.value)}
                placeholder="5516999999999"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Com DDI e DDD, somente números. Pode ser um WhatsApp comercial.
              </p>
            </div>

            <div>
              <Label>E-mail financeiro</Label>
              <Input
                className="mt-1"
                type="email"
                value={paymentEmail}
                onChange={(e) => setPaymentEmail(e.target.value)}
                placeholder="financeiro@empresa.com"
              />
            </div>

            <div>
              <Label>Nome do responsável financeiro</Label>
              <Input
                className="mt-1"
                value={paymentContactName}
                onChange={(e) => setPaymentContactName(e.target.value)}
                placeholder="Ex.: João Financeiro"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="brand" onClick={onSave} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrganizerPaymentSettings;
