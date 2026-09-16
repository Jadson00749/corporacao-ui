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
import { useSettings } from "@/contexts/SettingsContext";
import {
  activeLote,
  currentPrice,
  effectivePrice,
  hasSeniorPrice,
  isSeniorAtEvent,
  ageAtEvent,
  isSeniorOnlyDistance,
  isKidsDistance,
  sportAgeAtEvent,
  KIDS_BRACKETS,
  kidsBracketFor,
  kidsCategoryForAge,
} from "@/lib/eventPricing";
import {
  type EventCoupon,
  listApplicableCoupons,
  applyCouponToTotal,
  couponHasDiscountConfig,
  couponAvailabilityMessage,
} from "@/lib/eventCoupons";
import {
  type ShirtSizeAvailability,
  isShirtSizeSoldOut,
  normalizeShirtSize,
  shirtStockErrorMessage,
} from "@/lib/shirtSizeStock";
import {
  eventCapacityErrorMessage,
  parseEventCapacityStatus,
  type EventCapacityStatus,
} from "@/lib/eventCapacity";
import { formatKitExtraPriceLabel } from "@/lib/shirtPlanning";
import {
  type EventKitOption,
  getKitAvailability,
  isKitAvailableForDistance,
  kitHasShirt,
} from "@/lib/eventKits";

import { buildSignupWhatsMessage, type SignupBlock } from "@/lib/signupWhatsMessage";
import {
  PAYMENT_UNAVAILABLE_MESSAGE,
  resolveAthletePaymentView,
  useEventPayment,
  whatsappLinkFor,
} from "@/lib/eventPayment";
import {
  CORP_PLATFORM_NAME,
  organizationAccent,
  parseEventOrganizerEmbed,
  partnerOrganizerPublicName,
  resolveOrganizationContext,
} from "@/lib/eventOrganizer";
import { cn } from "@/lib/utils";

import { LoteBreakdown } from "@/components/site/LoteBreakdown";
import {
  toBirthDateInputValue,
  parseBirthDateInput,
} from "@/lib/birthDate";
import { BirthDateInput } from "@/components/account/BirthDateInput";

import { PixPayment } from "@/components/site/PixPayment";
import { Confetti } from "@/components/site/Confetti";

type Distance = { distance: string; price?: number };
type AgeBracket = { min: number; max: number };
type KitOption = EventKitOption;
type Coupon = EventCoupon;

