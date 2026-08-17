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

      // O client já tem detectSessionInUrl ativo: ele pode consumir o "code"
      // antes daqui. Só trocamos manualmente se ainda não houver sessão.
      let { data: { session } } = await supabase.auth.getSession();

      if (!session && code) {
        const { data: exchanged, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          // Pode ter sido consumido pelo SDK entre as duas chamadas.
          const retry = await supabase.auth.getSession();
          if (!retry.data.session) {
            setError(exchangeError.message);
            return;
          }
          session = retry.data.session;
        } else {
          session = exchanged.session;
        }
      }

      if (!session) {
        // pequena espera para o listener do SDK terminar de hidratar a sessão
        await new Promise((r) => setTimeout(r, 400));
        session = (await supabase.auth.getSession()).data.session;
      }

      const user = session?.user;

      if (!user) {
        setError("Não foi possível autenticar com o Google. Tente novamente.");
        return;
      }

      const redirect = localStorage.getItem("auth_redirect") || "";
      try { localStorage.removeItem("auth_redirect"); } catch {}

      navigate(redirect || "/minha-conta", { replace: true });
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
