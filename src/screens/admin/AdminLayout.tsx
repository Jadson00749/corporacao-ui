import { useEffect } from "react";
import { NavLink, Outlet, useNavigate, Link } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { useForceTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, ListChecks, Calendar, Trophy, ShoppingBag, Image, Camera, MessageSquare, HelpCircle, LayoutDashboard, ExternalLink, Handshake, Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizerOnboardingTour } from "@/components/admin/OrganizerOnboardingTour";

const items = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true, organizer: true },
  { to: "/admin/settings", label: "Configurações", icon: Settings },
  { to: "/admin/organizers", label: "Organizadores", icon: Users },
  { to: "/admin/highlights", label: "Destaques da Home", icon: Megaphone },
  { to: "/admin/plans", label: "Planos", icon: ListChecks },
  { to: "/admin/trainings", label: "Treinos", icon: Calendar },
  
  { to: "/admin/event-signups", label: "Inscrições provas", icon: Trophy, organizer: true },
  { to: "/admin/events", label: "Provas", icon: Trophy, organizer: true, organizerLabel: "Minhas provas" },
  { to: "/admin/products", label: "Produtos", icon: ShoppingBag },
  { to: "/admin/gallery", label: "Galeria", icon: Image },
  { to: "/admin/photo-events", label: "Fotos dos eventos", icon: Camera },
  { to: "/admin/partners", label: "Parceiros", icon: Handshake },
  { to: "/admin/testimonials", label: "Depoimentos", icon: MessageSquare },
  { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
];

const AdminLayout = () => {
  const { user, isAdmin, isOrganizer, organizerId, roleLoading, loading, signOut } = useAuth();
  const navigate = useNavigate();
  useForceTheme("dark");

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  if (loading || (user && roleLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (user && !isAdmin && !isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold">Acesso negado</h1>
          <p className="text-muted-foreground mt-2">
            Sua conta ({user.email}) não tem permissão de administrador. Solicite acesso ao responsável.
          </p>
          <Button onClick={() => signOut().then(() => navigate("/auth"))} variant="outline" className="mt-6">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (user && isOrganizer && !organizerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold">Organização não encontrada</h1>
          <p className="text-muted-foreground mt-2">
            Sua conta ({user.email}) tem perfil de organizador, mas não está vinculada a uma organização ativa.
          </p>
          <Button onClick={() => signOut().then(() => navigate("/auth"))} variant="outline" className="mt-6">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const visibleItems = isAdmin ? items : items.filter((it) => it.organizer);
  const labelOf = (it: any) => (!isAdmin && it.organizerLabel ? it.organizerLabel : it.label);


  return (
    <div className="min-h-screen bg-background flex">
      {isOrganizer && !isAdmin && user && (
        <OrganizerOnboardingTour storageKey={`organizer_tour_v1_${user.id}`} />
      )}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
              <span className="font-display font-bold text-brand-foreground text-sm">C</span>
            </div>
            <span className="font-display font-bold">{isAdmin ? "Admin" : "Organizador"}</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-brand text-brand-foreground" : "text-foreground/80 hover:bg-secondary"
                )
              }
            >
              <it.icon className="w-4 h-4" />
              {labelOf(it)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link to="/" target="_blank"><ExternalLink className="w-4 h-4" /> Ver site</Link>
          </Button>
          <Button onClick={() => signOut().then(() => navigate("/auth"))} variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">
        <div className="md:hidden border-b border-border p-3 flex gap-2 overflow-x-auto bg-card">
          {visibleItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium",
                  isActive ? "bg-brand text-brand-foreground" : "bg-secondary text-foreground/70"
                )
              }
            >
              {labelOf(it)}
            </NavLink>
          ))}
        </div>
        <div className="p-6 md:p-10 max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
