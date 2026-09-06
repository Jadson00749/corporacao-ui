import { Footprints } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

/**
 * CTA flutuante WhatsApp.
 * Mobile: ícone compacto, afastado do rodapé/safe-area para não cobrir CTAs dos cards.
 * Desktop: botão com texto, mais próximo do canto.
 */
export const FloatingWhatsApp = () => {
  const whatsappLink = useWhatsappLink();
  return (
    <a
      href={whatsappLink("Olá! Vim pelo site da Corporação Assessoria Esportiva.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Fale com nossa equipe no WhatsApp"
      className={cn(
        "group fixed z-40 flex items-center justify-center rounded-full bg-success/90 text-white",
        "shadow-[0_10px_30px_-10px_hsl(var(--success)/0.55)] backdrop-blur-md",
        "transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_36px_-10px_hsl(var(--success)/0.75)] active:scale-95",
        // Mobile: ícone; desktop: pill com texto
        "h-11 w-11 md:h-12 md:w-auto md:gap-2 md:pl-3 md:pr-4",
        // Safe-area + folga extra no mobile para não cobrir CTAs empilhados
        "bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] right-[calc(env(safe-area-inset-right,0px)+1rem)]",
        "md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] md:right-[calc(env(safe-area-inset-right,0px)+1.5rem)]"
      )}
    >
      <Footprints className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-12" />
      <span className="hidden text-[13px] font-semibold tracking-tight md:inline">Fale com nossa equipe</span>
    </a>
  );
};
