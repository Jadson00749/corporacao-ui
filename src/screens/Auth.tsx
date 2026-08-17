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
import { LogoMark } from "@/components/site/LogoMark";
import { Eye, EyeOff } from "lucide-react";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GoogleSignIn = ({ redirectTo }: { redirectTo: string }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = async () => {
    try {
      setSubmitting(true);
      if (redirectTo) {
        try { localStorage.setItem("auth_redirect", redirectTo); } catch {}
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        toast.error("Não foi possível iniciar o login com Google: " + error.message);
        setSubmitting(false);
      }
      // em caso de sucesso o navegador é redirecionado ao Google
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha inesperada no login com Google."
      );
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full h-12 rounded-xl border-2 border-border bg-card hover:bg-accent hover:border-[hsl(121_100%_59%)]/40 hover:shadow-[0_0_20px_-4px_hsl(121_100%_59%/_0.22)] transition-all duration-300 text-base font-medium"
      size="lg"
      onClick={handleGoogle}
      disabled={submitting}
    >
      <GoogleIcon />
      Entrar com Google
    </Button>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirect") || "";
  const { user, isAdmin, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/40 via-background to-background flex items-center justify-center p-4 py-12">
      <SEO title="Entrar ou criar conta | Corporação Assessoria" description="Acesse sua conta para se inscrever em corridas." />
      <div className="w-full max-w-lg">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand mb-6 transition-colors"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border group-hover:border-brand/40 transition-colors">
            ←
          </span>
          Voltar ao site
        </Link>

        <div className="bg-card border border-border rounded-3xl p-7 sm:p-10 shadow-[0_16px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-sm relative overflow-hidden">
          {/* subtle top brand accent */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(121_100%_59%)]/80 via-[hsl(121_100%_59%)]/40 to-transparent" />

          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[hsl(121_100%_59%)]/10 blur-2xl" />
              <LogoMark className="relative h-16 w-16 sm:h-20 sm:w-20" interactive />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-5">
              Acesse sua conta
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-sm leading-relaxed">
              Entre para se inscrever em provas e treinos, acompanhar suas inscrições e gerenciar seus dados.
            </p>
          </div>

          <Tabs defaultValue={redirectTo ? "signup" : "login"} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-8 p-1.5 h-auto bg-muted/70 rounded-2xl border border-border">
              <TabsTrigger
                value="login"
                className="rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border/60 transition-all"
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border/60 transition-all"
              >
                Criar conta
              </TabsTrigger>
            </TabsList>

            <GoogleSignIn redirectTo={redirectTo} />

            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground uppercase tracking-wider font-medium">ou continue com e-mail</span>
              </div>
            </div>

            <TabsContent value="login" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-border/70 bg-background/50 focus-visible:ring-[hsl(121_100%_59%)]/40"
                    placeholder="seu@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-xl border-border/70 bg-background/50 focus-visible:ring-[hsl(121_100%_59%)]/40 pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(121_100%_59%)]/40 rounded-md p-1"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="brand"
                  className="w-full h-12 rounded-xl text-base font-semibold shadow-[0_0_24px_-8px_hsl(121_100%_59%/_0.4)] hover:shadow-[0_0_30px_-6px_hsl(121_100%_59%/_0.55)] transition-shadow duration-300"
                  size="lg"
                  disabled={submitting}
                >
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
                  className="text-sm text-muted-foreground hover:text-brand hover:underline underline-offset-4 w-full text-center transition-colors"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SignupForm onDone={() => {
                const dest = redirectTo || "/minha-conta";
                navigate(dest, { replace: true });
              }} />
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao entrar, você concorda com nossas políticas de privacidade e termos de uso.
        </p>
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
        <div className="bg-secondary/50 rounded-xl p-4 text-sm text-foreground/80 border border-border/40">
          Para se inscrever em corridas, preencha o formulário abaixo. Os campos com <span className="text-destructive">*</span> são obrigatórios.
        </div>

        <ProfileFields showPassword />

        <div className="pt-4 border-t border-border/70">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...methods.register("accepted_terms" as any)} className="mt-1" />
            <span>
              Estou de acordo com as políticas de segurança e privacidade. <span className="text-destructive">*</span>
            </span>
          </label>
          {termsErr && <p className="text-xs text-destructive mt-1">{termsErr}</p>}
        </div>

        <Button type="submit" variant="brand" size="lg" className="w-full h-12 rounded-xl text-base font-semibold shadow-[0_0_24px_-8px_hsl(121_100%_59%/_0.4)] hover:shadow-[0_0_30px_-6px_hsl(121_100%_59%/_0.55)] transition-shadow duration-300" disabled={submitting}>
          {submitting ? "Criando conta..." : "Criar minha conta"}
        </Button>
      </form>
    </FormProvider>
  );
};

export default Auth;
