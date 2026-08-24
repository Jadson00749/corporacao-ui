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
  Shirt,
  Clock,
  Timer,
} from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { WelcomeDialog } from "@/components/site/WelcomeDialog";
import { OnboardingTour } from "@/components/site/OnboardingTour";
import { IncompleteProfileBanner } from "@/components/site/IncompleteProfileBanner";
import type { EventSignup } from "@/hooks/useProfile";

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
  const [activeTab, setActiveTab] = useState<"signups" | "data">("signups");
  const [highlightId, setHighlightId] = useState<string | null>(null);

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


          {/* Dashboard cards */}
          <div className="order-3 md:order-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
            {/* Next training */}
            <DashboardCard
              icon={<Dumbbell className="w-5 h-5" />}
              label="Próximo treino"
              loading={trainingsLoading}
              empty={!nextTraining}
              emptyTitle="Nenhum treino agendado"
              emptyAction={<Button asChild variant="brand" size="sm"><Link to="/treinos">Ver treinos</Link></Button>}
            >
              {nextTraining && (
                <div className="space-y-3">
                  <div>
                    <p className="font-display font-semibold text-lg leading-tight">{nextTraining.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {formatDate(nextTraining.date)} · {nextTraining.time}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{nextTraining.location}</p>
                  <Button asChild variant="outline" size="sm" className="w-full mt-1">
                    <Link to="/treinos">Ver agenda</Link>
                  </Button>
                </div>
              )}
            </DashboardCard>

            {/* Next race */}
            <DashboardCard
              icon={<Trophy className="w-5 h-5" />}
              label="Próxima prova"
              loading={eventsLoading}
              empty={!nextRace}
              emptyTitle="Nenhuma prova em aberto"
              emptyAction={<Button asChild variant="brand" size="sm"><Link to="/provas">Ver provas</Link></Button>}
            >
              {nextRace && (
                <div className="space-y-3">
                  <div>
                    <p className="font-display font-semibold text-lg leading-tight">{nextRace.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {formatDate(nextRace.date)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {nextRace.city}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full mt-1">
                    <Link to={`/provas/${nextRace.id}`}>Ver detalhes</Link>
                  </Button>
                </div>
              )}
            </DashboardCard>

            {/* My signups */}
            <DashboardCard
              icon={<ClipboardList className="w-5 h-5" />}
              label="Minhas inscrições"
              loading={signupsLoading}
              empty={signups.length === 0}
              emptyTitle="Você ainda não tem inscrições"
              emptyAction={<Button asChild variant="brand" size="sm"><Link to="/provas">Ver provas</Link></Button>}
            >
              {signups.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-brand/10 text-brand rounded-xl px-3 py-2 text-center min-w-[4.5rem]">
                      <p className="font-display font-bold text-xl">{signups.length}</p>
                      <p className="text-[10px] leading-none uppercase tracking-wide">Total</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">{pendingSignups.length} pendente{pendingSignups.length !== 1 ? "s" : ""}</p>
                      <p className="text-sm text-muted-foreground">{confirmedSignups.length} confirmada{confirmedSignups.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {latestSignup && (
                    <div className="border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Última inscrição</p>
                      <p className="font-medium text-sm truncate">{latestSignup.events?.name || "Prova"}</p>
                      <p className="text-xs text-muted-foreground">{latestSignup.events?.date ? formatDateShort(latestSignup.events.date) : ""} · {latestSignup.status}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1 group"
                    onClick={() => {
                      setActiveTab("signups");
                      signupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Gerenciar inscrições <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              )}
            </DashboardCard>

            {/* My profile / cadastro */}
            <DashboardCard
              icon={<UserRound className="w-5 h-5" />}
              label="Meu cadastro"
              loading={profileLoading}
              empty={false}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", profileComplete ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {profileComplete ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold">{profileComplete ? "Cadastro completo" : "Complete seu cadastro"}</p>
                    <p className="text-xs text-muted-foreground">{completionPct}% preenchido</p>
                  </div>
                </div>
                <Progress value={completionPct} className="h-2" />
                <Button
                  variant={profileComplete ? "outline" : "brand"}
                  size="sm"
                  className="w-full mt-1"
                  onClick={() => {
                    setActiveTab("data");
                    cadastroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {profileComplete ? "Editar cadastro" : "Completar cadastro"}
                </Button>
              </div>
            </DashboardCard>

            {/* Invite a friend */}
            <DashboardCard
              icon={<Users className="w-5 h-5" />}
              label="Indique um amigo"
              loading={false}
              empty={false}
              highlight
            >
              <div className="space-y-3">
                <div>
                  <p className="font-display font-semibold text-lg">Treinar junto é ainda melhor</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Em breve você poderá indicar amigos e ganhar benefícios.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info("Em breve você poderá indicar amigos!")}>
                  Quero indicar
                </Button>
              </div>
            </DashboardCard>
          </div>

          {/* Detailed sections */}
          <div className="order-2 md:order-3 mb-8 md:mb-0 bg-card border border-border/60 rounded-3xl overflow-hidden shadow-card">
            <div className="flex border-b border-border/60 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab("signups")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                  activeTab === "signups" ? "text-brand border-brand" : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                Minhas inscrições
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("data")}
                className={cn(
                  "px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px",
                  activeTab === "data" ? "text-brand border-brand" : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                Meu cadastro
              </button>
            </div>

            <div className="p-4 md:p-6 lg:p-8">
              {activeTab === "signups" && (
                <div ref={signupsRef}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-display text-xl font-bold">Minhas inscrições</h2>
                      <p className="text-sm text-muted-foreground">Acompanhe o status de todas as suas provas.</p>
                    </div>
                    <Button asChild variant="brand" size="sm" className="hidden sm:flex">
                      <Link to="/provas">Ver provas</Link>
                    </Button>
                  </div>
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
                      <p className="text-muted-foreground mb-4">Você ainda não tem inscrições.</p>
                      <Button asChild variant="brand"><Link to="/provas">Ver provas disponíveis</Link></Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {signups.map((s) => (
                        <SignupCard key={s.id} signup={s} buildWhats={buildWhats} highlight={s.id === highlightId} />
                      ))}
                    </div>
                  )}
                </div>
              )}

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

  return (
    <article
      className={cn(
        "rounded-2xl border bg-background p-4 sm:p-5 transition-shadow hover:shadow-card",
        isPending ? "border-warning/40" : isConfirmed ? "border-success/30" : "border-border/60",
        isCancelled && "opacity-70",
        highlight && "ring-2 ring-brand ring-offset-2 ring-offset-background"
      )}
    >
      {highlight && (
        <p className="mb-2.5 inline-flex rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">
          Inscrição recém-criada
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base sm:text-lg font-semibold leading-snug break-words">
            {s.events?.name || "Prova"}
          </h3>
          {s.participant_full_name && (
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-brand break-words">
              Atleta: {s.participant_full_name}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            {s.events?.date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {formatDate(s.events.date)}
              </span>
            )}
            {s.events?.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {s.events.start_time}
              </span>
            )}
            {s.events?.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {s.events.city}
              </span>
            )}
          </div>
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
          {isConfirmed ? "Inscrição confirmada" : isCancelled ? "Cancelada" : "Aguardando pagamento"}
        </span>
      </div>

      {/* Detalhes da inscrição */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DetailChip icon={<Timer className="w-3.5 h-3.5" />} label="Modalidade" value={modality} />
        <DetailChip icon={<Trophy className="w-3.5 h-3.5" />} label="Categoria" value={category} />
        <DetailChip icon={<Package className="w-3.5 h-3.5" />} label="Kit" value={kits.join(", ")} />
        <DetailChip icon={<Shirt className="w-3.5 h-3.5" />} label="Camiseta" value={s.shirt_size || ""} />
      </div>

      {/* Retirada do kit — apenas informativo, dados do organizador */}
      {isConfirmed && (kitDelivery || kitInfo) && (
        <div className="mt-3.5 rounded-xl border border-brand/25 bg-brand/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
            <Package className="w-4 h-4" /> Retirada do kit
          </p>
          {kitDelivery && (
            <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-relaxed break-words">{kitDelivery}</p>
          )}
          {kitInfo && (
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground break-words">
              {kitInfo}
            </p>
          )}
        </div>
      )}

      {isPending && (
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
          {s.events?.id && (
            <Button asChild variant="brand" className="min-h-11 flex-1">
              <Link to={`/provas/${s.events.id}/inscricao?retomar=${s.id}`}>Continuar inscrição</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-11 flex-1 sm:flex-none">
            <a
              href={buildWhats(
                `Olá! Fiz minha inscrição na prova ${s.events?.name || ""} (categoria ${s.category || ""}) e gostaria de enviar o comprovante do PIX.`
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

      {isConfirmed && s.events?.id && (
        <Button asChild variant="outline" className="mt-3.5 min-h-11 w-full sm:w-auto">
          <Link to={`/provas/${s.events.id}`}>Ver detalhes da prova</Link>
        </Button>
      )}
    </article>
  );
};

const DetailChip = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card px-3 py-2 min-w-0">
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="text-brand">{icon}</span> {label}
    </p>
    <p className={cn("mt-0.5 text-sm font-medium break-words", !value && "text-muted-foreground/60")}>
      {value || "—"}
    </p>
  </div>
);

const DashboardCard = ({
  icon,
  label,
  loading,
  empty,
  emptyTitle,
  emptyAction,
  children,
  className = "",
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  empty: boolean;
  emptyTitle?: string;
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}) => {
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-5 flex flex-col transition-all hover:shadow-card hover:-translate-y-0.5",
        highlight ? "border-brand/30 bg-gradient-to-br from-card to-brand/5" : "border-border/60",
        className
      )}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
          {icon}
        </div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <div className="flex-1">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : empty ? (
          <div className="h-full flex flex-col justify-between">
            <p className="text-sm text-muted-foreground mb-4">{emptyTitle}</p>
            {emptyAction}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

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
