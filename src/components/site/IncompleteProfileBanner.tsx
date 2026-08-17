import { Link, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { isProfileComplete } from "@/lib/profileComplete";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Aviso discreto exibido enquanto o perfil estiver incompleto.
 * Não bloqueia navegação e some sozinho quando o cadastro é concluído.
 */
export const IncompleteProfileBanner = ({ className = "" }: { className?: string }) => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { data: profile, isLoading } = useProfile();

  if (loading || !user || isLoading) return null;
  if (isProfileComplete(profile)) return null;
  if (pathname.startsWith("/completar-cadastro")) return null;

  return (
    <div className={"border-brand/25 bg-brand/10 " + className}>
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <AlertCircle className="w-4 h-4 text-brand shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Complete seu cadastro</p>
          <p className="text-xs text-muted-foreground leading-tight">
            Complete seus dados para aproveitar todos os recursos da Corporação.
          </p>
        </div>
        <Button asChild size="sm" variant="brand" className="shrink-0">
          <Link to="/completar-cadastro">Completar cadastro</Link>
        </Button>
      </div>
    </div>
  );
};
