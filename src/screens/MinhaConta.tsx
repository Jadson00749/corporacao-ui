import { useEffect } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useMySignups } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileFields } from "@/components/account/ProfileFields";
import { profileSchema, ProfileValues } from "@/lib/profileSchema";
import { onlyDigits } from "@/lib/cpf";
import { toast } from "sonner";
import { Calendar, MapPin, LogOut, MessageCircle } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { WelcomeDialog } from "@/components/site/WelcomeDialog";
import { IncompleteProfileBanner } from "@/components/site/IncompleteProfileBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MinhaConta = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: signups = [], isLoading: signupsLoading, refetch: refetchSignups } = useMySignups();
  const qc = useQueryClient();
  const buildWhats = useWhatsappLink();

  const cancelSignup = async (id: string) => {
    const { error } = await supabase.from("event_signups").update({ status: "cancelada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Inscrição cancelada");
    qc.invalidateQueries({ queryKey: ["my_signups", user?.id] });
    refetchSignups();
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <Layout>
      <SEO title="Minha conta | Corporação Assessoria" description="Gerencie seus dados e suas inscrições em corridas." />
      <WelcomeDialog firstName={profile?.full_name?.split(" ")[0]} />
      <section className="section-padding pt-32">
        <div className="container-page max-w-4xl">
          <IncompleteProfileBanner className="mb-6 rounded-2xl border" />
          <div className="flex items-center justify-between mb-6">
            <div>
              {profile?.full_name ? (
                <>
                  <h1 className="font-display text-3xl font-bold">Bem-vindo, {profile.full_name.split(" ")[0]}</h1>
                  <p className="text-sm text-muted-foreground mt-1">Gerencie seus dados e suas inscrições</p>
                </>
              ) : (
                <>
                  <h1 className="font-display text-3xl font-bold">Minha conta</h1>
                  <p className="text-sm text-muted-foreground mt-1">Olá, {user.email}</p>
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>

          <Tabs defaultValue="signups">
            <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
              <TabsTrigger value="signups">Minhas inscrições</TabsTrigger>
              <TabsTrigger value="data">Meus dados</TabsTrigger>
            </TabsList>

            <TabsContent value="signups">
              {signupsLoading ? (
                <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
              ) : signups.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <p className="text-muted-foreground mb-4">Você ainda não tem inscrições.</p>
                  <Button asChild variant="brand"><Link to="/provas">Ver provas disponíveis</Link></Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {signups.map((s) => (
                    <article key={s.id} className="bg-card border border-border/60 rounded-2xl p-6 shadow-card hover:shadow-elegant transition-shadow flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                      <div>
                        <h3 className="font-display font-semibold text-lg">{s.events?.name || "Prova"}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                          {s.events?.date && (
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                              {new Date(s.events.date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          )}
                          {s.events?.city && (
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{s.events.city}</span>
                          )}
                          {s.category && <span>Categoria: <strong>{s.category}</strong></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className={
                          "text-xs font-semibold px-3 py-1 rounded-full border " +
                          (s.status === "confirmada" ? "bg-success/15 text-success border-success/40" :
                           s.status === "cancelada" ? "bg-muted text-muted-foreground border-border" :
                           "bg-warning/15 text-warning border-warning/40 dark:text-warning")
                        }>
                          {s.status}
                        </span>
                        {s.status !== "confirmada" && s.status !== "cancelada" && (
                          <Button
                            asChild
                            variant="brand"
                            size="sm"
                            title="Enviar comprovante no WhatsApp"
                          >
                            <a
                              href={buildWhats(`Olá! Fiz minha inscrição na prova ${s.events?.name || ""} (categoria ${s.category || ""}) e gostaria de enviar o comprovante do PIX.`)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Enviar comprovante no WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span className="hidden sm:inline">Comprovante</span>
                            </a>
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="data">
              {isLoading ? <Skeleton className="h-96" /> : <ProfileEditor profile={profile} />}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
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
    if (error) { toast.error(error.message); return; }
    toast.success("Dados atualizados!");
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <ProfileFields />
        <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto">Salvar alterações</Button>
      </form>
    </FormProvider>
  );
};

export default MinhaConta;
