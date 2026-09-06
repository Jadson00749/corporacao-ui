import { useEffect, useMemo, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { useForceTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Settings,
  ListChecks,
  Calendar,
  Trophy,
  ShoppingBag,
  Image,
  Camera,
  MessageSquare,
  HelpCircle,
  LayoutDashboard,
  ExternalLink,
  Handshake,
  Users,
  Megaphone,
  Tent,
  Wallet,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganizerOnboardingTour } from "@/components/admin/OrganizerOnboardingTour";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  organizer?: boolean;
  organizerOnly?: boolean;
  organizerLabel?: string;
};

type NavGroupId = "operation" | "organizers" | "content";

type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

const overviewItem: NavItem = {
  to: "/admin",
  label: "Visão geral",
  icon: LayoutDashboard,
  end: true,
  organizer: true,
};

const settingsItem: NavItem = {
  to: "/admin/settings",
  label: "Configurações",
  icon: Settings,
};

/** Itens do Organizer — lista plana, sem grupos administrativos. */
const organizerItems: NavItem[] = [
  overviewItem,
  {
    to: "/admin/event-signups",
    label: "Inscrições provas",
    icon: Trophy,
    organizer: true,
  },
  {
    to: "/admin/events",
    label: "Provas",
    icon: Trophy,
    organizer: true,
    organizerLabel: "Minhas provas",
  },
  {
    to: "/admin/event-structure",
    label: "Locação de Estruturas",
    icon: Tent,
    organizer: true,
    organizerOnly: true,
  },
  {
    to: "/admin/payment-settings",
    label: "Dados de pagamento",
    icon: Wallet,
    organizer: true,
    organizerOnly: true,
  },
];

const adminGroups: NavGroup[] = [
  {
    id: "operation",
    label: "Operação",
    items: [
      { to: "/admin/event-signups", label: "Inscrições provas", icon: Trophy },
      { to: "/admin/events", label: "Provas", icon: Trophy },
      { to: "/admin/trainings", label: "Treinos", icon: Calendar },
    ],
  },
  {
    id: "organizers",
    label: "Organizadores",
    items: [
      { to: "/admin/organizers", label: "Organizadores", icon: Users },
      { to: "/admin/rental-items", label: "Estruturas", icon: Tent },
      { to: "/admin/rental-orders", label: "Pedidos de Locação", icon: ClipboardList },
    ],
  },
  {
    id: "content",
    label: "Conteúdo do site",
    items: [
      { to: "/admin/highlights", label: "Destaques da Home", icon: Megaphone },
      { to: "/admin/plans", label: "Planos", icon: ListChecks },
      { to: "/admin/products", label: "Produtos", icon: ShoppingBag },
      { to: "/admin/gallery", label: "Galeria", icon: Image },
      { to: "/admin/photo-events", label: "Fotos dos eventos", icon: Camera },
      { to: "/admin/partners", label: "Parceiros", icon: Handshake },
      { to: "/admin/testimonials", label: "Depoimentos", icon: MessageSquare },
      { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
    ],
  },
];

const organizerRoutes = new Set([
  "/admin",
  "/admin/",
  "/admin/events",
  "/admin/events/",
  "/admin/event-signups",
  "/admin/event-signups/",
  "/admin/event-structure",
  "/admin/event-structure/",
  "/admin/payment-settings",
  "/admin/payment-settings/",
]);

const pathMatches = (pathname: string, to: string, end?: boolean) => {
  if (end) return pathname === to || pathname === `${to}/`;
  return pathname === to || pathname.startsWith(`${to}/`);
};

const groupHasActive = (group: NavGroup, pathname: string) =>
  group.items.some((it) => pathMatches(pathname, it.to, it.end));

const NavItemLink = ({
  item,
  label,
  compact = false,
}: {
  item: NavItem;
  label: string;
  compact?: boolean;
}) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        compact ? "shrink-0 px-3 py-1.5 text-xs" : "px-3 py-2.5",
        isActive
          ? compact
            ? "bg-brand text-brand-foreground"
            : "bg-brand text-brand-foreground"
          : compact
            ? "bg-secondary text-foreground/70"
            : "text-foreground/80 hover:bg-secondary"
      )
    }
  >
    {!compact && <item.icon className="w-4 h-4 shrink-0" />}
    {label}
  </NavLink>
);

const AdminLayout = () => {
  const { user, isAdmin, isOrganizer, organizerId, roleLoading, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useForceTheme("dark");

  const organizerRouteBlocked = isOrganizer && !isAdmin && !organizerRoutes.has(pathname);

  const [openGroups, setOpenGroups] = useState<Record<NavGroupId, boolean>>({
    operation: true,
    organizers: true,
    content: true,
  });

  // Grupo com rota filha ativa permanece aberto.
  useEffect(() => {
    if (!isAdmin) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of adminGroups) {
        if (groupHasActive(g, pathname) && !next[g.id]) {
          next[g.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, isAdmin]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
    if (!loading && !roleLoading && user && organizerRouteBlocked) navigate("/admin", { replace: true });
  }, [user, loading, roleLoading, navigate, organizerRouteBlocked]);

  const mobileItems = useMemo(() => {
    if (!isAdmin) {
      return organizerItems.map((it) => ({
        ...it,
        label: it.organizerLabel || it.label,
      }));
    }
    return [
      overviewItem,
      ...adminGroups.flatMap((g) => g.items),
      settingsItem,
    ];
  }, [isAdmin]);

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

  if (organizerRouteBlocked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Redirecionando...</div>;
  }

  const toggleGroup = (id: NavGroupId) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

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

        <nav className="flex-1 p-3 overflow-y-auto">
          {isAdmin ? (
            <div className="space-y-4">
              <div className="space-y-0.5">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Visão geral
                </p>
                <NavItemLink item={overviewItem} label={overviewItem.label} />
              </div>

              {adminGroups.map((group) => {
                const open = openGroups[group.id];
                const active = groupHasActive(group, pathname);
                return (
                  <div key={group.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={open}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left",
                        "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70",
                        "hover:text-muted-foreground transition-colors"
                      )}
                    >
                      <span className={cn(active && "text-brand/80")}>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </button>
                    {open && (
                      <div className="space-y-0.5">
                        {group.items.map((it) => (
                          <NavItemLink key={it.to} item={it} label={it.label} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {organizerItems.map((it) => (
                <NavItemLink key={it.to} item={it} label={it.organizerLabel || it.label} />
              ))}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          {isAdmin && (
            <>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Sistema
              </p>
              <NavItemLink item={settingsItem} label={settingsItem.label} />
            </>
          )}
          <Button asChild variant="outline" size="sm" className="w-full justify-start mt-1">
            <Link to="/" target="_blank">
              <ExternalLink className="w-4 h-4" /> Ver site
            </Link>
          </Button>
          <Button
            onClick={() => signOut().then(() => navigate("/auth"))}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">
        <div className="md:hidden border-b border-border p-3 flex gap-2 overflow-x-auto bg-card">
          {mobileItems.map((it) => (
            <NavItemLink key={it.to} item={it} label={it.label} compact />
          ))}
        </div>
        <div className="p-6 md:p-10 max-w-7xl w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