const calcAge = (birth?: string | null) => {
  if (!birth) return null;
  const parsed = parseBirthDateInput(birth);
  if (!parsed.ok) return null;
  const d = new Date(`${parsed.iso}T12:00:00`);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

/** Idade esportiva: ano da prova - ano de nascimento (ignora mês/dia). */
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


/** Stepper = navegação da plataforma → sempre verde Corporação. */
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
              className={cn(
                "w-9 h-9 rounded-full grid place-items-center text-sm font-bold border-2 transition-all",
                state === "active"
                  ? "border-brand text-brand bg-brand/10"
                  : state === "done"
                    ? "border-brand bg-brand text-brand-foreground group-hover:scale-105 group-hover:ring-4 group-hover:ring-brand/25"
                    : "border-border text-muted-foreground bg-secondary/40",
              )}
            >
              {state === "done" ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "mt-2 text-[11px] leading-tight text-center sm:text-sm",
                state === "todo" ? "text-muted-foreground" : "font-semibold",
                clickable && "group-hover:text-brand",
              )}
            >
              {label}
            </span>
          </button>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "h-[2px] w-8 sm:w-24 mt-[18px]",
                i < current ? "bg-brand/70" : "bg-border",
              )}
            />
          )}
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
  const settings = useSettings();

  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Aviso de race de estoque; mantém o formulário e só limpa o tamanho. */
  const [shirtRaceHint, setShirtRaceHint] = useState<string | null>(null);
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
  /** Participantes já inscritos nesta sessão, com o que a mensagem do WhatsApp precisa. */
  type DoneParticipant = {
    name: string; birth: string; self: boolean;
    modality: string; category: string; kits: string[]; shirtSize: string; value: number;
  };
  const [doneParticipants, setDoneParticipants] = useState<DoneParticipant[]>([]);
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
  const setShirtSize = (v: string) => {
    patchDraft({ shirtSize: v });
    if (v) setShirtRaceHint(null);
  };

  const fillWithProfile = () => {
    setSelfDraft((d) => ({
      ...d,
      name: d.name || profile?.full_name || "",
      cpf: d.cpf || profile?.cpf || "",
      birth: d.birth || toBirthDateInputValue((profile as any)?.birth_date),
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
      const { data, error } = await supabase
        .from("events")
        .select("*, organizers ( id, name )")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: shirtAvailability = [], refetch: refetchShirtAvailability } = useQuery({
    queryKey: ["event_shirt_size_availability", id],
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    // Mantém tamanhos na tela durante refetch silencioso (sem piscar / loading).
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_shirt_size_availability", {
        _event_id: id!,
      });
      if (error) {
        // Migration ainda não aplicada / RPC ausente → trata como ilimitado
        console.warn("[get_event_shirt_size_availability]", error.message);
        return [] as ShirtSizeAvailability[];
      }
      return (data ?? []) as ShirtSizeAvailability[];
    },
  });

  const { data: capacityStatus = null, refetch: refetchCapacity } = useQuery({
    queryKey: ["event_capacity_status", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_capacity_status", {
        _event_id: id!,
      });
      if (error) {
        console.warn("[get_event_capacity_status]", error.message);
        return null as EventCapacityStatus | null;
      }
      return parseEventCapacityStatus(data);
    },
  });

  const shirtAvailBySize = useMemo(() => {
    const map: Record<string, ShirtSizeAvailability> = {};
    for (const row of shirtAvailability) {
      const key = normalizeShirtSize(row.size);
      if (key) map[key] = row;
    }
    return map;
  }, [shirtAvailability]);

  // Pagamento resolvido pelo organizador da prova via RPC get_event_payment_info.
  // Prova com organizer_id + falha da RPC NÃO cai no WhatsApp/PIX da Corporação.
  const {
    data: eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
  } = useEventPayment(event?.id);
  const payView = resolveAthletePaymentView({
    eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
    eventOrganizerId: (event as any)?.organizer_id,
    eventPixKey: (event as any)?.pix_key,
    eventPixRecipient: (event as any)?.pix_recipient,
    eventPaymentInstructions: (event as any)?.payment_instructions,
    siteWhatsapp: settings.contact.whatsapp,
  });
  const payment = {
    pix_key: payView.pix_key,
    pix_recipient: payView.pix_recipient,
    payment_instructions: payView.payment_instructions,
  };
  const proofWhatsapp = payView.proofWhatsapp;

  const organizerRef = parseEventOrganizerEmbed((event as any)?.organizers);
  const partnerOrganizerName = partnerOrganizerPublicName(
    (event as any)?.organizer_id,
    organizerRef,
  );
  /** Azul só na assinatura do parceiro — não em navegação/seleção/CTA. */
  const orgContext = resolveOrganizationContext(
    (event as any)?.organizer_id,
    organizerRef,
  );
  const partnerAccent = organizationAccent(orgContext);


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
  const kitOptionsAll = useMemo<KitOption[]>(
    () => ((event?.kit_options as KitOption[]) || []).filter((k) => k?.name?.trim()),
    [event]
  );
  const kitOptions = useMemo<KitOption[]>(() => {
    const dist = distances.find((d) => d.distance === distance);
    if (!dist) {
      // Sem modalidade: só kits de todos os lotes (evita preview de last_lot)
      return kitOptionsAll.filter((k) => getKitAvailability(k) === "all_lots");
    }
    return kitOptionsAll.filter((k) => isKitAvailableForDistance(k, dist));
  }, [kitOptionsAll, distances, distance]);

  // Se o kit selecionado deixar de ser elegível (ex.: mudou modalidade/lote), limpa.
  useEffect(() => {
    const selected = selectedKits[0];
    if (!selected) return;
    if (!kitOptions.some((k) => k.name === selected)) {
      setSelectedKits([]);
      setShirtSize("");
    }
  }, [kitOptions, selectedKits]);

  const coupons = useMemo<Coupon[]>(
    () => listApplicableCoupons(event?.coupons),
    [event]
  );

  // Kit selecionado que possui camiseta (tamanhos configurados pelo admin)
  const shirtKit = useMemo(
    () => kitOptions.find((k) => selectedKits.includes(k.name) && kitHasShirt(k)) || null,
    [kitOptions, selectedKits]
  );
  const availableSizes = shirtKit?.sizes ?? [];
  useEffect(() => {
    if (shirtSize && !availableSizes.includes(shirtSize)) setShirtSize("");
  }, [availableSizes.join("|")]);
  useEffect(() => {
    if (!shirtSize) return;
    const row = shirtAvailBySize[normalizeShirtSize(shirtSize)];
    if (!isShirtSizeSoldOut(row)) return;
    // Polling/refetch detectou esgotamento: limpa só o tamanho, mantém o restante do formulário.
    setShirtSize("");
    setShirtRaceHint("Esse tamanho acabou de esgotar. Escolha outro tamanho disponível.");
  }, [shirtSize, shirtAvailBySize]);
  useEffect(() => { if (shirtSize && errors.shirtSize) setErrors((e) => ({ ...e, shirtSize: false })); }, [shirtSize]);



  // Auto-pick when there's only one option
  useEffect(() => { if (distances.length === 1) setDistance(distances[0].distance); }, [distances]);
  useEffect(() => {
    if (kitOptions.length === 1) setSelectedKits([kitOptions[0].name]);
  }, [kitOptions]);

  // Sexo derivado do PARTICIPANTE
  const participantGenderLabel = useMemo(() => genderLabelFrom(pGender, genders), [pGender, genders]);
  useEffect(() => { setGender(participantGenderLabel); }, [participantGenderLabel]);

  // Idade esportiva do PARTICIPANTE (ano da prova - ano de nascimento)
  // Draft e input nativo guardam YYYY-MM-DD; persistência usa o mesmo formato.
  const pBirthParsed = useMemo(() => parseBirthDateInput(pBirth), [pBirth]);
  const pBirthIso = pBirthParsed.ok ? pBirthParsed.iso : "";
  /** Adultos: idade esportiva (ano prova − ano nasc). Kids: idade civil na data do evento. */
  const categoryAge = useMemo(
    () => sportAgeAtEvent(pBirthIso || null, (event as any)?.date),
    [pBirthIso, event]
  );
  const kidsAge = useMemo(
    () => ageAtEvent(pBirthIso || null, (event as any)?.date),
    [pBirthIso, event]
  );
  const kidsBracket = useMemo(() => kidsBracketFor(kidsAge), [kidsAge]);
  const isKidsModality = isKidsDistance(distance);

  const autoBracket = useMemo(() => {
    if (isKidsModality) return "";
    if (categoryAge == null || !ageBrackets.length) return "";
    const match = ageBrackets.find((b) => categoryAge >= b.min && categoryAge <= b.max);
    return match ? `${match.min}-${match.max}` : "";
  }, [categoryAge, ageBrackets, isKidsModality]);
  useEffect(() => { setBracket(autoBracket); }, [autoBracket]);

  const profileComplete = profile && profile.full_name && profile.cpf && profile.whatsapp && profile.cep;

  /** Menor de 18 na data da prova -> CPF opcional. */
  const ageForMinor = isKidsModality ? kidsAge : categoryAge;
  const isMinor = ageForMinor != null && ageForMinor < 18;
  const cpfRequired = !isMinor;
  const participantComplete = !!(pName.trim() && pBirthParsed.ok && pGender && (!cpfRequired || pCpf.trim()));

  const kidsDistances = useMemo(() => distances.filter((d) => isKidsDistance(d.distance)), [distances]);
  const adultDistances = useMemo(() => distances.filter((d) => !isKidsDistance(d.distance)), [distances]);

  /** Idade x modalidade: Kids 2–13; adultos não misturam com Kids. */
  const ageMismatch = useMemo(() => {
    if (!distance) return null;
    const selKids = isKidsDistance(distance);
    if (selKids) {
      if (kidsAge == null) return null;
      if (!kidsBracket) {
        return {
          message:
            kidsAge < 2
              ? "A Corridinha Kids é para crianças a partir de 2 anos."
              : "A idade está fora das baterias Kids (2 a 13 anos).",
          options: adultDistances.length && kidsAge >= 14 ? adultDistances : [],
        };
      }
      return null;
    }
    if (categoryAge == null) return null;
    if (categoryAge <= 12 && kidsDistances.length) {
      return { message: "Esta modalidade não corresponde à idade do participante.", options: kidsDistances };
    }
    return null;
  }, [distance, categoryAge, kidsAge, kidsBracket, kidsDistances, adultDistances]);



  const distanceObj = distances.find((d) => d.distance === distance);
  // 60+ pela idade do PARTICIPANTE na data da prova
  const senior = isSeniorAtEvent(pBirthIso || null, (event as any)?.date);
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
  // Stacking preservado: lote/60+ → kits → cupom por último (nunca negativo)
  const subtotal = distancePrice + kitExtra;
  const { discount: couponDiscount, total } = applyCouponToTotal(subtotal, appliedCoupon);

  /** Gravado em event_signups.category — Kids: bateria oficial (sem sexo). */
  const categoryLabel = useMemo(() => {
    if (isKidsModality) return kidsCategoryForAge(kidsAge) || "";
    const parts = [distance, gender, bracket && `${bracket} anos`].filter(Boolean);
    return parts.join(" · ");
  }, [isKidsModality, kidsAge, distance, gender, bracket]);

  /** Rótulo amigável exibido na tela. */
  const categoryDisplay = useMemo(() => {
    if (isKidsModality && kidsBracket) {
      return `${kidsBracket.title} · ${kidsBracket.subtitle}`;
    }
    const ageLabel = bracket ? `${bracket.replace("-", "–")} anos` : "";
    return [distance && cleanDistanceLabel(distance), gender, ageLabel].filter(Boolean).join(" • ");
  }, [isKidsModality, kidsBracket, distance, gender, bracket]);

  const categoryReady =
    !!distance &&
    !ageMismatch &&
    (isKidsModality
      ? !!kidsBracket && !!pBirthParsed.ok
      : !!gender && (!ageBrackets.length || !!bracket));

  /** Categoria para WhatsApp / resumo. */
  const categoryForMessage = useMemo(() => {
    if (isKidsModality && kidsBracket) return kidsBracket.category;
    const ageLabel = bracket ? `${bracket.replace("-", "–")} anos` : "";
    return [gender, ageLabel].filter(Boolean).join(" · ");
  }, [isKidsModality, kidsBracket, gender, bracket]);

  const whatsMessage = useMemo(() => {
    const blocks: SignupBlock[] = doneParticipants.map((p) => ({
      participant: p.name,
      modality: p.modality,
      category: p.category,
      kits: p.kits,
      shirtSize: p.shirtSize,
      value: p.value,
    }));

    // Retomar um rascunho pendente cai direto na tela de pagamento, sem passar
    // pelo submit — nesse caso a mensagem usa os dados restaurados na tela.
    if (!blocks.length) {
      blocks.push({
        participant: pName,
        modality: cleanDistanceLabel(distance),
        category: categoryForMessage,
        kits: selectedKits,
        shirtSize,
        value: total,
      });
    }

    return buildSignupWhatsMessage({
      responsible: profile?.full_name || "",
      eventName: event?.name || "",
      blocks,
    });
  }, [doneParticipants, profile?.full_name, event?.name, pName, distance, categoryForMessage, selectedKits, shirtSize, total]);

  const proofLink = whatsappLinkFor(proofWhatsapp, whatsMessage);


  // Retomar rascunho pendente sem criar nova inscrição
  const resumeSignup = (signup: { id: string; category: string | null; kit_option?: string | null; team_name?: string | null; coupon_code?: string | null; shirt_size?: string | null }) => {
    const cat = signup.category || "";
    let restoredDistance = "";
    if (isKidsDistance(cat)) {
      const kidsDist = distances.find((d) => isKidsDistance(d.distance));
      if (kidsDist) {
        restoredDistance = kidsDist.distance;
        const g = groupOf(kidsDist.distance);
        if (groups.includes(g)) setGroup(g);
        setDistance(kidsDist.distance);
      }
    } else {
      const parts = cat.split("·").map((p) => p.trim()).filter(Boolean);
      const savedDistance = parts.find((p) => distances.some((d) => d.distance === p));
      if (savedDistance) {
        restoredDistance = savedDistance;
        const g = groupOf(savedDistance);
        if (groups.includes(g)) setGroup(g);
        setDistance(savedDistance);
      }
    }
    let kits: string[] = [];
    try {
      const parsed = JSON.parse(signup.kit_option || "[]");
      if (Array.isArray(parsed)) kits = parsed.filter((k) => typeof k === "string");
      else if (typeof parsed === "string" && parsed) kits = [parsed];
    } catch {
      if (signup.kit_option) kits = [signup.kit_option];
    }
    if (kits.length) setSelectedKits([kits[0]]);
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
        birth: toBirthDateInputValue(sg.participant_birth_date),
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

    const ready = !!(sg.participant_full_name || profileComplete) && !!restoredDistance && (kitOptions.length === 0 || kits.length > 0);
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

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find((c) => c.code.toUpperCase() === code);
    if (!found) {
      toast.error("Cupom não encontrado.");
      setAppliedCoupon(null);
      return;
    }
    if (!couponHasDiscountConfig(found)) {
      toast.error("Este cupom ainda não tem desconto configurado.");
      setAppliedCoupon(null);
      return;
    }

    if (event?.id) {
      const { data, error } = await supabase.rpc("check_event_coupon_availability", {
        _event_id: event.id,
        _code: code,
      });
      if (error) {
        // Migration ainda não aplicada: segue só com validação local
        console.warn("[check_event_coupon_availability]", error.message);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.ok === false) {
          toast.error(couponAvailabilityMessage(row.reason));
          setAppliedCoupon(null);
          return;
        }
      }
    }

    setAppliedCoupon(found);
    const preview = applyCouponToTotal(subtotal, found);
    if (found.type === "percentage" && found.value != null) {
      toast.success(`Cupom ${found.code} aplicado (−${found.value}%).`);
    } else if (preview.discount > 0) {
      toast.success(`Cupom ${found.code} aplicado (−${brl(preview.discount)}).`);
    } else {
      toast.success(`Cupom ${found.code} aplicado.`);
    }
  };

  /** Etapa 1 -> 2: valida apenas os dados do participante. */
  const goStep2 = () => {
    const newErrors: Record<string, boolean> = {};
    const missing: string[] = [];
    if (!pName.trim()) { newErrors.pName = true; missing.push("Nome completo"); }
    const birth = parseBirthDateInput(pBirth);
    if (!birth.ok) {
      newErrors.pBirth = true;
      missing.push(birth.error);
    }
    if (!pGender) { newErrors.pGender = true; missing.push("Sexo"); }
    if (cpfRequired && !pCpf.trim()) { newErrors.pCpf = true; missing.push("CPF"); }
    if (missing.length) {
      setErrors(newErrors);
      toast.error("Preencha para continuar", { description: missing.join(" · "), position: "top-center" });
      return;
    }
    const birthIso = birth.ok ? birth.iso : "";
    const dup = doneParticipants.some(
      (p) => p.name.trim().toLowerCase() === pName.trim().toLowerCase() && p.birth === birthIso
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
    const birthParsed = parseBirthDateInput(pBirth);
    if (!birthParsed.ok) {
      newErrors.pBirth = true;
      missingLabels.push(birthParsed.error);
    }
    if (!pGender) { newErrors.pGender = true; missingLabels.push("Sexo"); }
    if (isKidsDistance(distance)) {
      if (!birthParsed.ok) {
        newErrors.pBirth = true;
        missingLabels.push("Data de nascimento");
      } else if (!kidsCategoryForAge(kidsAge)) {
        newErrors.pBirth = true;
        missingLabels.push("Idade fora das baterias Kids (2 a 13 anos)");
      } else if (!categoryLabel) {
        newErrors.distance = true;
        missingLabels.push("Categoria Kids");
      }
    } else if (ageBrackets.length > 0 && !bracket) {
      newErrors.bracket = true;
      missingLabels.push("Data de nascimento");
    }
    if (kitOptions.length > 0 && selectedKits.length === 0) { newErrors.kitOption = true; missingLabels.push("Kit"); }
    if (availableSizes.length > 0 && !shirtSize) { newErrors.shirtSize = true; missingLabels.push("Tamanho da camiseta"); }
    if (
      shirtSize &&
      isShirtSizeSoldOut(shirtAvailBySize[normalizeShirtSize(shirtSize)])
    ) {
      newErrors.shirtSize = true;
      missingLabels.push("Tamanho esgotado — escolha outro");
    }
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

    // Revalida cupom imediatamente antes de criar a inscrição
    if (appliedCoupon?.code && event?.id) {
      if (!couponHasDiscountConfig(appliedCoupon)) {
        toast.error("Este cupom ainda não tem desconto configurado.");
        setAppliedCoupon(null);
        return;
      }
      const { data: avail, error: availErr } = await supabase.rpc(
        "check_event_coupon_availability",
        { _event_id: event.id, _code: appliedCoupon.code }
      );
      if (availErr) {
        console.warn("[check_event_coupon_availability]", availErr.message);
      } else {
        const row = Array.isArray(avail) ? avail[0] : avail;
        if (row && row.ok === false) {
          toast.error(couponAvailabilityMessage(row.reason));
          setAppliedCoupon(null);
          return;
        }
      }
    }

    setSubmitting(true);

    const birthIso = birthParsed.ok ? birthParsed.iso : "";

    // Kids: categoria sempre pela idade — nunca aceitar texto incompatível.
    const savedCategory =
      (isKidsDistance(distance)
        ? kidsCategoryForAge(ageAtEvent(birthIso, (event as any)?.date))
        : categoryLabel) || "";
    if (isKidsDistance(distance) && !savedCategory) {
      setSubmitting(false);
      toast.error("Não é possível finalizar a inscrição Kids sem nascimento válido do participante.", {
        position: "top-center",
      });
      return;
    }

    const payload = {
      category: savedCategory,
      status: "pendente",
      notes: seniorApplied(distanceObj) ? [notes, `[Benefício 60+ aplicado: ${brl(distancePrice)}]`].filter(Boolean).join(" ") : notes,
      kit_option: selectedKits[0] ? JSON.stringify([selectedKits[0]]) : "",
      shirt_size: shirtSize || null,
      coupon_code: appliedCoupon?.code || "",
      team_name: teamName,
      accepted_event_terms_at: new Date().toISOString(),
      participant_full_name: pName.trim(),
      participant_cpf: pCpf.trim(),
      participant_birth_date: birthIso,
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
          .eq("category", savedCategory)
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
      const stockMsg = shirtStockErrorMessage(error);
      if (stockMsg) {
        // Mantém o formulário; limpa só o tamanho esgotado e atualiza disponibilidade.
        setShirtSize("");
        setShirtRaceHint(stockMsg);
        setSubmitError(stockMsg);
        setErrors((e) => ({ ...e, shirtSize: true }));
        await refetchShirtAvailability();
        toast.error(stockMsg, { position: "top-center" });
        setTimeout(() => {
          document
            .querySelector<HTMLElement>("[data-shirt-size-picker]")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
        return;
      }
      const capacityMsg = eventCapacityErrorMessage(error);
      if (capacityMsg) {
        void refetchCapacity();
        setSubmitError(capacityMsg);
        toast.error(capacityMsg, { position: "top-center" });
        return;
      }
      const couponLimitHit = /limite de utilizações/i.test(error.message || "");
      if (couponLimitHit) {
        setAppliedCoupon(null);
        setSubmitError("Este cupom atingiu o limite de utilizações.");
        toast.error("Este cupom atingiu o limite de utilizações.", { position: "top-center" });
        return;
      }
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
    // Cada participante guarda o que foi escolhido para ele; retomar um rascunho
    // atualiza a entrada existente em vez de duplicá-la (evitaria total errado).
    setDoneParticipants((prev) => {
      const entry: DoneParticipant = {
        name: pName.trim(),
        birth: birthIso,
        self: isSelf,
        modality: cleanDistanceLabel(distance),
        category: categoryForMessage,
        kits: [...selectedKits],
        shirtSize,
        value: total,
      };
      const at = prev.findIndex(
        (p) => p.name.trim().toLowerCase() === entry.name.toLowerCase() && p.birth === entry.birth
      );
      if (at === -1) return [...prev, entry];
      const next = [...prev];
      next[at] = entry;
      return next;
    });

    // Opcional: salvar essa pessoa em "Meus participantes" (não altera a inscrição).
    if (!isSelf && selectedParticipantId === null && saveToParticipants) {
      const dup = findExistingParticipant(savedParticipants, {
        full_name: pName.trim(),
        cpf: pCpf,
        birth_date: birthIso,
      });
      if (dup) {
        toast.info("Este participante já está salvo em Meus participantes.");
      } else {
        try {
          await createParticipant.mutateAsync({
            full_name: pName.trim(),
            cpf: pCpf.trim() || null,
            birth_date: birthIso || null,
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




  if (loading || !user) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Skeleton className="mb-4 h-4 w-40" />
          <Skeleton className="mb-6 h-8 w-56" />
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  const summaryCard = event && (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 lg:sticky lg:top-28">
      <div>
        <h2 className="font-display text-lg font-bold leading-tight text-foreground">{event.name}</h2>
        {partnerOrganizerName ? (
          <div className="mt-2 space-y-0.5">
            <p className={cn("text-sm font-semibold leading-snug", partnerAccent.text)}>
              Organizado por {partnerOrganizerName}
            </p>
            <p className="text-xs text-muted-foreground">
              Inscrições pela {CORP_PLATFORM_NAME}
            </p>
          </div>
        ) : null}
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            {event.city}
          </span>
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
        {(isKidsModality ? kidsBracket : gender || bracket) && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Categoria</span>
            <span className="font-medium text-right">
              {isKidsModality && kidsBracket
                ? kidsBracket.category
                : [gender, bracket && `${bracket} anos`].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
      </div>

      {(subtotal > 0 || couponDiscount > 0) && (
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
          {kitExtra < 0 && <div className="flex justify-between"><span>Kit</span><span>−{brl(Math.abs(kitExtra))}</span></div>}
          {appliedCoupon && couponDiscount > 0 && (
            <div className="flex justify-between text-success font-medium">
              <span>
                Cupom {appliedCoupon.code} aplicado
                {appliedCoupon.type === "percentage" && appliedCoupon.value != null
                  ? ` (−${appliedCoupon.value}%)`
                  : ""}
              </span>
              <span>−{brl(couponDiscount)}</span>
            </div>
          )}
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
          ) : capacityStatus?.is_full && !done && !signupId ? (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-6 text-center space-y-3">
              <h1 className="font-display text-xl font-bold">{event.name}</h1>
              <p className="text-sm text-muted-foreground">
                Inscrições encerradas — limite de participantes atingido.
              </p>
              <Button asChild variant="outline">
                <Link to={`/provas/${id}`}>Voltar para a prova</Link>
              </Button>
            </div>
          ) : (
            <>
              <Stepper current={step} onGo={done ? undefined : (i) => setStep(i)} />

              {done ? (
                <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-4 sm:p-7 space-y-5">
                  <Confetti fire={done} />
                  <div className="text-center">
                    <CheckCircle2 className="w-11 h-11 text-success mx-auto mb-2" />
                    <h1 className="font-display text-xl sm:text-2xl font-bold mb-2">Inscrição registrada! 🎉</h1>
                    {total > 0 ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
                          🟡 Aguardando pagamento
                        </span>
                        <p className="text-muted-foreground text-sm mt-2.5">
                          Seu cadastro foi salvo. Agora falta realizar o pagamento e enviar o comprovante para concluir a confirmação.
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
                          🟡 Aguardando aprovação
                        </span>
                        <p className="text-muted-foreground text-sm mt-2.5">
                          Sua inscrição foi enviada com sucesso e está aguardando aprovação do organizador.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Resumo compacto */}
                  <div className="rounded-2xl border border-border bg-secondary/40 p-3.5 space-y-1.5 text-sm">
                    {pName && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Participante</span><span className="font-medium text-right break-words">{pName}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Prova</span><span className="font-medium text-right break-words">{event.name}</span></div>
                    {distance && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Modalidade</span><span className="font-medium text-right">{distance}</span></div>}
                    {appliedCoupon?.code && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Cupom aplicado</span>
                        <span className="font-medium text-right">{appliedCoupon.code}</span>
                      </div>
                    )}
                    {total === 0 && (subtotal > 0 || couponDiscount > 0) ? (
                      <>
                        {subtotal > 0 && (
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium text-right">{brl(subtotal)}</span>
                          </div>
                        )}
                        {couponDiscount > 0 && (
                          <div className="flex justify-between gap-3 text-success">
                            <span>Desconto</span>
                            <span className="font-medium text-right">−{brl(couponDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3 border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-bold text-brand">{brl(0)}</span>
                        </div>
                      </>
                    ) : (
                      total > 0 && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Valor</span>
                          <span className="font-bold text-brand">{brl(total)}</span>
                        </div>
                      )
                    )}
                  </div>

                  {total === 0 && (
                    <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground/90 space-y-1">
                      <p className="font-medium text-success">✓ Nenhum pagamento é necessário.</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Sua inscrição está aguardando aprovação do organizador.
                      </p>
                    </div>
                  )}

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
                      {appliedCoupon?.code && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Cupom</span>
                          <span className="font-medium text-right">{appliedCoupon.code}</span>
                        </div>
                      )}
                      {(subtotal > 0 || total > 0) && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Valor</span>
                          <span className="font-bold text-brand">{brl(total)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium text-warning">
                          {total > 0 ? "Aguardando pagamento" : "Aguardando aprovação"}
                        </span>
                      </div>
                      {signupId && (
                        <div className="flex justify-between gap-3 border-t border-border pt-2">
                          <span className="text-muted-foreground">Nº da inscrição</span>
                          <span className="font-mono text-xs break-all text-right">{signupId}</span>
                        </div>
                      )}
                    </div>
                  </details>

                  {total > 0 && (
                    <>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">
                          2. Realize o pagamento
                        </p>
                        {payView.unavailable ? (
                          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground/90">
                            {PAYMENT_UNAVAILABLE_MESSAGE}
                          </p>
                        ) : payView.loading ? (
                          <p className="text-sm text-muted-foreground">Carregando dados de pagamento…</p>
                        ) : (
                          <PixPayment
                            pixKey={payment.pix_key}
                            recipient={payment.pix_recipient}
                            city={event.city}
                            amount={total}
                            txid={`INSC${String(signupId || event.id).replace(/\D/g, "").slice(0, 10)}`}
                            instructions={payment.payment_instructions}
                            summary={{
                              eventName: event.name,
                              participant: pName,
                              modality: distance,
                              organizerName: payView.organizer_name || payment.pix_recipient,
                              isPartner: payView.is_partner,
                            }}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          3. Envie o comprovante
                        </p>
                        {payView.unavailable ? (
                          <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                            O envio de comprovante ficará disponível assim que os dados de pagamento
                            forem carregados corretamente.
                          </p>
                        ) : payView.loading ? null : proofLink ? (
                          <>
                            <Button asChild variant="outline" size="lg" className="w-full">
                              <a href={proofLink} target="_blank" rel="noreferrer">
                                <MessageCircle className="w-4 h-4" /> Enviar comprovante
                              </a>
                            </Button>
                            {payView.is_partner && payView.organizer_name && (
                              <p className="text-center text-xs text-muted-foreground">
                                O comprovante vai para {payView.organizer_name}, organizador desta prova.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground/80">
                            O organizador desta prova ainda não configurou um WhatsApp para receber
                            comprovantes. Guarde o comprovante e fale com a organização.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <Button onClick={startAnotherParticipant} variant="outline" size="lg" className="w-full">
                    + Inscrever outra pessoa nesta prova
                  </Button>

                  {doneParticipants.length > 1 && (
                    <p className="text-center text-xs text-muted-foreground">
                      Nesta sessão você já inscreveu: {doneParticipants.map((p) => p.name).join(", ")}.
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button asChild variant="ghost" size="sm"><Link to="/minha-conta">Ver minha inscrição</Link></Button>
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
                                    birth: toBirthDateInputValue(p.birth_date),
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
                                className={cn(
                                  "text-left rounded-2xl border p-4 sm:p-5 transition-all flex items-start gap-3 min-h-[88px]",
                                  active
                                    ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                    : "border-border bg-secondary/30 hover:bg-secondary/60",
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                    active
                                      ? "bg-brand text-brand-foreground"
                                      : "bg-background text-muted-foreground border border-border",
                                  )}
                                >
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
                            {isSelf ? "Seus dados" : "Dados do participante"}
                          </h2>
                          {(isKidsModality || kidsDistances.length > 0) && profile?.full_name && (
                            <p className="text-xs text-muted-foreground rounded-xl border border-border bg-secondary/30 px-3 py-2">
                              Responsável pela inscrição:{" "}
                              <span className="font-semibold text-foreground">{profile.full_name}</span>
                            </p>
                          )}

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2" data-invalid={errors.pName || undefined}>
                              <Label htmlFor="p-name">
                                {isSelf ? "Nome completo *" : "Nome completo do participante *"}
                              </Label>
                              <Input id="p-name" value={pName} onChange={(e) => setPName(e.target.value)} className="mt-1" maxLength={160}
                                aria-invalid={!!errors.pName} />
                            </div>
                            <div data-invalid={errors.pBirth || undefined}>
                              <Label htmlFor="p-birth">Data de nascimento *</Label>
                              <BirthDateInput
                                id="p-birth"
                                value={pBirth}
                                onChange={setPBirth}
                                className="mt-1"
                                aria-invalid={!!errors.pBirth}
                              />
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
                              {(isKidsModality || kidsDistances.length > 0) && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  O sexo é armazenado, mas a Kids é categoria mista (sem divisão M/F).
                                </p>
                              )}
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

                          {((isKidsModality ? kidsAge : categoryAge) != null) && (
                            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm">
                              <span className="text-muted-foreground">Idade na data da prova: </span>
                              <span className="font-semibold">{isKidsModality ? kidsAge : categoryAge} anos</span>
                              {senior && !isKidsModality && (
                                <span className="ml-2 text-success font-semibold">• Benefício 60+ (50%)</span>
                              )}
                            </div>
                          )}

                          {isKidsModality && kidsBracket && (
                            <div className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
                              <span className="text-muted-foreground">Categoria Kids: </span>
                              <span className="font-semibold">{kidsBracket.title}</span>
                              <span className="text-muted-foreground"> — {kidsBracket.subtitle}</span>
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

                        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
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
                              {pName || "O participante"} terá {isKidsModality ? kidsAge : categoryAge} anos na data da prova.
                              {ageMismatch.options.length ? " Escolha uma modalidade compatível:" : " Corrija a data de nascimento ou a modalidade."}
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
                                      className={cn(
                                        "whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors",
                                        group === g
                                          ? "bg-brand text-brand-foreground font-semibold"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
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
                                    className={cn(
                                      "w-full min-h-[56px] text-left rounded-xl px-4 py-3 border transition-all flex items-center justify-between gap-3",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/30 hover:bg-secondary/60",
                                    )}
                                  >
                                    <span className="min-w-0 flex-1 font-semibold break-words">{cleanDistanceLabel(d.distance)}</span>
                                    {(fixed60 ? price > 0 : base > 0) && (
                                      <span className="shrink-0 text-right text-sm leading-tight">
                                        {fixed60 ? (
                                          <span className="block text-success text-xs">60+</span>
                                        ) : (
                                          <span className="block text-muted-foreground text-xs">{loteOf(d)}º lote</span>
                                        )}
                                        <span className="font-bold text-foreground">{brl(price)}</span>
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

                        {isKidsModality && (
                          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
                            <div>
                              <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Categoria Kids</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                Definida pela data de nascimento do participante na data do evento. Categoria mista.
                              </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {KIDS_BRACKETS.map((b) => {
                                const active = kidsBracket?.id === b.id;
                                return (
                                  <div
                                    key={b.id}
                                    role="radio"
                                    aria-checked={active}
                                    className={cn(
                                      "rounded-xl border px-3 py-3 text-left transition-all",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/20 opacity-70",
                                    )}
                                  >
                                    <p className="font-semibold text-sm leading-snug">{b.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {b.ageLabel} · {b.raceDistance}
                                    </p>
                                    {active && (
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand mt-2">
                                        Selecionada pela idade
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {!pBirthParsed.ok && (
                              <p className="text-sm text-destructive">
                                Informe a data de nascimento do participante para definir a bateria Kids.
                              </p>
                            )}
                            {pBirthParsed.ok && !kidsBracket && (
                              <p className="text-sm text-destructive">
                                Idade fora das baterias (2 a 13 anos). Não é possível salvar a inscrição Kids.
                              </p>
                            )}
                          </div>
                        )}

                        {kitOptions.length > 0 && (
                          <div
                            data-invalid={errors.kitOption || undefined}
                            className={`bg-card border rounded-2xl p-4 sm:p-5 ${errors.kitOption ? "border-destructive" : "border-border"}`}
                          >
                            <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Kit do atleta</h3>
                            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Escolha do kit">
                              {kitOptions.map((k) => {
                                const active = selectedKits[0] === k.name;
                                const extraLabel = formatKitExtraPriceLabel(k.extra_price);
                                const desc = String(k.description || "").trim();
                                return (
                                  <button
                                    key={k.name}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => {
                                      setSelectedKits([k.name]);
                                      if (!kitHasShirt(k)) setShirtSize("");
                                    }}
                                    className={cn(
                                      "text-left min-h-[56px] rounded-xl px-4 py-3 border transition-all flex items-start gap-3",
                                      active
                                        ? "border-brand bg-brand/10 ring-1 ring-brand/40"
                                        : "border-border bg-secondary/30 hover:bg-secondary/60",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "w-5 h-5 mt-0.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                        active
                                          ? "bg-brand border-brand text-brand-foreground"
                                          : "border-border bg-background",
                                      )}
                                    >
                                      {active && <Check className="w-3 h-3" />}
                                    </div>
                                    <Shirt className={cn("w-4 h-4 mt-0.5 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
                                    <span className="min-w-0 flex-1">
                                      <span className="font-medium break-words block">{k.name}</span>
                                      {desc ? (
                                        <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                                          {desc}
                                        </span>
                                      ) : null}
                                    </span>
                                    {extraLabel ? (
                                      <span className="shrink-0 text-sm text-brand font-semibold">{extraLabel}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>

                            {availableSizes.length > 0 && (
                              <div
                                data-shirt-size-picker
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
                                <p className="text-[11px] text-muted-foreground mb-3">
                                  Tamanhos sujeitos à disponibilidade.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {availableSizes.map((sz) => {
                                    const active = shirtSize === sz;
                                    const soldOut = isShirtSizeSoldOut(
                                      shirtAvailBySize[normalizeShirtSize(sz)]
                                    );
                                    return (
                                      <button
                                        key={sz}
                                        type="button"
                                        disabled={soldOut}
                                        aria-disabled={soldOut}
                                        onClick={() => {
                                          if (soldOut) return;
                                          setShirtSize(sz);
                                        }}
                                        className={cn(
                                          "min-w-[4.5rem] min-h-[3.25rem] px-3 sm:px-4 rounded-xl border text-base font-bold transition-all shrink-0",
                                          soldOut
                                            ? "border-border/70 bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
                                            : active
                                              ? "border-brand bg-brand text-brand-foreground"
                                              : "border-border bg-background hover:border-brand/60",
                                        )}
                                      >
                                        <span className="block leading-tight">{sz}</span>
                                        {soldOut && (
                                          <span className="block text-[10px] font-semibold leading-tight mt-0.5">
                                            Esgotado
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {shirtRaceHint && (
                                  <p className="mt-2 text-xs text-destructive leading-snug">
                                    {shirtRaceHint}
                                  </p>
                                )}
                                {!shirtRaceHint && errors.shirtSize && (
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
                                <p className="text-xs text-success mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <Tag className="w-3 h-3 shrink-0" />
                                  <span>
                                    Cupom {appliedCoupon.code} aplicado
                                    {appliedCoupon.type === "percentage" && appliedCoupon.value != null
                                      ? ` (−${appliedCoupon.value}%)`
                                      : couponDiscount > 0
                                        ? ` (−${brl(couponDiscount)})`
                                        : ""}
                                  </span>
                                  {appliedCoupon.description ? (
                                    <span className="text-muted-foreground">· {appliedCoupon.description}</span>
                                  ) : null}
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

                        {partnerOrganizerName ? (
                          <p className="text-xs leading-relaxed text-muted-foreground px-1">
                            A organização e execução deste evento são de responsabilidade de{" "}
                            <span className="font-medium text-foreground/80">{partnerOrganizerName}</span>.{" "}
                            A {CORP_PLATFORM_NAME} atua como plataforma de inscrições e apoio administrativo.
                          </p>
                        ) : null}

                        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
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
