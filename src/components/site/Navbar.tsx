import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "@/lib/router-compat";
import { Menu, X, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings, useWhatsappLink } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/site/LogoMark";
import { ThemeToggle } from "@/components/site/ThemeToggle";

const navItems = [
  { to: "/", label: "Início" },
  { to: "/planos", label: "Planos" },
  { to: "/treinos", label: "Treinos" },
  { to: "/provas", label: "Provas" },
  { to: "/produtos", label: "Produtos" },
  
  { to: "/fotos", label: "Fotos" },
  { to: "/sobre", label: "Quem somos" },
  { to: "/contato", label: "Contato" },
];

export const Navbar = () => {
  const siteSettings = useSettings();
  const whatsappLink = useWhatsappLink();
  const { user, isAdmin, isOrganizer } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  // Trava o scroll do body quando o menu mobile está aberto
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled || open
          ? "bg-background/70 backdrop-blur-xl backdrop-saturate-150 border-b border-border/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]"
          : "bg-gradient-to-b from-black/40 via-black/10 to-transparent backdrop-blur-[2px]"
      )}
    >
      <div className="container-page flex h-[52px] md:h-[88px] items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 md:gap-3 group" aria-label={siteSettings.brand.name}>
          <LogoMark
            className="w-8 h-8 md:w-11 md:h-11 shrink-0"
            alt={`${siteSettings.brand.name} logo`}
          />
          <span className={cn(
            "font-display font-semibold md:font-bold text-[15px] md:text-lg tracking-tight leading-tight transition-colors",
            scrolled || open ? "text-foreground" : "text-white"
          )}>
            {siteSettings.brand.name}
          </span>
        </Link>


        <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group relative px-3.5 py-2.5 text-[13px] font-medium tracking-[0.01em] transition-colors duration-300",
                  scrolled || open
                    ? isActive
                      ? "text-brand"
                      : "text-foreground/65 hover:text-foreground"
                    : isActive
                      ? "text-brand-glow"
                      : "text-white/75 hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-3.5 right-3.5 -bottom-0.5 h-px origin-left transition-transform duration-500 ease-out",
                      isActive ? "scale-x-100 bg-brand" : "scale-x-0 group-hover:scale-x-100 bg-current/60"
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2.5 xl:gap-3">
          <ThemeToggle onDark={!scrolled && !open} />
          {(isAdmin || isOrganizer) && (
            <Button asChild variant="ghost" size="sm" className={cn("rounded-full", !scrolled && !open && "text-white hover:text-white hover:bg-white/10")}>
              <Link to="/admin">
                <Shield className="w-4 h-4" /> {isAdmin ? "Admin" : "Painel"}
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className={cn("rounded-full", !scrolled && !open && "text-white hover:text-white hover:bg-white/10")}>
            <Link to={user ? "/minha-conta" : "/auth"}>
              <User className="w-4 h-4" /> {user ? "Minha conta" : "Entrar"}
            </Link>
          </Button>
          <Button
            asChild
            variant="brand"
            size="sm"
            className="rounded-full h-10 px-5 text-[13px] font-semibold tracking-tight shadow-[0_8px_24px_-10px_hsl(var(--brand)/0.6)] hover:shadow-[0_12px_30px_-10px_hsl(var(--brand)/0.8)] hover:-translate-y-px transition-all duration-300"
          >
            <a href={whatsappLink("Olá! Quero conhecer a Corporação Assessoria Esportiva.")} target="_blank" rel="noreferrer">
              Fale conosco
            </a>
          </Button>
        </div>


        <div className="lg:hidden flex items-center gap-1">
          <div className="hidden md:flex"><ThemeToggle onDark={!scrolled && !open} /></div>
          <button
            className={cn(
              "min-h-10 min-w-10 md:min-h-11 md:min-w-11 inline-flex items-center justify-center rounded-md transition-colors",
              scrolled || open ? "text-foreground" : "text-white"
            )}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5 md:w-6 md:h-6" /> : <Menu className="w-5 h-5 md:w-6 md:h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="lg:hidden bg-background border-t border-border animate-fade-in overflow-y-auto overscroll-contain max-h-[calc(100dvh-52px)] md:max-h-[calc(100dvh-88px)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <nav className="container-page py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "min-h-12 flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors",
                    isActive
                      ? "text-brand bg-secondary"
                      : "text-foreground hover:bg-secondary"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 md:hidden">
              <span className="text-sm text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <Button asChild variant="outline" size="lg" className="mt-3">
              <Link to={user ? "/minha-conta" : "/auth"}>
                <User className="w-4 h-4" /> {user ? "Minha conta" : "Entrar / Criar conta"}
              </Link>
            </Button>
            {(isAdmin || isOrganizer) && (
              <Button asChild variant="outline" size="lg" className="mt-2">
                <Link to="/admin">
                  <Shield className="w-4 h-4" /> {isAdmin ? "Painel admin" : "Painel do organizador"}
                </Link>
              </Button>
            )}
            <Button asChild variant="brand" size="lg" className="mt-2">
              <a href={whatsappLink("Olá! Quero conhecer a Corporação Assessoria Esportiva.")} target="_blank" rel="noreferrer">
                Fale no WhatsApp
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};
