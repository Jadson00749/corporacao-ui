import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Copy, Check, QrCode, CreditCard, Loader2, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { paymentService, type CreatePixPaymentResponse, type CreateCreditCardPaymentResponse } from "@/services/paymentService";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCEP } from "@/lib/cpf";
import type { Profile } from "@/hooks/useProfile";
import { PaymentSuccessModal } from "./PaymentSuccessModal";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  // Modo evento (inscrição com split)
  eventId?: string;
  organizerId?: string;
  signupId?: string;
  // Modo produto (compra direta, sem split)
  productId?: string;
  value: number;
  maxInstallments?: number;
  customer: {
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
  };
  description?: string;
  userId?: string;
  successRedirect?: string;
  allowedPaymentMethods?: "both" | "pix" | "credit_card";
  onSuccess?: (method: "pix" | "credit-card") => void;
};

type Method = "pix" | "credit-card" | null;

export function AsaasPaymentStep({ eventId, organizerId, value, maxInstallments = 12, customer, description, signupId, productId, userId, successRedirect = "/minha-conta", allowedPaymentMethods = "both", onSuccess }: Props) {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ── PIX state ──
  const [pixLoading, setPixLoading] = useState(false);
  const [pixResult, setPixResult] = useState<CreatePixPaymentResponse | null>(null);
  const [copiedCopiaECola, setCopiedCopiaECola] = useState(false);
  const pixGeneratedRef = useRef(false);

  // ── Credit card state ──
  const [ccLoading, setCcLoading] = useState(false);
  const [ccResult, setCcResult] = useState<CreateCreditCardPaymentResponse | null>(null);
  const [installments, setInstallments] = useState(1);
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const installmentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!installmentsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!installmentsRef.current?.contains(e.target as Node)) setInstallmentsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [installmentsOpen]);
  const [card, setCard] = useState({ holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" });
  const [focusedField, setFocusedField] = useState<"number" | "holderName" | "expiry" | "ccv" | null>(null);
  const [holder, setHolder] = useState({ name: "", cpfCnpj: "", postalCode: "", addressNumber: "", phone: "", city: "", state: "", street: "" });

  useEffect(() => {
    if (!copiedCopiaECola) return;
    const t = setTimeout(() => setCopiedCopiaECola(false), 2500);
    return () => clearTimeout(t);
  }, [copiedCopiaECola]);

  const onSuccessRef = useRef(onSuccess);
  const methodRef = useRef(method);
  const signupIdRef = useRef(signupId);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { methodRef.current = method; }, [method]);
  useEffect(() => { signupIdRef.current = signupId; }, [signupId]);

  useEffect(() => {
    const channel = supabase
      .channel(`signup-realtime-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'event_signups',
      }, (payload: any) => {
        const currentSignupId = signupIdRef.current;
        if (payload.new?.id === currentSignupId && payload.new?.status === 'confirmada') {
          setShowSuccessModal(true);
          onSuccessRef.current?.(methodRef.current ?? "pix");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSelectMethod = (m: Method) => {
    setMethod(m);
    if (m === "pix" && !pixGeneratedRef.current) {
      pixGeneratedRef.current = true;
      handleGeneratePix();
    }
  };

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

  const handleGeneratePix = async () => {
    setPixLoading(true);
    try {
      const result = productId
        ? await paymentService.createProductPixPayment({ productId, value, customer, description })
        : await paymentService.createPixPayment({ eventId: eventId!, organizerId: organizerId!, value, customer, description, externalReference: signupId });
      setPixResult(result);
    } catch (e: any) {
      toast.error("Não foi possível gerar o PIX. Tente novamente.", {
        description: e?.message,
        position: "top-center",
      });
      pixGeneratedRef.current = false;
    } finally {
      setPixLoading(false);
    }
  };

  const handleCreditCard = async () => {
    if (!card.holderName || !card.number || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      toast.error("Preencha todos os dados do cartão.", { position: "top-center" });
      return;
    }
    if (!holder.cpfCnpj || !holder.postalCode || !holder.addressNumber) {
      toast.error("Preencha os dados do titular.", { position: "top-center" });
      return;
    }
    setCcLoading(true);
    try {
      const ccPayload = {
        value,
        installmentCount: installments,
        customer,
        description,
        creditCard: {
          holderName: card.holderName,
          number: card.number.replace(/\s/g, ""),
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.ccv,
        },
        creditCardHolderInfo: {
          name: holder.name || customer.name,
          email: customer.email,
          cpfCnpj: holder.cpfCnpj,
          postalCode: holder.postalCode.replace(/\D/g, ""),
          addressNumber: holder.addressNumber,
          phone: holder.phone || customer.phone,
        },
      };
      const result = productId
        ? await paymentService.createProductCreditCardPayment({ ...ccPayload, productId })
        : await paymentService.createCreditCardPayment({ ...ccPayload, eventId: eventId!, organizerId: organizerId!, externalReference: signupId });
      setCcResult(result);
      setShowSuccessModal(true);
      onSuccess?.("credit-card");
    } catch (e: any) {
      toast.error("Pagamento recusado. Verifique os dados do cartão.", {
        description: e?.message,
        position: "top-center",
      });
    } finally {
      setCcLoading(false);
    }
  };

  const installmentValue = value / installments;

  return (
    <div className="space-y-5 rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:p-6">
      <div className="space-y-1 text-center">
        <h3 className="font-display text-lg font-bold">Pagamento</h3>
        <p className="text-sm text-muted-foreground">
          {method ? (
            <button
              className="inline-flex items-center gap-1 text-brand hover:underline"
              onClick={() => setMethod(null)}
            >
              ← Trocar forma de pagamento
            </button>
          ) : allowedPaymentMethods === "both" ? (
            "Escolha a forma de pagamento"
          ) : allowedPaymentMethods === "pix" ? (
            "Pagamento via PIX"
          ) : (
            "Pagamento via Cartão de crédito"
          )}
        </p>
      </div>

      {/* ── Seleção inicial ── */}
      {!method && (
        <div className={allowedPaymentMethods === "both" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "flex justify-center"}>
          {(allowedPaymentMethods === "both" || allowedPaymentMethods === "pix") && (
          <button
            type="button"
            onClick={() => handleSelectMethod("pix")}
            className={`group flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/60 p-5 text-center transition-all hover:border-brand/60 hover:bg-brand/5 hover:shadow-sm${allowedPaymentMethods === "pix" ? " w-full max-w-xs" : ""}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand/10 transition-all group-hover:bg-brand/20">
              <QrCode className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="font-semibold">PIX</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pagamento instantâneo</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-[11px] font-semibold text-success">
              ✓ Aprovação imediata
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
          </button>
          )}

          {(allowedPaymentMethods === "both" || allowedPaymentMethods === "credit_card") && (
          <button
            type="button"
            onClick={() => handleSelectMethod("credit-card")}
            className={`group flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/60 p-5 text-center transition-all hover:border-brand/60 hover:bg-brand/5 hover:shadow-sm${allowedPaymentMethods === "credit_card" ? " w-full max-w-xs" : ""}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand/10 transition-all group-hover:bg-brand/20">
              <CreditCard className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="font-semibold">Cartão de crédito</p>
              <p className="text-xs text-muted-foreground mt-0.5">Parcele em até 12x</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Visa · Master · Elo
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
          </button>
          )}
        </div>
      )}

      {/* ── PIX ── */}
      {method === "pix" && (
        <div className="space-y-4">
          {pixLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-sm text-muted-foreground">Gerando QR Code PIX…</p>
            </div>
          )}

          {!pixLoading && pixResult && (
            <>
              <div className="space-y-1.5 rounded-xl border border-border/60 bg-background/70 p-3.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Valor</span>
                  <span className="font-bold text-brand">{brl(pixResult.value)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Validade</span>
                  <span className="font-medium">
                    {new Date(pixResult.expirationDate).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <img
                  src={pixResult.pixQrCodeImage}
                  alt="QR Code para pagamento PIX"
                  className="h-48 w-48 rounded-xl border border-border bg-white p-2 sm:h-56 sm:w-56"
                />
                <p className="text-center text-xs text-muted-foreground sm:text-sm">
                  Escaneie o QR Code pelo aplicativo do seu banco
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant={copiedCopiaECola ? "outline" : "brand"}
                  size="lg"
                  className="h-12 w-full touch-manipulation"
                  onClick={async () => {
                    await writeClipboard(pixResult.pixCopiaECola);
                    setCopiedCopiaECola(true);
                  }}
                >
                  {copiedCopiaECola ? (
                    <><Check className="h-4 w-4" /> Código PIX copiado</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Copiar código copia e cola</>
                  )}
                </Button>

                <details className="group">
                  <summary className="cursor-pointer list-none py-1 text-center text-xs text-muted-foreground hover:text-foreground">
                    <span className="group-open:hidden">Mostrar código PIX</span>
                    <span className="hidden group-open:inline">Ocultar código PIX</span>
                  </summary>
                  <div className="mt-2 max-h-24 overflow-y-auto break-all rounded-xl border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed">
                    {pixResult.pixCopiaECola}
                  </div>
                </details>
              </div>
            </>
          )}

          {!pixLoading && !pixResult && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground">Não foi possível gerar o PIX.</p>
              <Button variant="outline" size="sm" onClick={() => { pixGeneratedRef.current = false; handleGeneratePix(); }}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Cartão ── */}
      {method === "credit-card" && (
        <div className="space-y-4">
          {/* Card visual com flip 3D */}
          {!ccResult && (
            <div className="mx-auto h-44 w-full max-w-sm select-none" style={{ perspective: "1000px" }}>
              <div
                className="relative h-full w-full transition-transform duration-700"
                style={{ transformStyle: "preserve-3d", transform: focusedField === "ccv" ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* ── Frente ── */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111] via-[#1a1a1a] to-[#0f1f0f] p-5 shadow-xl border border-brand/20"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/5" />
                  <div className="absolute -bottom-8 -right-2 h-40 w-40 rounded-full bg-white/5" />

                  <div className="mb-4 h-7 w-10 rounded-md bg-yellow-300/80" />

                  <p className={cn(
                    "font-mono text-lg tracking-widest text-white/90 drop-shadow rounded px-1 -mx-1 transition-all",
                    focusedField === "number" && "ring-1 ring-brand"
                  )}>
                    {(() => {
                      const digits = card.number.replace(/\s/g, "");
                      const full = digits.padEnd(16, "•");
                      return `${full.slice(0,4)} ${full.slice(4,8)} ${full.slice(8,12)} ${full.slice(12,16)}`;
                    })()}
                  </p>

                  <div className="mt-3 flex items-end justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/50">Titular</p>
                      <p className={cn(
                        "truncate font-semibold uppercase tracking-wide text-white/90 text-sm max-w-52 rounded px-1 -mx-1 transition-all",
                        focusedField === "holderName" && "ring-1 ring-brand"
                      )}>
                        {(card.holderName || "SEU NOME").slice(0, 22)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-white/50">Validade</p>
                      <p className={cn(
                        "font-semibold text-white/90 text-sm rounded px-1 -mx-1 transition-all",
                        focusedField === "expiry" && "ring-1 ring-brand"
                      )}>
                        {card.expiryMonth || "MM"}/{card.expiryYear ? card.expiryYear.slice(-2) : "AA"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Verso ── */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111] via-[#1a1a1a] to-[#0f1f0f] shadow-xl border border-brand/20"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <div className="mt-6 h-10 w-full bg-black/40" />
                  <div className="mt-4 px-5">
                    <div className="flex items-center justify-end gap-3 rounded-md bg-white/90 px-3 py-2">
                      <div className="flex-1 h-1.5 rounded bg-gray-300/80" />
                      <p className="font-mono text-sm font-bold text-gray-800 tracking-widest">
                        {card.ccv || "•••"}
                      </p>
                    </div>
                    <p className="mt-2 text-right text-[10px] uppercase tracking-widest text-white/50">CVV</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {ccResult ? (
            <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-4 text-sm space-y-2">
              <p className="font-semibold text-success">✓ Pagamento aprovado!</p>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-brand">{brl(ccResult.value)}</span>
              </div>
              {ccResult.installmentCount > 1 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Parcelamento</span>
                  <span className="font-medium">{ccResult.installmentCount}x {brl(ccResult.installmentValue)}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados do cartão</p>

                <div>
                  <Label htmlFor="cc-holder-name">Nome no cartão *</Label>
                  <Input
                    id="cc-holder-name"
                    className="mt-1"
                    placeholder="Como está impresso no cartão"
                    value={card.holderName}
                    onChange={(e) => setCard((c) => ({ ...c, holderName: e.target.value.toUpperCase() }))}
                    onFocus={() => setFocusedField("holderName")}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>

                <div>
                  <Label htmlFor="cc-number">Número do cartão *</Label>
                  <Input
                    id="cc-number"
                    className="mt-1 font-mono"
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    maxLength={19}
                    value={card.number}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                      setCard((c) => ({ ...c, number: v.replace(/(.{4})/g, "$1 ").trim() }));
                    }}
                    onFocus={() => setFocusedField("number")}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cc-month">Mês *</Label>
                    <Input
                      id="cc-month"
                      className="mt-1"
                      placeholder="MM"
                      inputMode="numeric"
                      maxLength={2}
                      value={card.expiryMonth}
                      onChange={(e) => setCard((c) => ({ ...c, expiryMonth: e.target.value.replace(/\D/g, "") }))}
                      onFocus={() => setFocusedField("expiry")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cc-year">Ano *</Label>
                    <Input
                      id="cc-year"
                      className="mt-1"
                      placeholder="AAAA"
                      inputMode="numeric"
                      maxLength={4}
                      value={card.expiryYear}
                      onChange={(e) => setCard((c) => ({ ...c, expiryYear: e.target.value.replace(/\D/g, "") }))}
                      onFocus={() => setFocusedField("expiry")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cc-cvv">CVV *</Label>
                    <Input
                      id="cc-cvv"
                      className="mt-1"
                      placeholder="000"
                      inputMode="numeric"
                      maxLength={4}
                      value={card.ccv}
                      onChange={(e) => setCard((c) => ({ ...c, ccv: e.target.value.replace(/\D/g, "") }))}
                      onFocus={() => setFocusedField("ccv")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados do titular</p>

                <div>
                  <Label htmlFor="holder-cpf">CPF do titular *</Label>
                  <Input
                    id="holder-cpf"
                    className="mt-1"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    value={holder.cpfCnpj}
                    onChange={(e) => setHolder((h) => ({ ...h, cpfCnpj: formatCPF(e.target.value) }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="holder-cep">CEP *</Label>
                    <Input
                      id="holder-cep"
                      className="mt-1"
                      placeholder="00000-000"
                      inputMode="numeric"
                      maxLength={9}
                      value={holder.postalCode}
                      onChange={async (e) => {
                        const formatted = formatCEP(e.target.value);
                        setHolder((h) => ({ ...h, postalCode: formatted, city: "", state: "" }));
                        const digits = formatted.replace(/\D/g, "");
                        if (digits.length === 8) {
                          try {
                            const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                            const data = await res.json();
                            if (!data.erro) {
                              setHolder((h) => ({ ...h, city: data.localidade, state: data.uf, street: data.logradouro || "" }));
                            }
                          } catch {}
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holder-num">Número *</Label>
                    <Input
                      id="holder-num"
                      className="mt-1"
                      placeholder="Ex: 123"
                      value={holder.addressNumber}
                      onChange={(e) => setHolder((h) => ({ ...h, addressNumber: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Endereço</Label>
                  <Input className="mt-1" value={holder.street} placeholder="Rua, Avenida..." onChange={(e) => setHolder((h) => ({ ...h, street: e.target.value }))} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input className="mt-1" value={holder.city} placeholder="Sua cidade" onChange={(e) => setHolder((h) => ({ ...h, city: e.target.value }))} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input className="mt-1" value={holder.state} placeholder="SP" maxLength={2} onChange={(e) => setHolder((h) => ({ ...h, state: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
              </div>

              {value > 0 && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <div ref={installmentsRef} className="relative mt-1">
                    <button
                      type="button"
                      onClick={() => setInstallmentsOpen((o) => !o)}
                      className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-colors hover:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <span>{installments}x de {brl(value / installments)}{installments === 1 ? " à vista" : ""}</span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", installmentsOpen && "rotate-180")} />
                    </button>

                    {installmentsOpen && (
                      <div className="absolute z-50 mt-1 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg" style={{ maxHeight: "252px" }}>
                        {Array.from({ length: maxInstallments }, (_, i) => i + 1)
                          .filter((n) => value / n >= 5)
                          .map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => { setInstallments(n); setInstallmentsOpen(false); }}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60",
                                n === installments ? "bg-brand/10 text-brand font-semibold" : "text-foreground"
                              )}
                            >
                              <span>{n}x de {brl(value / n)}{n === 1 ? " à vista" : ""}</span>
                              {n === installments && <Check className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="brand"
                size="lg"
                className="h-12 w-full touch-manipulation"
                disabled={ccLoading}
                onClick={handleCreditCard}
              >
                {ccLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando…</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Pagar {brl(value)}</>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Seus dados são protegidos e processados com segurança via Asaas.
              </p>
            </>
          )}
        </div>
      )}
      <PaymentSuccessModal
        open={showSuccessModal}
        onNavigate={() => navigate(successRedirect)}
        description={eventId ? "Sua inscrição foi confirmada com sucesso. Em breve você receberá um e-mail de confirmação." : "Seu pedido foi registrado com sucesso."}
        buttonLabel={eventId ? "Ver minhas inscrições" : "Ver produtos"}
      />
    </div>
  );
}
