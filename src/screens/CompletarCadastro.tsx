import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Layout } from "@/components/site/Layout";
import { SEO } from "@/components/site/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileFields } from "@/components/account/ProfileFields";
import { profileSchema, ProfileValues } from "@/lib/profileSchema";
import { isProfileComplete } from "@/lib/profileComplete";
import { formatCEP, formatCPF, formatPhone, onlyDigits } from "@/lib/cpf";
import { toast } from "sonner";

const CompletarCadastro = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const [submitting, setSubmitting] = useState(false);

  const googleName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    "";
  const avatar =
    (user?.user_metadata?.avatar_url as string) ||
    (user?.user_metadata?.picture as string) ||
    "";

  const methods = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      full_name: "", cpf: "", birth_date: "", gender: "", phone: "", whatsapp: "",
      email: "", cep: "", street: "", number: "", complement: "",
      neighborhood: "", city: "", state: "", team_name: "", accepts_marketing: false,
    },
  });
  const { reset } = methods;

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Já completo? vai direto pra conta.
  useEffect(() => {
    if (!isLoading && isProfileComplete(profile)) {
      navigate("/minha-conta", { replace: true });
    }
  }, [isLoading, profile, navigate]);

  // Pré-preenche com o que já existe no perfil + dados do Google (sem sobrescrever).
  useEffect(() => {
    if (isLoading || !user) return;
    reset({
      full_name: profile?.full_name || googleName,
      cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
      birth_date: profile?.birth_date || "",
      gender: profile?.gender || "",
      phone: profile?.phone ? formatPhone(profile.phone) : "",
      whatsapp: profile?.whatsapp ? formatPhone(profile.whatsapp) : "",
      email: profile?.email || user.email || "",
      cep: profile?.cep ? formatCEP(profile.cep) : "",
      street: profile?.street || "",
      number: profile?.number || "",
      complement: profile?.complement || "",
      neighborhood: profile?.neighborhood || "",
      city: profile?.city || "",
      state: profile?.state || "",
      team_name: profile?.team_name || "",
      accepts_marketing: !!profile?.accepts_marketing,
    });
  }, [isLoading, profile, user, googleName, reset]);

  const initials = useMemo(
    () => (googleName || user?.email || "?").trim().charAt(0).toUpperCase(),
    [googleName, user?.email]
  );

  const onSubmit = async (values: ProfileValues) => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        email: user.email || values.email,
        full_name: values.full_name,
        cpf: onlyDigits(values.cpf),
        birth_date: values.birth_date || null,
        gender: values.gender || "",
        phone: values.phone || "",
        whatsapp: values.whatsapp,
        cep: onlyDigits(values.cep),
        street: values.street,
        number: values.number,
        complement: values.complement || "",
        neighborhood: values.neighborhood,
        city: values.city,
        state: values.state,
        team_name: values.team_name || "",
        accepts_marketing: !!values.accepts_marketing,
        accepted_terms_at: profile?.accepted_terms_at || new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao salvar cadastro: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Cadastro concluído!");
    try { localStorage.setItem("show_welcome", "1"); } catch {}
    navigate("/minha-conta", { replace: true });
  };

  if (loading || !user) return null;

  return (
    <Layout>
      <SEO
        title="Complete seu cadastro | Corporação Assessoria"
        description="Finalize seu cadastro para se inscrever em provas e treinos."
      />
      <section className="section-padding pt-32">
        <div className="container-page max-w-3xl">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
            <div className="flex items-center gap-4 mb-6">
              {avatar ? (
                <img
                  src={avatar}
                  alt={`Foto de ${googleName || "perfil"}`}
                  className="w-14 h-14 rounded-full object-cover border border-border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center font-display text-xl font-bold">
                  {initials}
                </div>
              )}
              <div>
                <h1 className="font-display text-2xl font-bold">Complete seu cadastro</h1>
                <p className="text-sm text-muted-foreground">
                  Seu acesso foi realizado. Precisamos apenas de algumas informações para que você
                  possa se inscrever em provas e treinos.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
                  <ProfileFields emailReadOnly={!!user.email} />
                  <Button type="submit" variant="brand" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? "Salvando..." : "Finalizar cadastro"}
                  </Button>
                </form>
              </FormProvider>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CompletarCadastro;
