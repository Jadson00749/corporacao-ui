import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, MapPin, CheckCircle2, Tag, Copy, MessageCircle } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";

type Distance = { distance: string; price?: number };
type AgeBracket = { min: number; max: number };
type KitOption = { name: string; extra_price?: number };
type Coupon = { code: string; description?: string };

const calcAge = (birth?: string | null) => {
  if (!birth) return null;
  const d = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ProvaInscricao = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const buildWhats = useWhatsappLink();

  const [distance, setDistance] = useState("");
  const [gender, setGender] = useState("");
  const [bracket, setBracket] = useState("");
  const [kitOption, setKitOption] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [teamName, setTeamName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Clear individual error as user fills the field
  useEffect(() => { if (distance && errors.distance) setErrors((e) => ({ ...e, distance: false })); }, [distance]);
  useEffect(() => { if (gender && errors.gender) setErrors((e) => ({ ...e, gender: false })); }, [gender]);
  useEffect(() => { if (bracket && errors.bracket) setErrors((e) => ({ ...e, bracket: false })); }, [bracket]);
  useEffect(() => { if (kitOption && errors.kitOption) setErrors((e) => ({ ...e, kitOption: false })); }, [kitOption]);
  useEffect(() => { if (acceptedTerms && errors.terms) setErrors((e) => ({ ...e, terms: false })); }, [acceptedTerms]);

  useEffect(() => {
    if (!loading && !user) navigate(`/auth?redirect=/provas/${id}/inscricao`, { replace: true });
  }, [loading, user, id, navigate]);

  useEffect(() => {
    if (profile?.team_name && !teamName) setTeamName(profile.team_name);
  }, [profile]);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payment } = useQuery({
    queryKey: ["event_payment_details", id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_payment_details")
        .select("pix_key, pix_recipient, payment_instructions")
        .eq("event_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const distances = useMemo<Distance[]>(() => {
    if (!event) return [];
    const arr = ((event.distances as Distance[]) || []).filter((d) => d?.distance?.trim());
    if (arr.length) return arr;
    return (event.distance || "").split(/[•|,/]/).map((s: string) => ({ distance: s.trim() })).filter((d: Distance) => d.distance);
  }, [event]);

  const genders = useMemo<string[]>(() => {
    const arr = ((event?.genders as string[]) || ["Masculino", "Feminino"]).filter((g) => g && g.trim());
    return arr;
  }, [event]);
  const ageBrackets = useMemo<AgeBracket[]>(
    () => ((event?.age_brackets as AgeBracket[]) || []).filter((b) => b && Number.isFinite(b.min) && Number.isFinite(b.max)),
    [event]
  );
  const kitOptions = useMemo<KitOption[]>(
    () => ((event?.kit_options as KitOption[]) || []).filter((k) => k?.name?.trim()),
    [event]
  );
  const coupons = useMemo<Coupon[]>(
    () => ((event?.coupons as Coupon[]) || []).filter((c) => c?.code?.trim()),
    [event]
  );

  // Auto-pick when there's only one option
  useEffect(() => { if (distances.length === 1) setDistance(distances[0].distance); }, [distances]);
  useEffect(() => { if (genders.length === 1) setGender(genders[0]); }, [genders]);
  useEffect(() => { if (ageBrackets.length === 1) setBracket(`${ageBrackets[0].min}-${ageBrackets[0].max}`); }, [ageBrackets]);
  useEffect(() => {
    if (ageBrackets.length && profile?.birth_date) {
      const age = calcAge(profile.birth_date);
      if (age !== null) {
        const match = ageBrackets.find((b) => age >= b.min && age <= b.max);
        if (match) setBracket(`${match.min}-${match.max}`);
      }
    }
  }, [ageBrackets, profile]);

  const profileComplete = profile && profile.full_name && profile.cpf && profile.whatsapp && profile.cep;

  const distanceObj = distances.find((d) => d.distance === distance);
  const today = new Date().toISOString().slice(0, 10);
  const lote2Active = !!(distanceObj && (distanceObj as any).price_lote2 > 0 && (distanceObj as any).lote2_starts_at && today >= (distanceObj as any).lote2_starts_at);
  const distancePrice = lote2Active ? ((distanceObj as any).price_lote2 ?? 0) : (distanceObj?.price ?? 0);
  const kitExtra = kitOptions.find((k) => k.name === kitOption)?.extra_price ?? 0;
  const total = distancePrice + kitExtra;

  const categoryLabel = useMemo(() => {
    const parts = [distance, gender, bracket && `${bracket} anos`].filter(Boolean);
    return parts.join(" · ");
  }, [distance, gender, bracket]);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find((c) => c.code.toUpperCase() === code);
    if (!found) {
      toast.error("Cupom não encontrado.");
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(found);
    toast.success(`Cupom ${found.code} aplicado.`);
  };

  const submit = async () => {
    if (!user || !event) return;
    const newErrors: Record<string, boolean> = {};
    const missingLabels: string[] = [];
    if (distances.length > 0 && !distance) { newErrors.distance = true; missingLabels.push("Distância"); }
    if (genders.length > 0 && !gender) { newErrors.gender = true; missingLabels.push("Sexo"); }
    if (ageBrackets.length > 0 && !bracket) { newErrors.bracket = true; missingLabels.push("Faixa etária"); }
    if (kitOptions.length > 0 && !kitOption) { newErrors.kitOption = true; missingLabels.push("Opção de kit"); }
    if (!acceptedTerms) { newErrors.terms = true; missingLabels.push("Aceitar os termos"); }

    if (missingLabels.length) {
      setErrors(newErrors);
      toast.error("Preencha os campos destacados", {
        description: missingLabels.join(" · "),
        position: "top-center",
        duration: 5000,
      });
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>("[data-invalid='true']");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});

    setSubmitting(true);
    const { error } = await supabase.from("event_signups").insert({
      user_id: user.id,
      event_id: event.id,
      category: categoryLabel,
      status: "pendente",
      notes,
      kit_option: kitOption,
      coupon_code: appliedCoupon?.code || "",
      team_name: teamName,
      accepted_event_terms_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error("Você já está inscrito nessa categoria.");
      else toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my_signups"] });
    setDone(true);
  };

  if (loading || !user) return null;

  return (
    <Layout>
      <SEO title={`Inscrição: ${event?.name || "Prova"}`} description="Inscrição em prova de corrida." />
      <section className="section-padding pt-32">
        <div className="container-page max-w-2xl">
          <Link to={`/provas/${id}`} className="text-sm text-muted-foreground hover:text-brand mb-4 inline-block">← Voltar para a prova</Link>

          {eventLoading || profileLoading ? (
            <Skeleton className="h-96" />
          ) : !event ? (
            <p className="text-center text-muted-foreground">Prova não encontrada.</p>
          ) : done ? (
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="text-center">
                <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-3" />
                <h1 className="font-display text-2xl font-bold mb-2">Inscrição recebida!</h1>
                <p className="text-muted-foreground">
                  Copie a chave PIX abaixo, faça o pagamento e envie o comprovante via WhatsApp para confirmarmos sua participação.
                </p>
              </div>

              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Prova</span><span className="font-medium">{event.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span className="font-medium">{categoryLabel}</span></div>
                {total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-brand">{brl(total)}</span></div>}
              </div>

              {(payment?.pix_key || payment?.pix_recipient || payment?.payment_instructions) && (
                <div className="border border-brand/40 bg-brand/5 rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-brand">Pagamento via PIX</h3>
                  {payment?.pix_recipient && (
                    <div className="text-sm"><span className="text-muted-foreground">Recebedor: </span><span className="font-medium">{payment.pix_recipient}</span></div>
                  )}
                  {payment?.pix_key && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Chave PIX</div>
                      <div className="flex gap-2">
                        <Input readOnly value={payment.pix_key} className="font-mono text-sm" />
                        <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(payment.pix_key!); toast.success("Chave copiada!"); }}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {payment?.payment_instructions && (
                    <p className="text-sm whitespace-pre-line text-foreground/80">{payment.payment_instructions}</p>
                  )}
                </div>
              )}

              <Button
                asChild
                variant="brand"
                size="lg"
                className="w-full"
              >
                <a
                  href={buildWhats(`Olá! Fiz minha inscrição na prova ${event.name} e gostaria de enviar o comprovante do PIX.`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-4 h-4" /> Enviar comprovante no WhatsApp
                </a>
              </Button>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="outline" size="sm"><Link to="/minha-conta">Ver minhas inscrições</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link to="/provas">Ver outras provas</Link></Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold mb-1">Inscrição em prova</h1>
                <p className="text-sm text-muted-foreground">Confirme seus dados e finalize a inscrição.</p>
              </div>

              <div className="bg-secondary/40 rounded-xl p-4">
                <h2 className="font-display text-lg font-semibold">{event.name}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                    {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.city}</span>
                </div>
              </div>

              {!profileComplete && (
                <div className="bg-warning/15 border border-warning/40 text-foreground rounded-xl p-4 text-sm">
                  Seus dados estão incompletos. <Link to="/minha-conta" className="underline text-brand">Complete seu perfil</Link> antes de finalizar.
                </div>
              )}

              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <Field label="Nome" value={profile?.full_name} />
                <Field label="CPF" value={profile?.cpf} />
                <Field label="Idade" value={calcAge(profile?.birth_date) ? `${calcAge(profile?.birth_date)} anos` : ""} />
                <Field label="Cidade" value={[profile?.city, profile?.state].filter(Boolean).join(" / ")} />
                <Field label="E-mail" value={profile?.email || user.email || ""} />
                <Field label="WhatsApp" value={profile?.whatsapp} />
              </dl>

              {/* Categoria */}
              {(distances.length > 0 || genders.length > 0 || ageBrackets.length > 0) && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Categoria</h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {distances.length > 1 && (
                      <div>
                        <Label className={errors.distance ? "text-destructive" : ""}>Distância *</Label>
                        <Select value={distance} onValueChange={setDistance}>
                          <SelectTrigger data-invalid={errors.distance || undefined} className={`mt-1 ${errors.distance ? "border-destructive ring-2 ring-destructive/50 animate-pulse" : ""}`}><SelectValue placeholder="Distância" /></SelectTrigger>
                          <SelectContent>
                            {distances.map((d: any) => {
                              const l2 = d.price_lote2 > 0 && d.lote2_starts_at && today >= d.lote2_starts_at;
                              const current = l2 ? d.price_lote2 : d.price;
                              return (
                                <SelectItem key={d.distance} value={d.distance}>
                                  {d.distance}{current ? ` (${brl(current)} · ${l2 ? "2º lote" : "1º lote"})` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {genders.length > 1 && (
                      <div>
                        <Label className={errors.gender ? "text-destructive" : ""}>Sexo *</Label>
                        <Select value={gender} onValueChange={setGender}>
                          <SelectTrigger data-invalid={errors.gender || undefined} className={`mt-1 ${errors.gender ? "border-destructive ring-2 ring-destructive/50 animate-pulse" : ""}`}><SelectValue placeholder="Sexo" /></SelectTrigger>
                          <SelectContent>
                            {genders.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {ageBrackets.length > 1 && (
                      <div>
                        <Label className={errors.bracket ? "text-destructive" : ""}>Faixa etária *</Label>
                        <Select value={bracket} onValueChange={setBracket}>
                          <SelectTrigger data-invalid={errors.bracket || undefined} className={`mt-1 ${errors.bracket ? "border-destructive ring-2 ring-destructive/50 animate-pulse" : ""}`}><SelectValue placeholder="Faixa" /></SelectTrigger>
                          <SelectContent>
                            {ageBrackets.map((b) => (
                              <SelectItem key={`${b.min}-${b.max}`} value={`${b.min}-${b.max}`}>
                                {b.min} a {b.max} anos
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {kitOptions.length > 0 && (
                <div>
                  <Label className={errors.kitOption ? "text-destructive" : ""}>Opção de kit *</Label>
                  <Select value={kitOption} onValueChange={setKitOption}>
                    <SelectTrigger data-invalid={errors.kitOption || undefined} className={`mt-1 ${errors.kitOption ? "border-destructive ring-2 ring-destructive/50 animate-pulse" : ""}`}><SelectValue placeholder="Escolha o kit" /></SelectTrigger>
                    <SelectContent>
                      {kitOptions.map((k) => (
                        <SelectItem key={k.name} value={k.name}>
                          {k.name}{k.extra_price ? ` (+${brl(k.extra_price)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="team">Nome da equipe (opcional)</Label>
                <Input id="team" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-1" maxLength={120} />
              </div>

              {coupons.length > 0 && (
                <div>
                  <Label>Cupom (opcional)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Tem um cupom? Informe aqui" />
                    <Button type="button" variant="outline" onClick={applyCoupon}>Aplicar</Button>
                  </div>
                  {appliedCoupon && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Cupom {appliedCoupon.code} aplicado{appliedCoupon.description ? `: ${appliedCoupon.description}` : ""}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} maxLength={1000} />
              </div>

              {total > 0 && (
                <div className="bg-secondary/40 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>
                      Inscrição
                      {distanceObj && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({lote2Active ? "2º lote" : "1º lote"})
                        </span>
                      )}
                    </span>
                    <span>{brl(distancePrice)}</span>
                  </div>
                  {distanceObj && (distanceObj as any).price_lote2 > 0 && (distanceObj as any).lote2_starts_at && !lote2Active && (
                    <p className="text-[11px] text-muted-foreground">
                      A partir de {(() => { const [y,m,dd] = (distanceObj as any).lote2_starts_at.split("-"); return `${dd}/${m}/${y}`; })()} o valor passa para {brl((distanceObj as any).price_lote2)} (2º lote).
                    </p>
                  )}
                  {kitExtra > 0 && <div className="flex justify-between"><span>Kit ({kitOption})</span><span>+{brl(kitExtra)}</span></div>}
                  <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span>{brl(total)}</span></div>
                  <p className="text-xs text-muted-foreground">Pagamento combinado diretamente com a equipe.</p>
                </div>
              )}

              <div data-invalid={errors.terms || undefined} className={`flex items-start gap-2 rounded-lg p-2 -m-2 ${errors.terms ? "ring-2 ring-destructive/60 bg-destructive/5 animate-pulse" : ""}`}>
                <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(!!v)} className={`mt-0.5 ${errors.terms ? "border-destructive" : ""}`} />
                <label htmlFor="terms" className={`text-sm cursor-pointer ${errors.terms ? "text-destructive font-medium" : ""}`}>
                  Estou de acordo com os{" "}
                  {event.regulation_url ? (
                    <a href={event.regulation_url} target="_blank" rel="noreferrer" className="text-brand underline">termos e regulamento</a>
                  ) : "termos e regulamento"} do evento.
                </label>
              </div>

              <Button onClick={submit} disabled={submitting || !profileComplete} variant="brand" size="lg" className="w-full">
                {submitting ? "Enviando..." : "Confirmar inscrição"}
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value || <span className="text-muted-foreground">não informado</span>}</dd>
  </div>
);

export default ProvaInscricao;
