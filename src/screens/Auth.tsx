import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "@/lib/router-compat";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { SEO } from "@/components/site/SEO";
import { ProfileFields } from "@/components/account/ProfileFields";
import { signupSchema, SignupValues } from "@/lib/profileSchema";
import { onlyDigits } from "@/lib/cpf";

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "";
  const { user, isAdmin, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      const dest = redirectTo || (isAdmin ? "/admin" : "/minha-conta");
      navigate(dest, { replace: true });
    }
  }, [user, isAdmin, loading, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo!");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <SEO title="Entrar ou criar conta | Corporação Assessoria" description="Acesse sua conta para se inscrever em corridas." />
      <div className="w-full max-w-2xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-brand mb-6 inline-block">
          ← Voltar ao site
        </Link>
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
          <h1 className="font-display text-2xl font-bold mb-1">Sua conta</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Faça login ou crie sua conta para se inscrever em corridas e treinos.
          </p>

          <Tabs defaultValue={redirectTo ? "signup" : "login"}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
                </div>
                <Button type="submit" variant="brand" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) {
                      toast.error("Digite seu e-mail acima para recuperar a senha.");
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(error.message);
                    else toast.success("Link de recuperação enviado para seu e-mail!");
                  }}
                  className="text-sm text-muted-foreground hover:text-brand underline w-full text-center"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <SignupForm onDone={() => {
                const dest = redirectTo || "/minha-conta";
                navigate(dest, { replace: true });
              }} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const SignupForm = ({ onDone }: { onDone: () => void }) => {
  const [submitting, setSubmitting] = useState(false);
  const methods = useForm<SignupValues>({
    resolver: zodResolver(signupSchema) as any,
    defaultValues: {
      full_name: "", cpf: "", birth_date: "", gender: "", phone: "", whatsapp: "",
      email: "", password: "", cep: "", street: "", number: "", complement: "",
      neighborhood: "", city: "", state: "", team_name: "",
      accepts_marketing: false, accepted_terms: false as any,
    },
  });

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: `${window.location.origin}/minha-conta` },
    });

    if (authError) {
      toast.error(authError.message);
      setSubmitting(false);
      return;
    }

    const userId = authData.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: userId,
        email: values.email,
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
        accepted_terms_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (profileError) {
        toast.error("Conta criada, mas erro ao salvar perfil: " + profileError.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    toast.success("Conta criada com sucesso!");
    try { localStorage.setItem("show_welcome", "1"); } catch {}
    onDone();
  };

  const termsErr = (methods.formState.errors as any).accepted_terms?.message as string | undefined;

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground/80">
          Para se inscrever em corridas, preencha o formulário abaixo. Os campos com <span className="text-destructive">*</span> são obrigatórios.
        </div>

        <ProfileFields showPassword />

        <div className="pt-4 border-t border-border">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" {...methods.register("accepted_terms" as any)} className="mt-1" />
            <span>
              Estou de acordo com as políticas de segurança e privacidade. <span className="text-destructive">*</span>
            </span>
          </label>
          {termsErr && <p className="text-xs text-destructive mt-1">{termsErr}</p>}
        </div>

        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Criando conta..." : "Criar minha conta"}
        </Button>
      </form>
    </FormProvider>
  );
};

export default Auth;
