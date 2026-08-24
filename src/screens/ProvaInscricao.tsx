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
import {
  useParticipants,
  useParticipantMutations,
  findExistingParticipant,
} from "@/hooks/useParticipants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, MapPin, CheckCircle2, Tag, Copy, MessageCircle, Check, ChevronLeft, Shirt, Ruler, User, Users } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import {
  activeLote,
  currentPrice,
  effectivePrice,
  hasSeniorPrice,
  isSeniorAtEvent,
  ageAtEvent,
  isSeniorOnlyDistance,
  isKidsDistance,
} from "@/lib/eventPricing";

import { LoteBreakdown } from "@/components/site/LoteBreakdown";

import { PixPayment } from "@/components/site/PixPayment";
import { Confetti } from "@/components/site/Confetti";

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

const STEPS = ["Participante", "Inscrição", "Pagamento"];

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


const Stepper = ({ current, onGo }: { current: number; onGo?: (i: number) => void }) => (
  <div className="flex items-start justify-center gap-1 sm:gap-4 mb-6 sm:mb-8">
    {STEPS.map((label, i) => {
      const state = i < current ? "done" : i === current ? "active" : "todo";
      const clickable = !!onGo && i < current;
      return (
        <div key={label} className="flex items-start">
          <button
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onGo?.(i)}
            aria-label={clickable ? `Voltar para a etapa ${label}` : label}
            className={`flex flex-col items-center w-[72px] sm:w-28 ${clickable ? "cursor-pointer group" : "cursor-default"}`}
          >
            <div
              className={[
                "w-9 h-9 rounded-full grid place-items-center text-sm font-bold border-2 transition-all",
                state === "active"
                  ? "border-brand text-brand bg-brand/10"
                  : state === "done"
                  ? "border-brand bg-brand text-brand-foreground group-hover:scale-105 group-hover:ring-4 group-hover:ring-brand/25"
                  : "border-border text-muted-foreground bg-secondary/40",
              ].join(" ")}
            >
              {state === "done" ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`mt-2 text-[11px] leading-tight text-center sm:text-sm ${state === "todo" ? "text-muted-foreground" : "font-semibold"} ${clickable ? "group-hover:text-brand" : ""}`}>{label}</span>
          </button>
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [distance, setDistance] = useState("");
  const [gender, setGender] = useState("");
  const [bracket, setBracket] = useState("");
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  
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

  // ---- PARTICIPANTE (rascunhos independentes: "eu mesmo" x "outra pessoa") ----
  type ParticipantDraft = {
    name: string; cpf: string; birth: string; gender: string; phone: string; shirtSize: string;
  };
  const EMPTY_DRAFT: ParticipantDraft = { name: "", cpf: "", birth: "", gender: "", phone: "", shirtSize: "" };

  const [isSelf, setIsSelf] = useState(true);
  const [selfDraft, setSelfDraft] = useState<ParticipantDraft>(EMPTY_DRAFT);
  const [otherDraft, setOtherDraft] = useState<ParticipantDraft>(EMPTY_DRAFT);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [saveToParticipants, setSaveToParticipants] = useState(false);
  const { data: savedParticipants = [] } = useParticipants();
  const { create: createParticipant } = useParticipantMutations();
  const [doneParticipants, setDoneParticipants] = useState<{ name: string; birth: string; self: boolean }[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const prefilledRef = useRef(false);

  const draft = isSelf ? selfDraft : otherDraft;
  const patchDraft = (patch: Partial<ParticipantDraft>) =>
    (isSelf ? setSelfDraft : setOtherDraft)((d) => ({ ...d, ...patch }));

  const pName = draft.name;
  const pCpf = draft.cpf;
  const pBirth = draft.birth;
  const pGender = draft.gender;
  const pPhone = draft.phone;
  const shirtSize = draft.shirtSize;

  const setPName = (v: string) => patchDraft({ name: v });
  const setPCpf = (v: string) => patchDraft({ cpf: v });
  const setPBirth = (v: string) => patchDraft({ birth: v });
  const setPGender = (v: string) => patchDraft({ gender: v });
  const setPPhone = (v: string) => patchDraft({ phone: v });
  const setShirtSize = (v: string) => patchDraft({ shirtSize: v });

  const fillWithProfile = () => {
    setSelfDraft((d) => ({
      ...d,
      name: d.name || profile?.full_name || "",
      cpf: d.cpf || profile?.cpf || "",
      birth: d.birth || (profile as any)?.birth_date || "",
      gender: d.gender || (profile as any)?.gender || "",
      phone: d.phone || profile?.whatsapp || "",
    }));
  };

  const clearParticipant = () => {
    setSelfDraft(EMPTY_DRAFT);
    setOtherDraft(EMPTY_DRAFT);
  };

  useEffect(() => {
    if (prefilledRef.current || !profile) return;
    prefilledRef.current = true;
    fillWithProfile();
  }, [profile]);





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

  // Sexo derivado do PARTICIPANTE
  const participantGenderLabel = useMemo(() => genderLabelFrom(pGender, genders), [pGender, genders]);
  useEffect(() => { setGender(participantGenderLabel); }, [participantGenderLabel]);

  // Idade esportiva do PARTICIPANTE (ano da prova - ano de nascimento)
  const categoryAge = useMemo(
    () => sportAge(pBirth, (event as any)?.date),
    [pBirth, event]
  );
  const autoBracket = useMemo(() => {
    if (categoryAge == null || !ageBrackets.length) return "";
    const match = ageBrackets.find((b) => categoryAge >= b.min && categoryAge <= b.max);
    return match ? `${match.min}-${match.max}` : "";
  }, [categoryAge, ageBrackets]);
  useEffect(() => { setBracket(autoBracket); }, [autoBracket]);

  const profileComplete = profile && profile.full_name && profile.cpf && profile.whatsapp && profile.cep;

  /** Menor de 18 na data da prova -> CPF opcional. */
  const isMinor = categoryAge != null && categoryAge < 18;
  const cpfRequired = !isMinor;
  const participantComplete = !!(pName.trim() && pBirth && pGender && (!cpfRequired || pCpf.trim()));

  const kidsDistances = useMemo(() => distances.filter((d) => isKidsDistance(d.distance)), [distances]);
  const adultDistances = useMemo(() => distances.filter((d) => !isKidsDistance(d.distance)), [distances]);

  /** Idade x modalidade: evita "KIDS • Feminino • 30–34 anos". */
  const ageMismatch = useMemo(() => {
    if (!distance || categoryAge == null) return null;
    const selKids = isKidsDistance(distance);
    if (selKids && categoryAge >= 18 && adultDistances.length) {
      return { message: "Esta modalidade é destinada a crianças.", options: adultDistances };
    }
    if (!selKids && categoryAge <= 12 && kidsDistances.length) {
      return { message: "Esta modalidade não corresponde à idade do participante.", options: kidsDistances };
    }
    return null;
  }, [distance, categoryAge, kidsDistances, adultDistances]);



  const distanceObj = distances.find((d) => d.distance === distance);
  // 60+ pela idade do PARTICIPANTE na data da prova
  const senior = isSeniorAtEvent(pBirth, (event as any)?.date);
  const basePriceOf = (d: any) => currentPrice(d ?? {});
  const seniorForDistance = (d: any) => senior && !isKidsDistance(d?.distance);
  const priceOf = (d: any) => effectivePrice(d ?? {}, seniorForDistance(d));
  const seniorApplied = (d: any) => seniorForDistance(d) && (hasSeniorPrice(d ?? {}) || basePriceOf(d) > 0);
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

  /** Rótulo amigável exibido na tela (o categoryLabel continua igual no banco). */
  const categoryDisplay = useMemo(() => {
    const ageLabel = isKidsDistance(distance) ? "Infantil" : bracket ? `${bracket.replace("-", "–")} anos` : "";
    return [distance && cleanDistanceLabel(distance), gender, ageLabel].filter(Boolean).join(" • ");
  }, [distance, gender, bracket]);

  const categoryReady = !!distance && !!gender && (!ageBrackets.length || !!bracket || isKidsDistance(distance)) && !ageMismatch;


  const whatsMessage = useMemo(() => {
    const lines = [
      `Olá! Sou ${profile?.full_name || "atleta"} e fiz uma inscrição na ${event?.name || "prova"}.`,
      "",
      pName && `Participante: ${pName}`,
      distance && `Modalidade: ${distance}`,
      (gender || bracket) && `Categoria: ${[gender, bracket && `${bracket} anos`].filter(Boolean).join(" · ")}`,
      selectedKits.length && `Kit: ${selectedKits.join(", ")}`,
      shirtSize && `Tamanho da camiseta: ${shirtSize}`,
      total > 0 && `Valor: ${brl(total)}`,
      "",
      "Gostaria de enviar o comprovante PIX.",
    ].filter((l) => l !== false && l !== 0 && l !== undefined && l !== null && l !== "" || l === "");
    return (lines as string[]).join("\n");
  }, [profile?.full_name, pName, event?.name, distance, gender, bracket, selectedKits, shirtSize, total]);


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
    const savedSize = (signup as any)?.shirt_size || "";
    if (signup.team_name) setTeamName(signup.team_name);
    if (signup.coupon_code) {
      const found = coupons.find((c) => c.code.toUpperCase() === signup.coupon_code!.toUpperCase());
      if (found) setAppliedCoupon(found);
    }
    const sg = signup as any;
    if (sg.participant_full_name) {
      const self = (sg.participant_full_name || "") === (profile?.full_name || "");
      const restored = {
        name: sg.participant_full_name,
        cpf: sg.participant_cpf || "",
        birth: sg.participant_birth_date || "",
        gender: sg.participant_gender || "",
        phone: sg.participant_phone || "",
        shirtSize: savedSize,
      };
      (self ? setSelfDraft : setOtherDraft)(restored);
      setIsSelf(self);
      prefilledRef.current = true;
    } else if (savedSize) {
      setShirtSize(savedSize);
    }
    setSignupId(signup.id);
    setAcceptedTerms(true);
    setResumeDismissed(true);

    const ready = !!(sg.participant_full_name || profileComplete) && !!savedDistance && (kitOptions.length === 0 || kits.length > 0);
    if (ready) {
      setDone(true);
      setStep(2);
    } else {
      setStep(sg.participant_full_name ? 1 : 0);
      if (!sg.participant_full_name) toast.info("Confirme os dados do participante para seguir.");
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

  /** Etapa 1 -> 2: valida apenas os dados do participante. */
  const goStep2 = () => {
    const newErrors: Record<string, boolean> = {};
    const missing: string[] = [];
    if (!pName.trim()) { newErrors.pName = true; missing.push("Nome completo"); }
    if (!pBirth) { newErrors.pBirth = true; missing.push("Data de nascimento"); }
    if (!pGender) { newErrors.pGender = true; missing.push("Sexo"); }
    if (cpfRequired && !pCpf.trim()) { newErrors.pCpf = true; missing.push("CPF"); }
    if (missing.length) {
      setErrors(newErrors);
      toast.error("Preencha para continuar", { description: missing.join(" · "), position: "top-center" });
      return;
    }
    const dup = doneParticipants.some(
      (p) => p.name.trim().toLowerCase() === pName.trim().toLowerCase() && p.birth === pBirth
    );
    if (dup) toast.warning("Você já inscreveu alguém com este nome e data de nascimento nesta sessão.");
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!user || !event) return;
    const newErrors: Record<string, boolean> = {};
    const missingLabels: string[] = [];
    if (distances.length > 0 && !distance) { newErrors.distance = true; missingLabels.push("Modalidade"); }
    if (!pName.trim()) { newErrors.pName = true; missingLabels.push("Nome completo"); }
    if (cpfRequired && !pCpf.trim()) { newErrors.pCpf = true; missingLabels.push("CPF"); }
    if (!pBirth) { newErrors.pBirth = true; missingLabels.push("Data de nascimento"); }
    if (!pGender) { newErrors.pGender = true; missingLabels.push("Sexo"); }
    if (ageBrackets.length > 0 && !bracket && !isKidsDistance(distance)) { newErrors.bracket = true; missingLabels.push("Data de nascimento"); }
    if (kitOptions.length > 0 && selectedKits.length === 0) { newErrors.kitOption = true; missingLabels.push("Kit"); }
    if (availableSizes.length > 0 && !shirtSize) { newErrors.shirtSize = true; missingLabels.push("Tamanho da camiseta"); }
    if (!acceptedTerms) { newErrors.terms = true; missingLabels.push("Aceitar os termos"); }
    if (ageMismatch) {
      setErrors({ ...newErrors, distance: true });
      toast.error("Ajuste a modalidade", { description: ageMismatch.message, position: "top-center" });
      return;
    }


    if (missingLabels.length) {
      setErrors(newErrors);
      toast.error("Preencha os campos destacados", {
        description: Array.from(new Set(missingLabels)).join(" · "),
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
    setSubmitError(null);

    setSubmitting(true);

    const payload = {
      category: categoryLabel,
      status: "pendente",
      notes: seniorApplied(distanceObj) ? [notes, `[Benefício 60+ aplicado: ${brl(distancePrice)}]`].filter(Boolean).join(" ") : notes,
      kit_option: selectedKits.length ? JSON.stringify(selectedKits) : "",
      shirt_size: shirtSize || null,
      coupon_code: appliedCoupon?.code || "",
      team_name: teamName,
      accepted_event_terms_at: new Date().toISOString(),
      participant_full_name: pName.trim(),
      participant_cpf: pCpf.trim(),
      participant_birth_date: pBirth,
      participant_gender: pGender,
      participant_phone: pPhone.trim() || null,
    };

    let error = null as { code?: string; message: string } | null;
    let createdId: string | null = null;

    if (signupId) {
      // Retomando um rascunho pendente já existente
      const res = await supabase.from("event_signups").update(payload as any).eq("id", signupId);
      error = res.error;
      createdId = signupId;
    } else {
      const res = await supabase
        .from("event_signups")
        .insert({ user_id: user.id, event_id: event.id, ...payload } as any)
        .select("id")
        .maybeSingle();
      error = res.error;
      createdId = res.data?.id ?? null;

      // Compatibilidade com a restrição antiga (user_id + event_id + category):
      // se colidir, reaproveita o registro pendente/cancelado existente.
      if (error?.code === "23505") {
        const { data: existing } = await supabase
          .from("event_signups")
          .select("id, status, participant_full_name")
          .eq("user_id", user.id)
          .eq("event_id", event.id)
          .eq("category", categoryLabel)
          .maybeSingle();
        if (existing && existing.status !== "confirmada") {
          const res2 = await supabase.from("event_signups").update(payload as any).eq("id", existing.id);
          error = res2.error;
          createdId = existing.id;
        } else {
          setSubmitting(false);
          toast.error(
            "Já existe uma inscrição confirmada nesta categoria por esta conta. Fale com a organização para incluir outro participante nesta mesma categoria."
          );
          return;
        }
      }
    }

    if (error) {
      setSubmitting(false);
      setSubmitError(
        "Não conseguimos registrar sua inscrição agora. Seus dados foram mantidos — tente novamente em instantes."
      );
      toast.error("Não foi possível registrar a inscrição", {
        description: error.message,
        position: "top-center",
      });
      return;
    }

    // Confirmação real: só seguimos para a tela de sucesso se a linha existir no banco.
    let persisted: { id: string; status: string } | null = null;
    if (createdId) {
      const { data: check } = await supabase
        .from("event_signups")
        .select("id, status")
        .eq("id", createdId)
        .maybeSingle();
      persisted = (check as any) ?? null;
    }

    setSubmitting(false);

    if (!persisted?.id) {
      setSubmitError(
        "Não conseguimos confirmar o registro da sua inscrição. Nada foi perdido — revise os dados e tente novamente."
      );
      toast.error("Inscrição não confirmada", {
        description: "Tente novamente. Se persistir, fale com a organização pelo WhatsApp.",
        position: "top-center",
      });
      return;
    }

    setSignupId(persisted.id);
    setSubmitError(null);
    setDoneParticipants((prev) => [...prev, { name: pName.trim(), birth: pBirth, self: isSelf }]);

    // Opcional: salvar essa pessoa em "Meus participantes" (não altera a inscrição).
    if (!isSelf && selectedParticipantId === null && saveToParticipants) {
      const dup = findExistingParticipant(savedParticipants, {
        full_name: pName.trim(),
        cpf: pCpf,
        birth_date: pBirth,
      });
      if (dup) {
        toast.info("Este participante já está salvo em Meus participantes.");
      } else {
        try {
          await createParticipant.mutateAsync({
            full_name: pName.trim(),
            cpf: pCpf.trim() || null,
            birth_date: pBirth || null,
            gender: pGender || null,
            phone: pPhone.trim() || null,
          });
          toast.success("Participante salvo para as próximas provas.");
        } catch (e: any) {
          toast.error("Inscrição registrada, mas não conseguimos salvar o participante.");
        }
      }
      setSaveToParticipants(false);
    }

    qc.invalidateQueries({ queryKey: ["my_signups"] });
    qc.invalidateQueries({ queryKey: ["event_signup_existing", id, user.id] });
    try {
      sessionStorage.setItem("corporacao:last_signup_id", persisted.id);
    } catch {}
    setDone(true);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Recomeça o fluxo para inscrever outro participante na mesma prova. */
  const startAnotherParticipant = () => {
    setDone(false);
    setSignupId(null);
    setStep(0);
    setSelectedKits(kitOptions.length === 1 ? [kitOptions[0].name] : []);
    setNotes("");
    setAcceptedTerms(false);
    setAppliedCoupon(null);
    setCouponInput("");
    setOtherDraft(EMPTY_DRAFT);
    setSelectedParticipantId(null);
    setSaveToParticipants(false);
    const selfDone = doneParticipants.some((p) => p.self);
    if (selfDone) setSelfDraft(EMPTY_DRAFT);
    setIsSelf(false);
    setErrors({});
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
              <Stepper current={step} onGo={done ? undefined : (i) => setStep(i)} />

              {done ? (
                <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-4 sm:p-7 space-y-5">
                  <Confetti fire={done} />
                  <div className="text-center">
                    <CheckCircle2 className="w-11 h-11 text-success mx-auto mb-2" />
                    <h1 className="font-display text-xl sm:text-2xl font-bold mb-2">Inscrição registrada! 🎉</h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
                      🟡 Aguardando pagamento
                    </span>
                    <p className="text-muted-foreground text-sm mt-2.5">
                      Seu cadastro foi salvo. Agora falta realizar o pagamento e enviar o comprovante para concluir a confirmação.
                    </p>
                  </div>

                  {/* Resumo compacto */}
                  <div className="rounded-2xl border border-border bg-secondary/40 p-3.5 space-y-1.5 text-sm">
                    {pName && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Participante</span><span className="font-medium text-right break-words">{pName}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Prova</span><span className="font-medium text-right break-words">{event.name}</span></div>
                    {distance && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Modalidade</span><span className="font-medium text-right">{distance}</span></div>}
                    {total > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Valor</span><span className="font-bold text-brand">{brl(total)}</span></div>}
                  </div>

                  {/* Detalhes recolhíveis */}
                  <details className="group rounded-2xl border border-border bg-background/50">
                    <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-medium">
                      <span>Ver detalhes da inscrição</span>
                      <ChevronLeft className="w-4 h-4 -rotate-90 group-open:rotate-90 transition-transform text-muted-foreground" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-sm border-t border-border pt-3">
                      {pName && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Participante</span><span className="font-medium text-right break-words">{pName}</span></div>}
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Prova</span><span className="font-medium text-right break-words">{event.name}</span></div>
                      {distance && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Modalidade</span><span className="font-medium text-right">{distance}</span></div>}
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Categoria</span><span className="font-medium text-right">{categoryDisplay || categoryLabel}</span></div>
                      {shirtSize && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Camiseta</span><span className="font-medium text-right">{shirtSize}</span></div>}
                      {total > 0 && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Valor</span><span className="font-bold text-brand">{brl(total)}</span></div>}
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><span className="font-medium text-warning">Aguardando pagamento</span></div>
                      {signupId && (
                        <div className="flex justify-between gap-3 border-t border-border pt-2">
                          <span className="text-muted-foreground">Nº da inscrição</span>
                          <span className="font-mono text-xs break-all text-right">{signupId}</span>
                        </div>
                      )}
                    </div>
                  </details>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">
                      2. Realize o pagamento
                    </p>
                    <PixPayment
                      pixKey={payment?.pix_key || (event as any)?.pix_key}
                      recipient={payment?.pix_recipient || (event as any)?.pix_recipient}
                      city={event.city}
                      amount={total}
                      txid={`INSC${String(signupId || event.id).replace(/\D/g, "").slice(0, 10)}`}
                      instructions={payment?.payment_instructions || (event as any)?.payment_instructions}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      3. Envie o comprovante
                    </p>
                    <Button asChild variant="brand" size="lg" className="w-full">
                      <a href={buildWhats(whatsMessage)} target="_blank" rel="noreferrer">
                        <MessageCircle className="w-4 h-4" /> Enviar comprovante no WhatsApp
                      </a>
                    </Button>
                  </div>

                  <Button onClick={startAnotherParticipant} variant="outline" size="lg" className="w-full">
                    + Inscrever outra pessoa nesta prova
                  </Button>

                  {doneParticipants.length > 1 && (
                    <p className="text-center text-xs text-muted-foreground">
                      Nesta sessão você já inscreveu: {doneParticipants.map((p) => p.name).join(", ")}.
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button asChild variant="ghost" size="sm"><Link to="/minha-conta">Ver minhas inscrições</Link></Button>
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
                        <div className="grid grid-cols-1 sm:flex gap-2 shrink-0">
                          <Button variant="brand" className="w-full sm:w-auto min-h-11" onClick={() => resumeSignup(pendingSignup)}>
                            Continuar inscrição
                          </Button>
                          <Button variant="ghost" className="w-full sm:w-auto min-h-11" onClick={() => setResumeDismissed(true)}>
                            Começar do zero
                          </Button>
                        </div>
                      </div>
                    )}
                    {step === 0 && (
                      <>
                        <div>
                          <h1 className="font-display text-2xl sm:text-3xl font-bold">Quem você quer inscrever?</h1>
                          <p className="text-sm text-muted-foreground mt-1">
                            A inscrição fica vinculada à sua conta ({profile?.full_name || user.email}).
                          </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {(() => {
                            type Choice = { key: string; title: string; desc: string; Icon: typeof User; active: boolean; onSelect: () => void };
                            const choices: Choice[] = [
                              {
                                key: "self",
                                title: "Eu mesmo",
                                desc: "Usar meus dados cadastrados",
                                Icon: User,
                                active: isSelf,
                                onSelect: () => { setIsSelf(true); setSelectedParticipantId(null); fillWithProfile(); },
                              },
                              ...savedParticipants.map((p) => ({
                                key: p.id,
                                title: p.full_name,
                                desc: p.relationship || "Participante salvo",
                                Icon: Users,
                                active: !isSelf && selectedParticipantId === p.id,
                                onSelect: () => {
                                  setIsSelf(false);
                                  setSelectedParticipantId(p.id);
                                  setSaveToParticipants(false);
                                  setOtherDraft((d) => ({
                                    ...d,
                                    name: p.full_name || "",
                                    cpf: p.cpf || "",
                                    birth: p.birth_date || "",
                                    gender: p.gender || "",
                                    phone: p.phone || "",
                                  }));
                                },
                              })),
                              {
                                key: "other",
                                title: "+ Outra pessoa",
                                desc: "Filho, familiar, amigo ou aluno",
                                Icon: Users,
                                active: !isSelf && selectedParticipantId === null,
                                onSelect: () => {
                                  setIsSelf(false);
                                  if (selectedParticipantId !== null) setOtherDraft(EMPTY_DRAFT);
                                  setSelectedParticipantId(null);
                                },
                              },
                            ];
                            return choices.map(({ key, title, desc, Icon, active, onSelect }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={onSelect}
                                className={[
                                  "text-left rounded-2xl border p-4 sm:p-5 transition-all flex items-start gap-3 min-h-[88px]",
                                  active
                                    ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                    : "border-border bg-secondary/30 hover:bg-secondary/60",
                                ].join(" ")}
                              >
                                <span className={[
                                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                  active ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground border border-border",
                                ].join(" ")}>
                                  <Icon className="w-5 h-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block font-display font-bold truncate">{title}</span>
                                  <span className="block text-sm text-muted-foreground truncate">{desc}</span>
                                </span>
                              </button>
                            ));
                          })()}
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
                          <h2 className="font-display text-lg font-bold">
                            {isSelf ? "Seus dados" : "Dados da pessoa inscrita"}
                          </h2>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2" data-invalid={errors.pName || undefined}>
                              <Label htmlFor="p-name">Nome completo *</Label>
                              <Input id="p-name" value={pName} onChange={(e) => setPName(e.target.value)} className="mt-1" maxLength={160}
                                aria-invalid={!!errors.pName} />
                            </div>
                            <div data-invalid={errors.pBirth || undefined}>
                              <Label htmlFor="p-birth">Data de nascimento *</Label>
                              <Input id="p-birth" type="date" value={pBirth} onChange={(e) => setPBirth(e.target.value)} className="mt-1"
                                aria-invalid={!!errors.pBirth} />
                            </div>
                            <div data-invalid={errors.pGender || undefined}>
                              <Label>Sexo *</Label>
                              <Select value={pGender} onValueChange={setPGender}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Masculino">Masculino</SelectItem>
                                  <SelectItem value="Feminino">Feminino</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div data-invalid={errors.pCpf || undefined}>
                              <Label htmlFor="p-cpf">CPF {cpfRequired ? "*" : "(opcional)"}</Label>
                              <Input id="p-cpf" value={pCpf} onChange={(e) => setPCpf(e.target.value)} className="mt-1" inputMode="numeric" maxLength={14}
                                aria-invalid={!!errors.pCpf} />
                              {!cpfRequired && (
                                <p className="mt-1 text-xs text-muted-foreground">Menor de 18 anos: o CPF não é obrigatório.</p>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="p-phone">Telefone/WhatsApp (opcional)</Label>
                              <Input id="p-phone" value={pPhone} onChange={(e) => setPPhone(e.target.value)} className="mt-1" maxLength={20} />
                            </div>
                          </div>

                          {categoryAge != null && (
                            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm">
                              <span className="text-muted-foreground">Idade na data da prova: </span>
                              <span className="font-semibold">{categoryAge} anos</span>
                              {senior && !isKidsDistance(distance) && (
                                <span className="ml-2 text-success font-semibold">• Benefício 60+ (50%)</span>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            A categoria e os benefícios são calculados automaticamente por estes dados.
                          </p>

                          {!isSelf && selectedParticipantId === null && (
                            <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3 cursor-pointer">
                              <Checkbox
                                checked={saveToParticipants}
                                onCheckedChange={(v) => setSaveToParticipants(v === true)}
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">Salvar em Meus participantes</span>
                                <span className="block text-xs text-muted-foreground">
                                  Assim você não precisará preencher esses dados novamente nas próximas provas.
                                </span>
                              </span>
                            </label>
                          )}
                        </div>

                        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                          <Button onClick={goStep2} variant="brand" size="lg" className="w-full min-h-12 sm:w-auto sm:min-w-56">
                            Continuar
                          </Button>
                        </div>
                      </>
                    )}

                    {step === 1 && (
                      <>
                        <div>
                          <h1 className="font-display text-2xl sm:text-3xl font-bold">{event.name}</h1>
                          <p className="text-sm text-muted-foreground mt-1">
                            Inscrição de <span className="font-semibold text-foreground">{pName}</span> — escolha a modalidade e o kit.
                          </p>
                        </div>

                        {categoryReady && (
                          <div className="rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
                            <span className="text-muted-foreground">Categoria automática: </span>
                            <span className="font-semibold">{categoryDisplay}</span>
                          </div>
                        )}

                        {ageMismatch && (
                          <div className="rounded-2xl border border-warning/50 bg-warning/10 px-4 py-3 space-y-2 text-sm">
                            <p className="font-semibold">{ageMismatch.message}</p>
                            <p className="text-muted-foreground">
                              {pName || "O participante"} terá {categoryAge} anos na data da prova. Escolha uma modalidade compatível:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ageMismatch.options.map((d: any) => (
                                <Button key={d.distance} size="sm" variant="outline" className="min-h-10"
                                  onClick={() => { const g = groupOf(d.distance); if (groups.includes(g)) setGroup(g); setDistance(d.distance); }}>
                                  {cleanDistanceLabel(d.distance)}
                                </Button>
                              ))}
                              <Button size="sm" variant="ghost" className="min-h-10" onClick={() => setStep(0)}>
                                Corrigir data de nascimento
                              </Button>
                            </div>
                          </div>
                        )}

                        {distanceObj && seniorApplied(distanceObj) && (
                          <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
                            <span className="font-semibold text-success">Benefício 60+ aplicado</span>{" "}
                            <span className="text-muted-foreground">
                              — valor especial para {cleanDistanceLabel(distanceObj.distance)}.
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
                                      "w-full min-h-[56px] text-left rounded-xl px-4 py-3 border transition-all flex items-center justify-between gap-3",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/30 hover:bg-secondary/60",
                                    ].join(" ")}
                                  >
                                    <span className="min-w-0 flex-1 font-semibold break-words">{cleanDistanceLabel(d.distance)}</span>
                                    {(fixed60 ? price > 0 : base > 0) && (
                                      <span className="shrink-0 text-right text-sm leading-tight">
                                        {fixed60 ? (
                                          <span className="block text-success text-xs">60+</span>
                                        ) : (
                                          <span className="block text-muted-foreground text-xs">{loteOf(d)}º lote</span>
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
                                      "text-left min-h-[56px] rounded-xl px-4 py-3 border transition-all flex items-center gap-3",
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
                                    <span className="min-w-0 flex-1 font-medium break-words">{k.name}</span>
                                    {k.extra_price ? <span className="shrink-0 text-sm text-brand font-semibold">+{brl(k.extra_price)}</span> : null}
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
                                  <h4 className="text-sm font-semibold">
                                    Tamanho da camiseta {pName ? `de ${pName.split(" ")[0]}` : ""}
                                  </h4>
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

                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
                          <div>
                            <Label htmlFor="team">Nome da equipe (opcional)</Label>
                            <Input id="team" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-1" maxLength={120} />
                          </div>

                          {coupons.length > 0 && (
                            <div>
                              <Label>Cupom (opcional)</Label>
                              <div className="flex gap-2 mt-1">
                                <Input className="min-w-0 flex-1" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Tem um cupom?" />
                                <Button type="button" variant="outline" className="shrink-0 min-h-11" onClick={applyCoupon}>Aplicar</Button>
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

                        <div data-invalid={errors.terms || undefined} className={`flex items-start gap-3 rounded-lg p-3 ${errors.terms ? "ring-2 ring-destructive/60 bg-destructive/5" : ""}`}>
                          <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(!!v)} className={`mt-0.5 h-5 w-5 shrink-0 ${errors.terms ? "border-destructive" : ""}`} />
                          <label htmlFor="terms" className={`text-sm leading-relaxed cursor-pointer ${errors.terms ? "text-destructive font-medium" : ""}`}>
                            Estou de acordo com os{" "}
                            {event.regulation_url ? (
                              <a href={event.regulation_url} target="_blank" rel="noreferrer" className="text-brand underline">termos e regulamento</a>
                            ) : "termos e regulamento"} do evento.
                          </label>
                        </div>

                        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                          {submitError && (
                            <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                              {submitError}
                            </div>
                          )}
                          <div className="mb-2 flex items-center justify-between text-sm sm:hidden">
                            <span className="text-muted-foreground truncate">{pName || "Participante"}</span>
                            <span className="font-bold text-brand">{total > 0 ? brl(total) : "—"}</span>
                          </div>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                            <Button variant="outline" size="lg" className="min-h-12" onClick={() => { setStep(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                              <ChevronLeft className="w-4 h-4" /> Voltar
                            </Button>
                            <Button onClick={submit} disabled={submitting || !participantComplete} variant="brand" size="lg" className="min-h-12 flex-1">
                              {submitting ? "Enviando..." : submitError ? "Tentar novamente" : total > 0 ? `Confirmar e pagar ${brl(total)}` : "Confirmar inscrição"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                  </div>

                  <div>
                    <details className="lg:hidden rounded-2xl border border-border bg-card overflow-hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                        <span>Resumo da inscrição</span>
                        <span className="text-brand">{total > 0 ? brl(total) : ""}</span>
                      </summary>
                      <div className="border-t border-border p-1">{summaryCard}</div>
                    </details>
                    <div className="hidden lg:block">{summaryCard}</div>
                  </div>

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
