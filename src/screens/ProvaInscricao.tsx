import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, MapPin, CheckCircle2, Tag, Copy, MessageCircle, Check, ChevronLeft, Shirt, Ruler } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import {
  activeLote,
  currentPrice,
  effectivePrice,
  hasSeniorPrice,
  isSenior,
  isSeniorOnlyDistance,
  isKidsDistance,
} from "@/lib/eventPricing";
import { LoteBreakdown } from "@/components/site/LoteBreakdown";

import { PixPayment } from "@/components/site/PixPayment";

type Distance = { distance: string; price?: number };
type AgeBracket = { min: number; max: number };
type KitOption = { name: string; extra_price?: number; sizes?: string[]; size_chart_url?: string; size_chart_info?: string };
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

/** Idade esportiva: ano da prova - ano de nascimento (ignora mês/dia). */
const sportAge = (birth?: string | null, eventDate?: string | null) => {
  if (!birth || !eventDate) return null;
  const by = Number(String(birth).slice(0, 4));
  const ey = Number(String(eventDate).slice(0, 4));
  if (!Number.isFinite(by) || !Number.isFinite(ey)) return null;
  return ey - by;
};

/** Converte profiles.gender ("feminino"/"F"/...) para o rótulo usado no evento. */
const genderLabelFrom = (raw?: string | null, options: string[] = []) => {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  const target = s.startsWith("f") ? "f" : s.startsWith("m") ? "m" : "";
  if (!target) return "";
  const match = options.find((o) => o.trim().toLowerCase().startsWith(target));
  return match || (target === "f" ? "Feminino" : "Masculino");
};


const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STEPS = ["Inscrição", "Dados", "Pagamento"];

// Deriva a categoria a partir do nome da modalidade (ex.: "3Km Caminhada - 60+")
const GROUP_RULES: { label: string; test: RegExp }[] = [
  { label: "60+", test: /(\b60\s*\+|\b60\s*anos|master|melhor idade)/i },
  { label: "Kids", test: /(kids|infantil|kid|mirim)/i },
  { label: "PCD", test: /(pcd|cadeirante|deficien)/i },
];

const groupOf = (name: string) => {
  const found = GROUP_RULES.find((r) => r.test.test(name));
  return found ? found.label : "Geral";
};

const cleanDistanceLabel = (name: string) => {
  const g = groupOf(name);
  if (g === "Geral") return name;
  return name.replace(/\s*[-–·|]\s*[^-–·|]*$/, (m) => (GROUP_RULES.some((r) => r.test.test(m)) ? "" : m)).trim() || name;
};


