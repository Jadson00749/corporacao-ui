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
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
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
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { WelcomeDialog } from "@/components/site/WelcomeDialog";
import { OnboardingTour } from "@/components/site/OnboardingTour";
import { IncompleteProfileBanner } from "@/components/site/IncompleteProfileBanner";
import type { EventSignup } from "@/hooks/useProfile";
import { ParticipantsPanel } from "@/components/account/ParticipantsPanel";
import { TabsCoachmark } from "@/components/site/TabsCoachmark";


const today = () => new Date();
const dateFromYMD = (d: string) => new Date(d + "T12:00:00");
const formatDate = (d: string) =>
  dateFromYMD(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const formatDateShort = (d: string) =>
  dateFromYMD(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const MinhaConta = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: signups = [], isLoading: signupsLoading, refetch: refetchSignups } = useMySignups();
  const { data: trainings = [], isLoading: trainingsLoading } = useTrainings();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const qc = useQueryClient();
  const buildWhats = useWhatsappLink();
  const signupsRef = useRef<HTMLDivElement>(null);
  const cadastroRef = useRef<HTMLDivElement>(null);
  const tabSignupsRef = useRef<HTMLButtonElement>(null);
  const tabParticipantsRef = useRef<HTMLButtonElement>(null);
  const tabDataRef = useRef<HTMLButtonElement>(null);
  const [tabsMounted, setTabsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"signups" | "participants" | "data">("signups");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed">("all");

  useEffect(() => {
    setTabsMounted(true);
  }, []);



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

  if (loading || !user) return null;

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

  const confirmedSignups = signups.filter((s) => s.status === "confirmada");
  const pendingSignups = signups.filter((s) => s.status !== "confirmada" && s.status !== "cancelada");
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
      <WelcomeDialog firstName={firstName} />
      <OnboardingTour />
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

          <div className="flex flex-col">

          {/* Contador compacto (mobile) */}
          <p className="order-1 md:hidden mb-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{signups.length}</span> inscriç{signups.length === 1 ? "ão" : "ões"}
            {pendingSignups.length > 0 && (
              <> • <span className="font-semibold text-warning">{pendingSignups.length}</span> aguardando pagamento</>
            )}
          </p>

          {/* Quick stats row */}
          <div className="order-4 md:order-1 hidden md:grid grid-cols-3 gap-2.5 md:gap-4 mb-6 md:mb-8">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signups");
                signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="bg-card border border-border/60 rounded-2xl p-3 md:p-4 text-center transition-colors hover:border-brand/40"
            >
              <p className="text-2xl md:text-3xl font-display font-bold text-brand leading-none">{signups.length}</p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-1.5 leading-tight">Inscrições</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("signups");
                signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "rounded-2xl border p-3 md:p-4 text-center transition-colors",
                pendingSignups.length > 0
                  ? "border-warning/40 bg-warning/10 hover:border-warning/70"
                  : "border-border/60 bg-card hover:border-brand/40"
              )}
            >
              <p
                className={cn(
                  "text-2xl md:text-3xl font-display font-bold leading-none",
                  pendingSignups.length > 0 ? "text-warning" : "text-brand"
                )}
              >
                {pendingSignups.length}
              </p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-1.5 leading-tight">Aguardando pagamento</p>
            </button>
            <div className="bg-card border border-border/60 rounded-2xl p-3 md:p-4 text-center">
              <p className="text-2xl md:text-3xl font-display font-bold text-brand leading-none">{upcomingSignups.length}</p>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-1.5 leading-tight">Próximas provas</p>
            </div>
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
              steps={[
                {
                  el: tabsMounted ? tabSignupsRef.current : null,
                  title: "Suas provas ficam aqui 🏃",
                  text: "Acompanhe inscrições, pagamentos e confirmações.",
                },
                {
                  el: tabsMounted ? tabParticipantsRef.current : null,
                  title: "Inscreva sua turma mais rápido 👥",
                  text: "Salve familiares, amigos ou alunos para reutilizar os dados nas próximas provas.",
                },
                {
                  el: tabsMounted ? tabDataRef.current : null,
                  title: "Seus dados, sempre atualizados ✓",
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
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
                      {([
                        ["all", `Todas (${signups.length})`],
                        ["pending", `Aguardando pagamento (${pendingSignups.length})`],
                        ["confirmed", `Confirmadas (${confirmedSignups.length})`],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStatusFilter(key)}
                          className={cn(
                            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                            statusFilter === key
                              ? "border-brand bg-brand/10 text-brand"
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
                    <div className="text-center py-10 md:py-14">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="font-display font-semibold">Você ainda não tem inscrições</p>
                      <p className="text-sm text-muted-foreground mb-4">Escolha uma prova e faça sua primeira inscrição.</p>
                      <Button asChild variant="brand"><Link to="/provas">Ver provas</Link></Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSignups.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma inscrição neste filtro.</p>
                      ) : (
                        filteredSignups.map((s) => (
                          <SignupCard key={s.id} signup={s} buildWhats={buildWhats} highlight={s.id === highlightId} />
                        ))
                      )}
                      <Button asChild variant="outline" className="w-full min-h-11 mt-1">
                        <Link to="/provas">+ Inscrever outra pessoa</Link>
                      </Button>
                    </div>
                  )}

                </div>
              )}

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

const SignupCard = ({
  signup: s,
  buildWhats,
  highlight = false,
}: {
  signup: EventSignup;
  buildWhats: (msg: string) => string;
  highlight?: boolean;
}) => {
  const isConfirmed = s.status === "confirmada";
  const isCancelled = s.status === "cancelada";
  const isPending = !isConfirmed && !isCancelled;

  const parts = (s.category || "").split("·").map((p) => p.trim()).filter(Boolean);
  const modality = parts[0] || s.events?.distance || "";
  const category = parts.slice(1).join(" · ");
  const kits = parseKits(s.kit_option);
  const kitDelivery = (s.events?.kit_delivery || "").trim();
  const kitInfo = (s.events?.kit_info || "").trim();
  const athlete = s.participant_full_name || s.events?.name || "Prova";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-background p-3.5 sm:p-4 transition-shadow",
        isPending ? "border-warning/40" : isConfirmed ? "border-success/30" : "border-border/60",
        isCancelled && "opacity-60",
        highlight && "ring-2 ring-brand ring-offset-2 ring-offset-background"
      )}
    >
      {highlight && (
        <p className="mb-2 inline-flex rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">
          Sua inscrição está aqui ✓
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base sm:text-lg font-bold leading-snug break-words">{athlete}</h3>
          {s.participant_full_name && (
            <p className="text-sm text-muted-foreground break-words">{s.events?.name || "Prova"}</p>
          )}
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground break-words">
            {[modality, category].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight text-center",
            isConfirmed
              ? "bg-success/15 text-success border-success/40"
              : isCancelled
              ? "bg-muted text-muted-foreground border-border"
              : "bg-warning/15 text-warning border-warning/40"
          )}
        >
          {isConfirmed ? "🟢 Confirmada" : isCancelled ? "⚪ Cancelada" : "🟡 Aguardando pagamento"}
        </span>
      </div>

      {isPending && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {s.events?.id && (
            <Button asChild variant="brand" className="min-h-11 flex-1">
              <Link to={`/provas/${s.events.id}/inscricao?retomar=${s.id}`}>Pagar agora</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-11 flex-1 sm:flex-none">
            <a
              href={buildWhats(
                `Olá! Fiz minha inscrição na prova ${s.events?.name || ""} (atleta ${s.participant_full_name || ""}) e gostaria de enviar o comprovante do PIX.`
              )}
              target="_blank"
              rel="noreferrer"
              aria-label="Enviar comprovante no WhatsApp"
            >
              <MessageCircle className="w-4 h-4" /> Enviar comprovante
            </a>
          </Button>
        </div>
      )}

      <details className="group mt-2.5">
        <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground py-1.5">
          <span>Ver detalhes</span>
          <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
        </summary>
        <div className="pt-2 space-y-1.5 text-sm border-t border-border/60 mt-1">
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
                <Package className="w-4 h-4" /> Retirada do kit
              </p>
              {kitDelivery && <p className="mt-1.5 whitespace-pre-line text-sm font-medium break-words">{kitDelivery}</p>}
              {kitInfo && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground break-words">{kitInfo}</p>
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
      birth_date: profile?.birth_date || "",
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
