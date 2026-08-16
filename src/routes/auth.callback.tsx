import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription = url.searchParams.get("error_description");

      if (errorDescription) {
        setError(decodeURIComponent(errorDescription));
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setError("Não foi possível autenticar com o Google.");
        return;
      }

      // Cria um perfil mínimo se for o primeiro login.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "";

        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            user_id: user.id,
            email: user.email || "",
            full_name: fullName,
            cpf: "",
            birth_date: null,
            gender: "",
            phone: "",
            whatsapp: "",
            cep: "",
            street: "",
            number: "",
            complement: "",
            neighborhood: "",
            city: "",
            state: "",
            team_name: "",
            accepts_marketing: false,
            accepted_terms_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (profileError) {
          setError("Erro ao criar perfil: " + profileError.message);
          return;
        }
      }

      const redirect = localStorage.getItem("auth_redirect") || "/minha-conta";
      try { localStorage.removeItem("auth_redirect"); } catch {}
      navigate(redirect, { replace: true });
    };

    void handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-6 max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-destructive mb-2">
            Erro no login
          </h1>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/auth", { replace: true })}
            className="text-brand underline text-sm"
          >
            Voltar para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand mb-3" />
      <p className="text-muted-foreground text-sm">Conectando com sua conta...</p>
    </div>
  );
}