const Stepper = ({ current }: { current: number }) => (
  <div className="flex items-start justify-center gap-1 sm:gap-4 mb-6 sm:mb-8">
    {STEPS.map((label, i) => {
      const state = i < current ? "done" : i === current ? "active" : "todo";
      return (
        <div key={label} className="flex items-start">
          <div className="flex flex-col items-center w-[72px] sm:w-28">
            <div
              className={[
                "w-9 h-9 rounded-full grid place-items-center text-sm font-bold border-2 transition-colors",
                state === "active"
                  ? "border-brand text-brand bg-brand/10"
                  : state === "done"
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border text-muted-foreground bg-secondary/40",
              ].join(" ")}
            >
              {state === "done" ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`mt-2 text-[11px] leading-tight text-center sm:text-sm ${state === "todo" ? "text-muted-foreground" : "font-semibold"}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className="h-[2px] w-8 sm:w-24 bg-border mt-[18px]" />}
        </div>
      );
    })}
  </div>
);

const ProvaInscricao = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const buildWhats = useWhatsappLink();

  const [step, setStep] = useState(0);
  const [distance, setDistance] = useState("");
  const [gender, setGender] = useState("");
  const [bracket, setBracket] = useState("");
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [shirtSize, setShirtSize] = useState("");
  const [sizeChartKit, setSizeChartKit] = useState<KitOption | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [teamName, setTeamName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [signupId, setSignupId] = useState<string | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});



  // Clear individual error as user fills the field
  useEffect(() => { if (distance && errors.distance) setErrors((e) => ({ ...e, distance: false })); }, [distance]);
  useEffect(() => { if (gender && errors.gender) setErrors((e) => ({ ...e, gender: false })); }, [gender]);
  useEffect(() => { if (bracket && errors.bracket) setErrors((e) => ({ ...e, bracket: false })); }, [bracket]);
  useEffect(() => { if (selectedKits.length && errors.kitOption) setErrors((e) => ({ ...e, kitOption: false })); }, [selectedKits]);
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

  const payment = event
    ? {
        pix_key: (event as any).pix_key,
        pix_recipient: (event as any).pix_recipient,
        payment_instructions: (event as any).payment_instructions,
      }
    : null;


  // Inscrições já existentes desta pessoa nesta prova (rascunhos retomáveis)
  const { data: myEventSignups = [] } = useQuery({
    queryKey: ["event_signup_existing", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_signups")
        .select("*")
        .eq("event_id", id!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingSignup = useMemo(
    () => myEventSignups.find((s) => s.status !== "confirmada" && s.status !== "cancelada") ?? null,
    [myEventSignups]
  );



  const distances = useMemo<Distance[]>(() => {
    if (!event) return [];
    const arr = ((event.distances as Distance[]) || []).filter(
      (d) => d?.distance?.trim() && !isSeniorOnlyDistance(d.distance)
    );
    if (arr.length) return arr;
    return (event.distance || "")
      .split(/[•|,/]/)
      .map((s: string) => ({ distance: s.trim() }))
      .filter((d: Distance) => d.distance && !isSeniorOnlyDistance(d.distance));
  }, [event]);

  const groups = useMemo<string[]>(() => {
    const found = Array.from(new Set(distances.map((d) => groupOf(d.distance))));
    if (found.length <= 1) return [];
    const order = ["Geral", "60+", "Kids", "PCD"];
    return found.sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [distances]);

  const [group, setGroup] = useState("Geral");
  useEffect(() => { if (groups.length && !groups.includes(group)) setGroup(groups[0]); }, [groups]);

  const visibleDistances = useMemo(
    () => (groups.length ? distances.filter((d) => groupOf(d.distance) === group) : distances),
    [distances, groups, group]
  );

  // Ao trocar de categoria, limpa a modalidade que não pertence mais à lista
  useEffect(() => {
    if (distance && !visibleDistances.some((d) => d.distance === distance)) setDistance("");
  }, [visibleDistances]);



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

  // Kit selecionado que possui camiseta (tamanhos configurados pelo admin)
  const shirtKit = useMemo(
    () => kitOptions.find((k) => selectedKits.includes(k.name) && Array.isArray(k.sizes) && k.sizes.length > 0) || null,
    [kitOptions, selectedKits]
  );
  const availableSizes = shirtKit?.sizes ?? [];
  useEffect(() => {
    if (shirtSize && !availableSizes.includes(shirtSize)) setShirtSize("");
  }, [availableSizes.join("|")]);
  useEffect(() => { if (shirtSize && errors.shirtSize) setErrors((e) => ({ ...e, shirtSize: false })); }, [shirtSize]);



  // Auto-pick when there's only one option
  useEffect(() => { if (distances.length === 1) setDistance(distances[0].distance); }, [distances]);
  useEffect(() => { if (kitOptions.length === 1) setSelectedKits([kitOptions[0].name]); }, [kitOptions]);

  // Sexo automático a partir do cadastro (profiles.gender)
  const profileGender = useMemo(() => genderLabelFrom(profile?.gender, genders), [profile?.gender, genders]);
  useEffect(() => { setGender(profileGender); }, [profileGender]);

  // Idade esportiva (ano da prova - ano de nascimento) e faixa etária automática
  const categoryAge = useMemo(
    () => sportAge(profile?.birth_date, (event as any)?.date),
    [profile?.birth_date, event]
  );
  const autoBracket = useMemo(() => {
    if (categoryAge == null || !ageBrackets.length) return "";
    const match = ageBrackets.find((b) => categoryAge >= b.min && categoryAge <= b.max);
    return match ? `${match.min}-${match.max}` : "";
  }, [categoryAge, ageBrackets]);
  useEffect(() => { setBracket(autoBracket); }, [autoBracket]);

  const profileComplete = profile && profile.full_name && profile.cpf && profile.whatsapp && profile.cep;


  const distanceObj = distances.find((d) => d.distance === distance);
  const senior = isSenior(profile?.birth_date);
  const basePriceOf = (d: any) => currentPrice(d ?? {});
  const seniorForDistance = (d: any) => senior && !isKidsDistance(d?.distance);
  const priceOf = (d: any) => effectivePrice(d ?? {}, seniorForDistance(d));
  const seniorApplied = (d: any) => seniorForDistance(d) && hasSeniorPrice(d ?? {});
  const loteOf = (d: any) => activeLote(d ?? {});
  const currentLote = loteOf(distanceObj);
  const baseDistancePrice = basePriceOf(distanceObj);
  const distancePrice = priceOf(distanceObj);
  const seniorFixed = seniorApplied(distanceObj);

  const kitExtra = kitOptions
    .filter((k) => selectedKits.includes(k.name))
    .reduce((sum, k) => sum + (k.extra_price ?? 0), 0);
  const total = distancePrice + kitExtra;

  const categoryLabel = useMemo(() => {
    const parts = [distance, gender, bracket && `${bracket} anos`].filter(Boolean);
    return parts.join(" · ");
  }, [distance, gender, bracket]);

  const whatsMessage = useMemo(() => {
    const lines = [
      `Olá! Sou ${profile?.full_name || "atleta"} e fiz minha inscrição na ${event?.name || "prova"}.`,
      "",
      distance && `Modalidade: ${distance}`,
      (gender || bracket) && `Categoria: ${[gender, bracket && `${bracket} anos`].filter(Boolean).join(" · ")}`,
      selectedKits.length && `Kit: ${selectedKits.join(", ")}`,
      shirtSize && `Tamanho da camiseta: ${shirtSize}`,
      total > 0 && `Valor: ${brl(total)}`,
      "",
      "Gostaria de enviar meu comprovante PIX.",
    ].filter((l) => l !== false && l !== 0 && l !== undefined && l !== null && l !== "" || l === "");
    return (lines as string[]).join("\n");
  }, [profile?.full_name, event?.name, distance, gender, bracket, selectedKits, shirtSize, total]);

  // Retomar rascunho pendente sem criar nova inscrição
  const resumeSignup = (signup: { id: string; category: string | null; kit_option?: string | null; team_name?: string | null; coupon_code?: string | null; shirt_size?: string | null }) => {
    const parts = (signup.category || "").split("·").map((p) => p.trim()).filter(Boolean);
    const savedDistance = parts.find((p) => distances.some((d) => d.distance === p));
    if (savedDistance) {
      const g = groupOf(savedDistance);
      if (groups.includes(g)) setGroup(g);
      setDistance(savedDistance);
    }
    let kits: string[] = [];
    try {
      const parsed = JSON.parse(signup.kit_option || "[]");
      if (Array.isArray(parsed)) kits = parsed.filter((k) => typeof k === "string");
      else if (typeof parsed === "string" && parsed) kits = [parsed];
    } catch {
      if (signup.kit_option) kits = [signup.kit_option];
    }
    if (kits.length) setSelectedKits(kits);
    const savedSize = (signup as any)?.shirt_size;
    if (savedSize) setShirtSize(savedSize);
    if (signup.team_name) setTeamName(signup.team_name);
    if (signup.coupon_code) {
      const found = coupons.find((c) => c.code.toUpperCase() === signup.coupon_code!.toUpperCase());
      if (found) setAppliedCoupon(found);
    }
    setSignupId(signup.id);
    setAcceptedTerms(true);
    setResumeDismissed(true);

    const ready = !!profileComplete && !!savedDistance && (kitOptions.length === 0 || kits.length > 0);
    if (ready) {
      setDone(true);
      setStep(2);
    } else {
      setStep(savedDistance ? 1 : 0);
      if (!profileComplete) toast.info("Complete os dados obrigatórios para seguir ao pagamento.");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Retomada automática via /provas/:id/inscricao?retomar=<signupId>
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !pendingSignup || !distances.length) return;
    const wanted = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("retomar") : null;
    if (!wanted) return;
    if (wanted !== "1" && wanted !== pendingSignup.id) return;
    resumedRef.current = true;
    resumeSignup(pendingSignup);
  }, [pendingSignup, distances, kitOptions, profileComplete]);

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

  const goStep2 = () => {
    const newErrors: Record<string, boolean> = {};
    const missing: string[] = [];
    if (distances.length > 0 && !distance) { newErrors.distance = true; missing.push("Modalidade"); }
    if (kitOptions.length > 0 && selectedKits.length === 0) { newErrors.kitOption = true; missing.push("Kit"); }
    if (availableSizes.length > 0 && !shirtSize) { newErrors.shirtSize = true; missing.push("Tamanho da camiseta"); }
    if (missing.length) {
      setErrors(newErrors);
      toast.error("Selecione para continuar", { description: missing.join(" · "), position: "top-center" });
      return;
    }
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!user || !event) return;
    const newErrors: Record<string, boolean> = {};
    const missingLabels: string[] = [];
    if (distances.length > 0 && !distance) { newErrors.distance = true; missingLabels.push("Distância"); }
    if (genders.length > 0 && !gender) { newErrors.gender = true; missingLabels.push("Sexo (complete no seu cadastro)"); }
    if (ageBrackets.length > 0 && !bracket) { newErrors.bracket = true; missingLabels.push("Data de nascimento (complete no seu cadastro)"); }
    if (kitOptions.length > 0 && selectedKits.length === 0) { newErrors.kitOption = true; missingLabels.push("Opção de kit"); }
    if (availableSizes.length > 0 && !shirtSize) { newErrors.shirtSize = true; missingLabels.push("Tamanho da camiseta"); }
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

    const payload = {
      category: categoryLabel,
      status: "pendente",
      notes: seniorApplied(distanceObj) ? [notes, `[Benefício 60+ aplicado: valor fixo ${brl(distancePrice)}]`].filter(Boolean).join(" ") : notes,
      kit_option: selectedKits.length ? JSON.stringify(selectedKits) : "",
      shirt_size: shirtSize || null,
      coupon_code: appliedCoupon?.code || "",
      team_name: teamName,
      accepted_event_terms_at: new Date().toISOString(),
    };

    // Já existe inscrição desta pessoa nesta prova/categoria?
    const { data: existing, error: findError } = await supabase
      .from("event_signups")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("event_id", event.id)
      .eq("category", categoryLabel)
      .maybeSingle();

    if (findError) {
      setSubmitting(false);
      toast.error(findError.message);
      return;
    }

    if (existing && existing.status === "confirmada") {
      setSubmitting(false);
      toast.error("Você já está inscrito nesta categoria.");
      return;
    }

    let error = null as { code?: string; message: string } | null;
    if (existing) {
      // Retoma o rascunho pendente/cancelado: atualiza, nunca duplica
      const res = await supabase.from("event_signups").update(payload as any).eq("id", existing.id);
      error = res.error;
      if (!error) setSignupId(existing.id);
    } else {
      const res = await supabase
        .from("event_signups")
        .insert({ user_id: user.id, event_id: event.id, ...payload } as any)
        .select("id")
        .maybeSingle();
      error = res.error;
      if (!error && res.data?.id) setSignupId(res.data.id);
    }

    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error("Você já está inscrito nesta categoria.");
      else toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my_signups"] });
    qc.invalidateQueries({ queryKey: ["event_signup_existing", id, user.id] });
    setDone(true);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  if (loading || !user) return null;

  const summaryCard = event && (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 lg:sticky lg:top-28">
      <div>
        <h2 className="font-display text-lg font-bold leading-tight">{event.name}</h2>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-brand" />
            {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
          <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-brand" />{event.city}</span>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Modalidade</span>
          <span className="font-medium text-right">{distance || "—"}</span>
        </div>
          {kitOptions.length > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Kit</span>
              <span className="font-medium text-right">{selectedKits.join(", ") || "—"}</span>
            </div>
          )}
        {shirtSize && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Camiseta</span>
            <span className="font-medium text-right">{shirtSize}</span>
          </div>
        )}
        {(gender || bracket) && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Categoria</span>
            <span className="font-medium text-right">{[gender, bracket && `${bracket} anos`].filter(Boolean).join(" · ")}</span>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="border-t border-border pt-3 space-y-1 text-sm">
          {seniorFixed ? (
            <div className="flex justify-between text-success font-medium">
              <span>Benefício 60+ aplicado</span>
              <span>{brl(distancePrice)}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Valor do lote atual <span className="text-xs text-muted-foreground">({currentLote}º lote)</span></span>
              <span>{brl(baseDistancePrice)}</span>
            </div>
          )}
          {kitExtra > 0 && <div className="flex justify-between"><span>Kit</span><span>+{brl(kitExtra)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span>Valor final</span><span className="text-brand">{brl(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">Pagamento via PIX após a confirmação.</p>
        </div>
      )}

    </div>
  );

  return (
    <Layout>
      <SEO title={`Inscrição: ${event?.name || "Prova"}`} description="Inscrição em prova de corrida." />
      <section className="section-padding pt-28">
        <div className="container-page max-w-5xl">
          <Link to={`/provas/${id}`} className="text-sm text-muted-foreground hover:text-brand mb-4 inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar para a prova
          </Link>

          {eventLoading || profileLoading ? (
            <Skeleton className="h-96" />
          ) : !event ? (
            <p className="text-center text-muted-foreground">Prova não encontrada.</p>
          ) : (
            <>
              <Stepper current={step} />

              {done ? (
                <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6">
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
                    {shirtSize && <div className="flex justify-between"><span className="text-muted-foreground">Camiseta</span><span className="font-medium">{shirtSize}</span></div>}
                    {total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-brand">{brl(total)}</span></div>}
                  </div>

                  <PixPayment
                    pixKey={payment?.pix_key || (event as any)?.pix_key}
                    recipient={payment?.pix_recipient || (event as any)?.pix_recipient}
                    city={event.city}
                    amount={total}
                    txid={`INSC${String(signupId || event.id).replace(/\D/g, "").slice(0, 10)}`}
                    instructions={payment?.payment_instructions || (event as any)?.payment_instructions}
                  />

                  <Button asChild variant="brand" size="lg" className="w-full">
                    <a
                      href={buildWhats(whatsMessage)}
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
                <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
                  <div className="space-y-6">
                    {pendingSignup && !resumeDismissed && (
                      <div className="bg-warning/10 border border-warning/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                        <div className="min-w-0">
                          <p className="font-display font-semibold">Você já iniciou sua inscrição nesta prova.</p>
                          <p className="text-sm text-muted-foreground">
                            Continue de onde parou para finalizar o pagamento.
                            {pendingSignup.category ? ` (${pendingSignup.category})` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="brand" size="sm" onClick={() => resumeSignup(pendingSignup)}>
                            Continuar inscrição
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResumeDismissed(true)}>
                            Começar do zero
                          </Button>
                        </div>
                      </div>
                    )}
                    {step === 0 && (

                      <>
                        <div>
                          <h1 className="font-display text-2xl sm:text-3xl font-bold">{event.name}</h1>
                          <p className="text-sm text-muted-foreground mt-1">Selecione a modalidade e o kit para ver o valor da inscrição.</p>
                        </div>

                        {distanceObj && seniorApplied(distanceObj) && (
                          <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
                            <span className="font-semibold text-success">Benefício 60+ aplicado</span>{" "}
                            <span className="text-muted-foreground">
                              — valor especial definido para a modalidade {cleanDistanceLabel(distanceObj.distance)}.
                            </span>
                          </div>
                        )}




                        {distances.length > 0 && (
                          <div
                            data-invalid={errors.distance || undefined}
                            className={`bg-card border rounded-2xl p-4 sm:p-5 ${errors.distance ? "border-destructive" : "border-border"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                              <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Modalidade</h3>
                              {groups.length > 1 && (
                                <div className="flex gap-1 overflow-x-auto no-scrollbar bg-secondary/40 border border-border rounded-full p-1">
                                  {groups.map((g) => (
                                    <button
                                      key={g}
                                      type="button"
                                      onClick={() => setGroup(g)}
                                      className={[
                                        "whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors",
                                        group === g
                                          ? "bg-brand text-brand-foreground font-semibold"
                                          : "text-muted-foreground hover:text-foreground",
                                      ].join(" ")}
                                    >
                                      {g}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {visibleDistances.map((d: any) => {
                                const active = distance === d.distance;
                                const base = basePriceOf(d);
                                const price = priceOf(d);
                                const fixed60 = seniorApplied(d);
                                return (
                                  <div key={d.distance} className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => setDistance(d.distance)}
                                    className={[
                                      "w-full text-left rounded-xl px-4 py-3 border transition-all flex items-center justify-between gap-3",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/30 hover:bg-secondary/60",
                                    ].join(" ")}
                                  >
                                    <span className="font-semibold">{cleanDistanceLabel(d.distance)}</span>
                                    {(fixed60 ? price > 0 : base > 0) && (
                                      <span className="text-sm">
                                        {fixed60 ? (
                                          <span className="text-success mr-1">60+</span>
                                        ) : (
                                          <span className="text-muted-foreground mr-1">{loteOf(d)}º lote</span>
                                        )}
                                        <span className="font-bold text-brand">{brl(price)}</span>
                                      </span>
                                    )}
                                  </button>
                                  {active && !fixed60 && <LoteBreakdown distance={d} className="px-1" />}
                                  </div>
                                );
                              })}

                              {visibleDistances.length === 0 && (
                                <p className="text-sm text-muted-foreground">Nenhuma modalidade nessa categoria.</p>
                              )}
                            </div>
                          </div>
                        )}


                        {kitOptions.length > 0 && (
                          <div
                            data-invalid={errors.kitOption || undefined}
                            className={`bg-card border rounded-2xl p-4 sm:p-5 ${errors.kitOption ? "border-destructive" : "border-border"}`}
                          >
                            <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Kit do atleta</h3>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {kitOptions.map((k) => {
                                const active = selectedKits.includes(k.name);
                                return (
                                  <button
                                    key={k.name}
                                    type="button"
                                    onClick={() => setSelectedKits((prev) => active ? prev.filter((n) => n !== k.name) : [...prev, k.name])}
                                    className={[
                                      "text-left rounded-xl px-4 py-3 border transition-all flex items-center gap-3",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/30 hover:bg-secondary/60",
                                    ].join(" ")}
                                  >
                                    <div className={[
                                      "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                                      active ? "bg-brand border-brand text-brand-foreground" : "border-border bg-background",
                                    ].join(" ")}>
                                      {active && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                    <Shirt className={`w-4 h-4 shrink-0 ${active ? "text-brand" : "text-muted-foreground"}`} />
                                    <span className="flex-1 font-medium">{k.name}</span>
                                    {k.extra_price ? <span className="text-sm text-brand font-semibold">+{brl(k.extra_price)}</span> : null}
                                  </button>
                                );
                              })}
                            </div>

                            {availableSizes.length > 0 && (
                              <div
                                data-invalid={errors.shirtSize || undefined}
                                className={`mt-4 rounded-xl border p-4 ${errors.shirtSize ? "border-destructive" : "border-border"} bg-secondary/20`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                  <h4 className="text-sm font-semibold">Escolha o tamanho da camiseta</h4>
                                  {(shirtKit?.size_chart_url || shirtKit?.size_chart_info) && (
                                    <button
                                      type="button"
                                      onClick={() => setSizeChartKit(shirtKit)}
                                      className="inline-flex items-center gap-1 text-xs text-brand underline underline-offset-2"
                                    >
                                      <Ruler className="w-3.5 h-3.5" /> Tabela de medidas
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {availableSizes.map((sz) => {
                                    const active = shirtSize === sz;
                                    return (
                                      <button
                                        key={sz}
                                        type="button"
                                        onClick={() => setShirtSize(sz)}
                                        className={[
                                          "min-w-[64px] min-h-[52px] px-4 rounded-xl border text-base font-bold transition-all",
                                          active
                                            ? "border-brand bg-brand text-brand-foreground"
                                            : "border-border bg-background hover:border-brand/60",
                                        ].join(" ")}
                                      >
                                        {sz}
                                      </button>
                                    );
                                  })}
                                </div>
                                {errors.shirtSize && (
                                  <p className="mt-2 text-xs text-destructive">Selecione um tamanho para continuar.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}



                        <Button onClick={goStep2} variant="brand" size="lg" className="w-full sm:w-auto sm:min-w-56">
                          Continuar
                        </Button>
                      </>
                    )}

                    {step === 1 && (
                      <>
                        <div>
                          <h1 className="font-display text-2xl sm:text-3xl font-bold">Seus dados</h1>
                          <p className="text-sm text-muted-foreground mt-1">Confira as informações e finalize a inscrição.</p>
                        </div>

                        {!profileComplete && (
                          <div className="bg-warning/15 border border-warning/40 text-foreground rounded-xl p-4 text-sm">
                            Seus dados estão incompletos. <Link to="/minha-conta" className="underline text-brand">Complete seu perfil</Link> antes de finalizar.
                          </div>
                        )}

                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
                          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                            <Field label="Nome" value={profile?.full_name} />
                            <Field label="CPF" value={profile?.cpf} />
                            <Field label="Idade" value={calcAge(profile?.birth_date) ? `${calcAge(profile?.birth_date)} anos` : ""} />
                            <Field label="Cidade" value={[profile?.city, profile?.state].filter(Boolean).join(" / ")} />
                            <Field label="E-mail" value={profile?.email || user.email || ""} />
                            <Field label="WhatsApp" value={profile?.whatsapp} />
                          </dl>
                        </div>

                        {(genders.length > 0 || ageBrackets.length > 0) && (
                          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
                            <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Categoria (automática)</h3>
                            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                              {genders.length > 0 && (
                                <div data-invalid={errors.gender || undefined}>
                                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sexo</dt>
                                  <dd className={`font-medium ${errors.gender ? "text-destructive" : ""}`}>
                                    {gender || "não informado no cadastro"}
                                  </dd>
                                </div>
                              )}
                              {ageBrackets.length > 0 && (
                                <div data-invalid={errors.bracket || undefined}>
                                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Faixa etária</dt>
                                  <dd className={`font-medium ${errors.bracket ? "text-destructive" : ""}`}>
                                    {bracket ? `${bracket.replace("-", " a ")} anos` : "não informada no cadastro"}
                                    {categoryAge != null && bracket && (
                                      <span className="text-muted-foreground font-normal"> · {categoryAge} anos no ano da prova</span>
                                    )}
                                  </dd>
                                </div>
                              )}
                            </div>
                            {(!gender && genders.length > 0) || (!bracket && ageBrackets.length > 0) ? (
                              <p className="text-sm text-destructive">
                                Faltam dados no seu cadastro (sexo e/ou data de nascimento).{" "}
                                <Link to="/minha-conta" className="underline text-brand">Complete seu cadastro</Link> para continuar.
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Definida automaticamente pelo seu cadastro. A idade considerada é o ano da prova menos o ano de nascimento.
                              </p>
                            )}
                          </div>
                        )}


                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
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
                        </div>

                        <div data-invalid={errors.terms || undefined} className={`flex items-start gap-2 rounded-lg p-2 ${errors.terms ? "ring-2 ring-destructive/60 bg-destructive/5" : ""}`}>
                          <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(!!v)} className={`mt-0.5 ${errors.terms ? "border-destructive" : ""}`} />
                          <label htmlFor="terms" className={`text-sm cursor-pointer ${errors.terms ? "text-destructive font-medium" : ""}`}>
                            Estou de acordo com os{" "}
                            {event.regulation_url ? (
                              <a href={event.regulation_url} target="_blank" rel="noreferrer" className="text-brand underline">termos e regulamento</a>
                            ) : "termos e regulamento"} do evento.
                          </label>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button variant="outline" size="lg" onClick={() => { setStep(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            <ChevronLeft className="w-4 h-4" /> Voltar
                          </Button>
                          <Button onClick={submit} disabled={submitting || !profileComplete} variant="brand" size="lg" className="flex-1">
                            {submitting ? "Enviando..." : total > 0 ? `Confirmar e pagar ${brl(total)}` : "Confirmar inscrição"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div>{summaryCard}</div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Dialog open={!!sizeChartKit} onOpenChange={(o) => !o && setSizeChartKit(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tabela de medidas</DialogTitle>
          </DialogHeader>
          {sizeChartKit?.size_chart_url && (
            <img
              src={sizeChartKit.size_chart_url}
              alt="Tabela de medidas da camiseta"
              className="w-full rounded-xl border border-border"
              loading="lazy"
            />
          )}
          {sizeChartKit?.size_chart_info && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{sizeChartKit.size_chart_info}</p>
          )}
        </DialogContent>
      </Dialog>
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
