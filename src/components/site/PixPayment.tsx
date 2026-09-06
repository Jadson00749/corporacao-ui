import { Copy, Check, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";
import { cn } from "@/lib/utils";

type Summary = {
  eventName?: string | null;
  participant?: string | null;
  modality?: string | null;
  organizerName?: string | null;
  isPartner?: boolean;
};

type Props = {
  pixKey?: string | null;
  recipient?: string | null;
  city?: string | null;
  amount?: number | null;
  txid?: string | null;
  instructions?: string | null;
  /** Resumo de confiança exibido antes das ações (opcional). */
  summary?: Summary;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PixPayment({
  pixKey,
  recipient,
  city,
  amount,
  txid,
  instructions,
  summary,
}: Props) {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [qr, setQr] = useState<string>("");

  const payload = useMemo(
    () => (pixKey ? buildPixPayload({ key: pixKey, recipient, city, amount, txid }) : ""),
    [pixKey, recipient, city, amount, txid]
  );

  const displayKey = pixKey ? normalizePixKey(pixKey) : "";

  useEffect(() => {
    let alive = true;
    if (!payload) {
      setQr("");
      return;
    }
    QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: "M" })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr("");
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  useEffect(() => {
    if (!copiedPayload && !copiedKey) return;
    const t = setTimeout(() => {
      setCopiedPayload(false);
      setCopiedKey(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [copiedPayload, copiedKey]);

  const writeClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
  };

  const copyPayload = async () => {
    if (!payload) return;
    await writeClipboard(payload);
    setCopiedPayload(true);
    setCopiedKey(false);
  };

  const copyKey = async () => {
    if (!displayKey) return;
    await writeClipboard(displayKey);
    setCopiedKey(true);
    setCopiedPayload(false);
  };

  if (!pixKey) return null;

  const rows = [
    summary?.eventName && { label: "Evento", value: summary.eventName },
    summary?.participant && { label: "Participante", value: summary.participant },
    summary?.modality && { label: "Modalidade", value: summary.modality },
    amount && amount > 0 && { label: "Valor", value: brl(amount) },
    recipient && { label: "Beneficiário", value: recipient },
    { label: "Chave PIX", value: displayKey },
    summary?.organizerName && {
      label: "Organizador",
      value: summary.organizerName,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-5 rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:p-6">
      <div className="space-y-1 text-center">
        <h3 className="flex items-center justify-center gap-2 font-display text-lg font-bold">
          <QrCode className="h-5 w-5 text-brand" /> Pagamento via PIX
        </h3>
        <p className="text-sm text-muted-foreground">
          Confira os dados antes de pagar. O valor só confirma após o comprovante.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border/60 bg-background/70 p-3.5 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">{r.label}</span>
              <span
                className={cn(
                  "text-right font-medium break-words",
                  r.label === "Valor" && "font-bold text-brand",
                  r.label === "Chave PIX" && "font-mono text-xs sm:text-sm"
                )}
              >
                {r.value}
              </span>
            </div>
          ))}
          {summary?.isPartner && summary.organizerName && (
            <p className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
              O recebimento é do organizador {summary.organizerName}.
            </p>
          )}
        </div>
      )}

      {payload ? (
        <>
          <div className="flex flex-col items-center gap-3">
            {qr ? (
              <img
                src={qr}
                alt="QR Code para pagamento PIX"
                className="h-48 w-48 rounded-xl border border-border bg-white p-2 sm:h-56 sm:w-56"
              />
            ) : (
              <div className="h-48 w-48 animate-pulse rounded-xl bg-secondary/50 sm:h-56 sm:w-56" />
            )}
            <p className="text-center text-xs text-muted-foreground sm:text-sm">
              Escaneie o QR Code pelo aplicativo do seu banco
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant={copiedKey ? "outline" : "brand"}
              size="lg"
              className="h-12 w-full touch-manipulation"
              onClick={copyKey}
            >
              {copiedKey ? (
                <>
                  <Check className="h-4 w-4" /> Chave PIX copiada
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar chave PIX
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full touch-manipulation"
              onClick={copyPayload}
            >
              {copiedPayload ? (
                <>
                  <Check className="h-4 w-4" /> Código PIX copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar código copia-e-cola
                </>
              )}
            </Button>
            <details className="group">
              <summary className="cursor-pointer list-none py-1 text-center text-xs text-muted-foreground hover:text-foreground">
                <span className="group-open:hidden">Mostrar código PIX</span>
                <span className="hidden group-open:inline">Ocultar código PIX</span>
              </summary>
              <div className="mt-2 max-h-24 overflow-y-auto break-all rounded-xl border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed">
                {payload}
              </div>
            </details>
          </div>
        </>
      ) : null}

      {instructions && (
        <p className="whitespace-pre-line border-t border-border/60 pt-3 text-sm text-foreground/80">
          {instructions}
        </p>
      )}
    </div>
  );
}
