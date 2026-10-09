import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useMySignups } from "@/hooks/useProfile";
import { useTrainings, useEvents } from "@/hooks/useContent";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ProfileFields } from "@/components/account/ProfileFields";
import { profileSchema, ProfileValues } from "@/lib/profileSchema";
import { isProfileComplete } from "@/lib/profileComplete";
import { onlyDigits } from "@/lib/cpf";
import { toBirthDateInputValue } from "@/lib/birthDate";
import { signupValue } from "@/lib/exportSignupsXlsx";
import { formatBRL } from "@/lib/eventPricing";
import { buildSignupWhatsMessage } from "@/lib/signupWhatsMessage";
import { toast } from "sonner";
import {
  LogOut,
  MessageCircle,
  ChevronRight,
  Dumbbell,
  Trophy,
  Users,
  AlertCircle,
  CheckCircle2,
  UserRound,
  ClipboardList,
  Package,
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import {
  PAYMENT_UNAVAILABLE_MESSAGE,
  resolveAthletePaymentView,
  useEventPayment,
  whatsappLinkFor,
} from "@/lib/eventPayment";
import { WelcomeDialog } from "@/components/site/WelcomeDialog";
import { OnboardingTour } from "@/components/site/OnboardingTour";
import { IncompleteProfileBanner } from "@/components/site/IncompleteProfileBanner";
import type { EventSignup } from "@/hooks/useProfile";
import { ParticipantsPanel } from "@/components/account/ParticipantsPanel";
import { CompleteParticipantCard } from "@/components/account/CompleteParticipantCard";
import { AccountEventStoreOrders } from "@/components/account/AccountEventStoreOrders";
import { AccountProductOrders } from "@/components/account/AccountProductOrders";
import { useMyEventStoreOrders, orderItemsToAcquired, type MyEventStoreOrderRow } from "@/lib/eventStore";
import { isEventStorePublicEnabled } from "@/lib/eventStoreDev";
import { TabsCoachmark } from "@/components/site/TabsCoachmark";
import { AttentionNeeded, type AttentionItem } from "@/components/site/AttentionNeeded";
import { EmptyState } from "@/components/site/EmptyState";
import {
  SIGNUP_TIMELINE_STEPS,
  StatusTimeline,
  signupTimelineIndex,
} from "@/components/site/StatusTimeline";
import { incompleteKidsSignups } from "@/lib/participantCompletion";


const today = () => new Date();
const dateFromYMD = (d: string) => new Date(d + "T12:00:00");
const formatDate = (d: string) =>
  dateFromYMD(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const formatDateShort = (d: string) =>
  dateFromYMD(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

type AccountTab = "signups" | "compras" | "pedidos" | "participants" | "data";

const MinhaConta = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: signups = [], isLoading: signupsLoading, refetch: refetchSignups } = useMySignups();
  const { data: storeOrders = [] } = useMyEventStoreOrders({
    standaloneOnly: true,
    enabled: !!user,
  });
  const { data: allOrders = [] } = useMyEventStoreOrders({ enabled: !!user });
  const showComprasTab =
    isEventStorePublicEnabled() || storeOrders.length > 0;
  const { data: trainings = [], isLoading: trainingsLoading } = useTrainings();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const qc = useQueryClient();
  const signupsRef = useRef<HTMLDivElement>(null);
  const cadastroRef = useRef<HTMLDivElement>(null);
  const tabSignupsRef = useRef<HTMLButtonElement>(null);
  const tabComprasRef = useRef<HTMLButtonElement>(null);
  const tabParticipantsRef = useRef<HTMLButtonElement>(null);
  const tabDataRef = useRef<HTMLButtonElement>(null);
  const [tabsMounted, setTabsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("signups");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed">("all");

  useEffect(() => {
    setTabsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "compras" && showComprasTab) setActiveTab("compras");
    else if (tab === "pedidos") setActiveTab("pedidos");
    else if (tab === "participants") setActiveTab("participants");
    else if (tab === "data") setActiveTab("data");
    else if (tab === "signups") setActiveTab("signups");
  }, [showComprasTab]);



  // Sempre buscar do banco ao abrir a área do atleta (evita estado local desatualizado)
  useEffect(() => {
    refetchSignups();
    try {
      const id = sessionStorage.getItem("corporacao:last_signup_id");
      if (id) {
        setHighlightId(id);
        sessionStorage.removeItem("corporacao:last_signup_id");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextTraining = useMemo(() => {
    const now = today();
    return trainings
      .filter((t) => dateFromYMD(t.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => dateFromYMD(a.date).getTime() - dateFromYMD(b.date).getTime())[0];
  }, [trainings]);

  const nextRace = useMemo(() => {
    const now = today();
    return events
      .filter((e) => dateFromYMD(e.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => dateFromYMD(a.date).getTime() - dateFromYMD(b.date).getTime())[0];
  }, [events]);

  /** Preços por evento, para calcular o valor exibido na mensagem do comprovante. */
  const eventPricingById = useMemo(
    () =>
      new Map(
        events.map((e) => [
          e.id,
          { id: e.id, name: e.name, distances: e.distances, kitOptions: e.kitOptions },
        ])
      ),
    [events]
  );

  const cancelSignup = async (id: string) => {
    const { error } = await supabase.from("event_signups").update({ status: "cancelada" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Inscrição cancelada");
    qc.invalidateQueries({ queryKey: ["my_signups", user?.id] });
    refetchSignups();
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  const confirmedSignups = signups.filter((s) => s.status === "confirmada");
  const pendingSignups = signups.filter((s) => s.status !== "confirmada" && s.status !== "cancelada");
  const kidsIncomplete = incompleteKidsSignups(signups);

  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];
    if (pendingSignups.length > 0) {
      items.push({
        id: "pending-pay",
        title:
          pendingSignups.length === 1
            ? "1 inscrição aguardando pagamento"
            : `${pendingSignups.length} inscrições aguardando pagamento`,
        description: "Realize o pagamento para confirmar sua inscrição.",
        onClick: () => {
          setActiveTab("signups");
          setStatusFilter("pending");
          setTimeout(() => signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        },
      });
    }
    if (kidsIncomplete.length > 0) {
      items.push({
        id: "kids-data",
        title:
          kidsIncomplete.length === 1
            ? "Dados do participante incompletos"
            : `${kidsIncomplete.length} participantes com dados incompletos`,
        description: "Informe nome e data de nascimento para classificação Kids.",
        onClick: () => {
          setActiveTab("signups");
          setTimeout(() => signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        },
      });
    }
    return items;
  }, [pendingSignups.length, kidsIncomplete.length]);

  if (loading || !user) {
    return (
      <Layout>
        <div className="section-padding pt-24 container-page space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-56 w-full rounded-3xl" />
        </div>
      </Layout>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "Atleta";
  const profileComplete = isProfileComplete(profile);
  const completionFields = [
    profile?.full_name,
    profile?.cpf && onlyDigits(profile.cpf).length === 11,
    profile?.birth_date,
    profile?.whatsapp && onlyDigits(profile.whatsapp).length >= 10,
    profile?.cep && onlyDigits(profile.cep).length === 8,
    profile?.street,
    profile?.number,
    profile?.neighborhood,
    profile?.city,
    profile?.state && profile.state.length === 2,
  ];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  const latestSignup = signups[0];
  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const upcomingSignups = signups.filter(
    (s) => s.status !== "cancelada" && s.events?.date && dateFromYMD(s.events.date) >= startOfToday
  );
  const filteredSignups =
    statusFilter === "pending"
      ? pendingSignups
      : statusFilter === "confirmed"
      ? confirmedSignups
      : signups;

  return (
    <Layout>
      <SEO title="Minha Corporação | Corporação Assessoria" description="Gerencie seus dados, treinos, provas e inscrições." />
      {/* Prioridade: banner completar cadastro → welcome → tour conta → coachmark abas */}
      {profileComplete && <WelcomeDialog firstName={firstName} />}
      {profileComplete && <OnboardingTour />}
      <section className="section-padding pt-28 md:pt-32">
        <div className="container-page max-w-6xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-1">Área do atleta</p>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                Olá, {firstName} <span className="text-lg md:text-2xl">👋</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe treinos, provas e sua evolução na Corporação.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut().then(() => navigate("/"))}
              className="shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>

          <IncompleteProfileBanner className="mb-6 rounded-2xl border" />

          <AttentionNeeded items={attentionItems} className="mb-6" />

          <CompleteParticipantCard
            signups={signups}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["my_signups", user.id] });
              refetchSignups();
            }}
          />

          <div className="flex flex-col">

          {/* Quick stats — compactos no mobile, cards no desktop */}
          <div className="order-1 mb-4 grid grid-cols-3 gap-1.5 sm:gap-2.5 md:mb-8 md:gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signups");
                signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-xl border border-border/60 bg-card px-1.5 py-2 text-center transition-colors hover:border-brand/40 sm:rounded-2xl sm:px-3 sm:py-3 md:p-4"
            >
              <p className="font-display text-lg font-bold leading-none text-brand sm:text-2xl md:text-3xl">
                {signups.length}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground sm:mt-1.5 sm:text-[11px] md:text-xs">
                Inscrições
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("signups");
                signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "rounded-xl border px-1.5 py-2 text-center transition-colors sm:rounded-2xl sm:px-3 sm:py-3 md:p-4",
                pendingSignups.length > 0
                  ? "border-warning/40 bg-warning/10 hover:border-warning/70"
                  : "border-border/60 bg-card hover:border-brand/40"
              )}
            >
              <p
                className={cn(
                  "font-display text-lg font-bold leading-none sm:text-2xl md:text-3xl",
                  pendingSignups.length > 0 ? "text-warning" : "text-brand"
                )}
              >
                {pendingSignups.length}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground sm:mt-1.5 sm:text-[11px] md:text-xs">
                <span className="sm:hidden">Aguardando</span>
                <span className="hidden sm:inline">Aguardando pagamento</span>
              </p>
            </button>
            <Link
              to="/provas"
              className="rounded-xl border border-border/60 bg-card px-1.5 py-2 text-center transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:rounded-2xl sm:px-3 sm:py-3 md:p-4"
            >
              <p className="font-display text-lg font-bold leading-none text-brand sm:text-2xl md:text-3xl">
                {upcomingSignups.length}
              </p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground sm:mt-1.5 sm:text-[11px] md:text-xs">
                Próximas provas
              </p>
            </Link>
          </div>


          {/* Próximos passos (área secundária, compacta) */}
          <div className="order-3 mb-8 md:mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Próximos passos
            </p>

            <div className="rounded-2xl border border-border/60 bg-card/50 divide-y divide-border/60 md:divide-y-0">
              {/* Treino + prova */}
              <div className="md:grid md:grid-cols-2 md:gap-px md:bg-border/60 md:rounded-2xl md:overflow-hidden">
                <MiniRow
                  icon={<Dumbbell className="w-4 h-4" />}
                  label="Próximo treino"
                  loading={trainingsLoading}
                  title={nextTraining?.title ?? "Nenhum treino agendado"}
                  meta={
                    nextTraining
                      ? `${formatDate(nextTraining.date)} · ${nextTraining.time}${nextTraining.location ? ` • ${nextTraining.location}` : ""}`
                      : undefined
                  }
                  to="/treinos"
                  action={nextTraining ? "Ver agenda" : "Ver treinos"}
                />
                <MiniRow
                  icon={<Trophy className="w-4 h-4" />}
                  label="Próxima prova"
                  loading={eventsLoading}
                  title={nextRace?.name ?? "Nenhuma prova em aberto"}
                  meta={nextRace ? `${formatDate(nextRace.date)}${nextRace.city ? ` • ${nextRace.city}` : ""}` : undefined}
                  to={nextRace ? `/provas/${nextRace.id}` : "/provas"}
                  action={nextRace ? "Ver detalhes" : "Ver provas"}
                />
              </div>

              {/* Meu cadastro */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("data");
                  cadastroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 md:mt-3 md:rounded-2xl md:border md:border-border/60 md:bg-card"
              >
                <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", profileComplete ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                  {profileComplete ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Meu cadastro</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {profileLoading ? "Carregando…" : profileComplete ? "Cadastro completo ✓" : `Cadastro ${completionPct}% completo`}
                  </span>
                  {!profileLoading && !profileComplete && (
                    <Progress value={completionPct} className="h-1 mt-1.5 max-w-[220px]" />
                  )}
                </span>
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                  {profileComplete ? "Editar" : "Completar"}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              {/* Indique um amigo */}
              <button
                type="button"
                onClick={() => toast.info("Em breve você poderá indicar amigos!")}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 md:mt-3 md:rounded-2xl md:border md:border-brand/25 md:bg-gradient-to-r md:from-brand/10 md:to-transparent"
              >
                <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Treinar junto é ainda melhor</span>
                  <span className="block text-xs text-muted-foreground truncate">Convide um amigo para correr com você.</span>
                </span>
                <span className="text-xs font-medium text-brand hidden sm:inline">Indicar</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </div>


          {/* Detailed sections */}
          <div className="order-2 mb-8 md:mb-10 bg-card border border-border/60 rounded-3xl overflow-hidden shadow-card">
            <div className="flex border-b border-border/60 overflow-x-auto no-scrollbar" role="tablist">
              <button
                type="button"
                ref={tabSignupsRef}
                role="tab"
                aria-selected={activeTab === "signups"}
                onClick={() => setActiveTab("signups")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 rounded-t-lg",
                  activeTab === "signups"
                    ? "text-brand border-brand bg-accent-brand/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                Minhas inscrições
              </button>
              {showComprasTab ? (
                <button
                  type="button"
                  ref={tabComprasRef}
                  role="tab"
                  aria-selected={activeTab === "compras"}
                  onClick={() => setActiveTab("compras")}
                  className={cn(
                    "px-5 py-3.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 rounded-t-lg",
                    activeTab === "compras"
                      ? "text-brand border-brand bg-accent-brand/5"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted/40"
                  )}
                >
                  Compras da prova
                </button>
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "pedidos"}
                onClick={() => setActiveTab("pedidos")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 rounded-t-lg",
                  activeTab === "pedidos"
                    ? "text-brand border-brand bg-accent-brand/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                Meus pedidos
              </button>
              <button
                type="button"
                ref={tabParticipantsRef}
                role="tab"
                aria-selected={activeTab === "participants"}
                onClick={() => setActiveTab("participants")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 rounded-t-lg",
                  activeTab === "participants"
                    ? "text-brand border-brand bg-accent-brand/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                Meus participantes
              </button>
              <button
                type="button"
                ref={tabDataRef}
                role="tab"
                aria-selected={activeTab === "data"}
                onClick={() => setActiveTab("data")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 rounded-t-lg",
                  activeTab === "data"
                    ? "text-brand border-brand bg-accent-brand/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                Meu cadastro
              </button>
            </div>

            <TabsCoachmark
              enabled={profileComplete && tabsMounted}
              steps={[
                {
                  el: tabsMounted ? tabSignupsRef.current : null,
                  title: "Suas provas ficam aqui",
                  text: "Acompanhe inscrições, pagamentos e confirmações.",
                },
                ...(showComprasTab
                  ? [
                      {
                        el: tabsMounted ? tabComprasRef.current : null,
                        title: "Compras da prova",
                        text: "Produtos comprados avulsamente, separados das inscrições.",
                      },
                    ]
                  : []),
                {
                  el: tabsMounted ? tabParticipantsRef.current : null,
                  title: "Inscreva sua turma mais rápido",
                  text: "Salve familiares, amigos ou alunos para reutilizar nas próximas provas.",
                },
                {
                  el: tabsMounted ? tabDataRef.current : null,
                  title: "Seus dados atualizados",
                  text: "Consulte e atualize as informações da sua conta.",
                },
              ]}
            />


            <div className="p-4 md:p-6 lg:p-8">
              {activeTab === "signups" && (
                <div ref={signupsRef}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display text-xl font-bold">Minhas inscrições</h2>
                      <p className="text-sm text-muted-foreground">Acompanhe o status de todas as suas provas.</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="hidden sm:flex shrink-0">
                      <Link to="/provas">+ Nova inscrição</Link>
                    </Button>
                  </div>

                  {signups.length > 0 && (
                    <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar">
                      {([
                        ["all", `Todas (${signups.length})`],
                        ["pending", `Pendentes (${pendingSignups.length})`],
                        ["confirmed", `Confirmadas (${confirmedSignups.length})`],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStatusFilter(key)}
                          className={cn(
                            "min-h-9 shrink-0 touch-manipulation rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                            statusFilter === key
                              ? "border-brand/50 bg-brand/10 text-brand shadow-sm"
                              : "border-border/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {signupsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : signups.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="Você ainda não tem inscrições"
                      description="Escolha uma prova e faça sua primeira inscrição. O status e o pagamento ficam todos aqui."
                      actionLabel="Ver provas"
                      actionTo="/provas"
                    />
                  ) : (
                    <div className="space-y-3 pb-16 md:pb-0">
                      {filteredSignups.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma inscrição neste filtro.</p>
                      ) : (
                        filteredSignups.map((s) => (
                          <SignupCard
                            key={s.id}
                            signup={s}
                            highlight={s.id === highlightId}
                            responsibleName={profile?.full_name || ""}
                            pricing={eventPricingById.get(s.event_id)}
                            orders={allOrders.filter((o) => o.signup_id === s.id && o.status !== "cancelada")}
                          />
                        ))
                      )}
                      <Button asChild variant="outline" className="mt-1 min-h-11 w-full">
                        <Link to="/provas">+ Inscrever outra pessoa</Link>
                      </Button>
                    </div>
                  )}

                </div>
              )}

              {activeTab === "compras" && showComprasTab ? (
                <div className="space-y-8">
                  <AccountEventStoreOrders />
                </div>
              ) : null}

              {activeTab === "pedidos" && <AccountProductOrders />}

              {activeTab === "participants" && <ParticipantsPanel />}

              {activeTab === "data" && (
                <div ref={cadastroRef}>
                  <div className="mb-5">
                    <h2 className="font-display text-xl font-bold">Meu cadastro</h2>
                    <p className="text-sm text-muted-foreground">Mantenha seus dados atualizados para inscrições e comunicações.</p>
                  </div>
                  {profileLoading ? <Skeleton className="h-96" /> : <ProfileEditor profile={profile} />}
                </div>
              )}
            </div>
          </div>

          </div>
        </div>
      </section>
    </Layout>
  );
};

const parseKits = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch {}
  return [value];
};

type SignupPricing = { id: string; name: string; distances?: any; kitOptions?: any };

const SignupCard = ({
  signup: s,
  highlight = false,
  responsibleName = "",
  pricing,
  orders = [],
}: {
  signup: EventSignup;
  highlight?: boolean;
  responsibleName?: string;
  pricing?: SignupPricing;
  orders?: MyEventStoreOrderRow[];
}) => {
  const isConfirmed = s.status === "confirmada";
  const isCancelled = s.status === "cancelada";
  const isPending = !isConfirmed && !isCancelled;

  // Cada inscrição manda o comprovante para o organizador da sua prova.
  const settings = useSettings();
  const {
    data: eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
  } = useEventPayment(isPending ? s.event_id : null);
  const payView = resolveAthletePaymentView({
    eventPayment,
    isLoading: paymentLoading,
    isError: paymentError,
    isFetched: paymentFetched,
    eventOrganizerId: s.events?.organizer_id,
    siteWhatsapp: settings.contact.whatsapp,
  });
  const proofWhatsapp = payView.proofWhatsapp;

  const parts = (s.category || "").split("·").map((p) => p.trim()).filter(Boolean);
  const modality = parts[0] || s.events?.distance || "";
  const category = parts.slice(1).join(" · ");
  const kits = parseKits(s.kit_option);
  const kitDelivery = (s.events?.kit_delivery || "").trim();
  const kitInfo = (s.events?.kit_info || "").trim();
  const eventName = s.events?.name || "Prova";
  // Histórico: sem participant_full_name, o titular era o atleta.
  const participantName =
    (s.participant_full_name || "").trim() || (responsibleName || "").trim();

  // Valor da inscrição a partir do preço da modalidade no evento + extras do kit.
  const kitExtra = Array.isArray(pricing?.kitOptions)
    ? (pricing!.kitOptions as any[]).reduce(
        (sum, k) => (kits.includes(k?.name) ? sum + (Number(k?.extra_price) || 0) : sum),
        0
      )
    : 0;
  const signupTotal = pricing ? (signupValue(s as any, pricing) ?? 0) + kitExtra : 0;

  const whatsMessage = buildSignupWhatsMessage({
    responsible: responsibleName,
    eventName: s.events?.name || "",
    blocks: [
      {
        participant: participantName,
        modality,
        category,
        kits,
        shirtSize: s.shirt_size || "",
        value: signupTotal > 0 ? signupTotal : null,
      },
    ],
  });

  const proofLink = whatsappLinkFor(proofWhatsapp, whatsMessage);

  return (
    <article
      className={cn(
        "rounded-xl border bg-background px-3.5 py-3 transition-shadow sm:rounded-2xl sm:px-4 sm:py-3.5",
        isPending && "border-warning/40",
        isConfirmed && "border-success/35 bg-success/[0.03]",
        isCancelled && "border-border/60 opacity-60",
        !isPending && !isConfirmed && !isCancelled && "border-border/60",
        highlight && "ring-2 ring-brand ring-offset-2 ring-offset-background"
      )}
    >
      {highlight && (
        <p className="mb-2 inline-flex rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">
          Sua inscrição está aqui ✓
        </p>
      )}

      {/* Status no topo — pendente bem visível; confirmada como estado positivo */}
      {isPending && (
        <p className="mb-2 inline-flex rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
          Aguardando pagamento
        </p>
      )}
      {isConfirmed && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Inscrição confirmada
        </p>
      )}
      {isCancelled && (
        <p className="mb-2 inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Cancelada
        </p>
      )}

      <div className="min-w-0 space-y-1">
        <h3 className="break-words font-display text-base font-bold leading-snug sm:text-lg">{eventName}</h3>
        <p className="break-words text-sm text-foreground/90">
          <span className="text-muted-foreground">Participante:</span>{" "}
          <span className="font-medium">{participantName || "—"}</span>
        </p>
        {(modality || category) && (
          <p className="break-words text-xs text-muted-foreground sm:text-sm">
            {[modality, category].filter(Boolean).join(" · ")}
          </p>
        )}
        {signupTotal > 0 && (
          <p className="pt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(signupTotal)}
          </p>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
        <StatusTimeline
          steps={
            isCancelled
              ? [
                  { id: "created", label: "Inscrição criada" },
                  { id: "cancelled", label: "Cancelada" },
                ]
              : SIGNUP_TIMELINE_STEPS
          }
          currentIndex={isCancelled ? 1 : signupTimelineIndex(s.status).index}
          failed={isCancelled}
        />
      </div>

      {isPending && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {s.events?.id && (
            <Button asChild variant="brand" className="h-11 min-h-11 w-full flex-1 touch-manipulation sm:flex-[1.4]">
              <Link to={`/provas/${s.events.id}/inscricao?retomar=${s.id}`}>Realizar pagamento</Link>
            </Button>
          )}
          {payView.unavailable ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground/85 sm:flex-1">
              {PAYMENT_UNAVAILABLE_MESSAGE}
            </p>
          ) : (
            proofLink && (
              <Button
                asChild
                variant="outline"
                className="h-11 min-h-11 w-full touch-manipulation text-muted-foreground sm:w-auto sm:flex-1"
              >
                <a
                  href={proofLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Enviar comprovante no WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar comprovante
                </a>
              </Button>
            )
          )}
        </div>
      )}

      <details className="group mt-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between py-1.5 text-sm font-medium text-muted-foreground touch-manipulation hover:text-foreground">
          <span>Detalhes da inscrição</span>
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-1 space-y-1.5 border-t border-border/60 pt-2 text-sm">
          <DetailRow label="Participante" value={participantName} />
          <DetailRow label="Modalidade" value={modality} />
          <DetailRow label="Categoria" value={category} />
          <DetailRow label="Kit" value={kits.join(", ")} />
          <DetailRow label="Camiseta" value={s.shirt_size || ""} />
          <DetailRow label="Data" value={s.events?.date ? formatDate(s.events.date) : ""} />
          <DetailRow label="Horário" value={s.events?.start_time || ""} />
          <DetailRow label="Local" value={s.events?.city || ""} />
          <DetailRow label="Nº da inscrição" value={s.id} mono />

          {isConfirmed && (kitDelivery || kitInfo) && (
            <div className="mt-2.5 rounded-xl border border-brand/25 bg-brand/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
                <Package className="h-4 w-4" /> Retirada do kit
              </p>
              {kitDelivery && (
                <p className="mt-1.5 whitespace-pre-line break-words text-sm font-medium">{kitDelivery}</p>
              )}
              {kitInfo && (
                <p className="mt-1.5 whitespace-pre-line break-words text-sm text-muted-foreground">{kitInfo}</p>
              )}
            </div>
          )}

          {s.events?.id && (
            <Button asChild variant="ghost" size="sm" className="mt-1.5 w-full sm:w-auto">
              <Link to={`/provas/${s.events.id}`}>Ver detalhes da prova</Link>
            </Button>
          )}
        </div>
      </details>

      {orders.flatMap((o) => orderItemsToAcquired(o)).length > 0 && (
        <div className="mt-2 border-t border-border/40 pt-2 space-y-0.5">
          {orders.flatMap((o) => orderItemsToAcquired(o)).map((item, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <Package className="inline h-3 w-3 mr-1 opacity-50" />
              {item.name}{item.variant_name ? ` · ${item.variant_name}` : ""}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
            </p>
          ))}
        </div>
      )}
    </article>
  );
};

const DetailRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("font-medium text-right break-all", mono && "font-mono text-xs", !value && "text-muted-foreground/60")}>
      {value || "—"}
    </span>
  </div>
);


const MiniRow = ({
  icon,
  label,
  loading,
  title,
  meta,
  to,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  title: string;
  meta?: string;
  to: string;
  action: string;
}) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-4 py-3.5 bg-card transition-colors hover:bg-muted/40"
  >
    <span className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-32 mt-1" />
      ) : (
        <>
          <span className="block text-sm font-semibold truncate">{title}</span>
          {meta && <span className="block text-xs text-muted-foreground truncate">{meta}</span>}
        </>
      )}
    </span>
    <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{action}</span>
    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
  </Link>
);


const ProfileEditor = ({ profile }: { profile: any }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const methods = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      full_name: profile?.full_name || "",
      cpf: profile?.cpf || "",
      birth_date: toBirthDateInputValue(profile?.birth_date),
      gender: profile?.gender || "",
      phone: profile?.phone || "",
      whatsapp: profile?.whatsapp || "",
      email: profile?.email || user?.email || "",
      cep: profile?.cep || "",
      street: profile?.street || "",
      number: profile?.number || "",
      complement: profile?.complement || "",
      neighborhood: profile?.neighborhood || "",
      city: profile?.city || "",
      state: profile?.state || "",
      team_name: profile?.team_name || "",
      accepts_marketing: profile?.accepts_marketing || false,
    },
  });

  const onSubmit = async (v: ProfileValues) => {
    const payload = {
      ...v,
      cpf: onlyDigits(v.cpf),
      cep: onlyDigits(v.cep),
      user_id: user!.id,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dados atualizados!");
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="bg-background border border-border/60 rounded-2xl p-5 md:p-6 space-y-5">
        <ProfileFields />
        <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto">
          Salvar alterações
        </Button>
      </form>
    </FormProvider>
  );
};

export default MinhaConta;
