import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode } from "lucide-react";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";

type Props = {
  pixKey?: string | null;
  recipient?: string | null;
  city?: string | null;
  amount?: number | null;
  txid?: string | null;
  instructions?: string | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PixPayment({ pixKey, recipient, city, amount, txid, instructions }: Props) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string>("");

  const payload = useMemo(
    () => (pixKey ? buildPixPayload({ key: pixKey, recipient, city, amount, txid }) : ""),
    [pixKey, recipient, city, amount, txid]
  );

  useEffect(() => {
    let alive = true;
    if (!payload) { setQr(""); return; }
    QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: "M" })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(""); });
    return () => { alive = false; };
  }, [payload]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement("textarea");
      el.value = payload;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
  };

  if (!pixKey) return null;

  return (
    <div className="border border-brand/40 bg-brand/5 rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="text-center space-y-1">
        <h3 className="font-display font-bold text-lg flex items-center justify-center gap-2">
          <QrCode className="w-5 h-5 text-brand" /> Pagamento via PIX
        </h3>
        {!!amount && amount > 0 && (
          <p className="text-sm text-muted-foreground">
            Valor a pagar: <span className="font-bold text-brand text-base">{brl(amount)}</span>
          </p>
        )}
      </div>

      {payload ? (
        <>
          <div className="flex flex-col items-center gap-3">
            {qr ? (
              <img
                src={qr}
                alt="QR Code para pagamento PIX"
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-white p-2 border border-border"
              />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-secondary/50 animate-pulse" />
            )}
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Escaneie o QR Code pelo aplicativo do seu banco
            </p>
          </div>

          <div className="space-y-2">
            <Button type="button" variant={copied ? "outline" : "brand"} size="lg" className="w-full" onClick={copy}>
              {copied ? (<><Check className="w-4 h-4" /> Código PIX copiado ✓</>) : (<><Copy className="w-4 h-4" /> Copiar código PIX</>)}
            </Button>
            <details className="group">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground text-center py-1">
                <span className="group-open:hidden">Mostrar código PIX</span>
                <span className="hidden group-open:inline">Ocultar código PIX</span>
              </summary>
              <div className="mt-2 rounded-xl border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed break-all max-h-24 overflow-y-auto">
                {payload}
              </div>
            </details>
          </div>

        </>
      ) : null}

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>
          Ou utilize a chave PIX: <span className="font-mono text-foreground/80">{normalizePixKey(pixKey)}</span>
        </p>
        {recipient && <p>Recebedor: <span className="text-foreground/80">{recipient}</span></p>}
      </div>

      {instructions && (
        <p className="text-sm whitespace-pre-line text-foreground/80 border-t border-border/60 pt-3">{instructions}</p>
      )}
    </div>
  );
}
