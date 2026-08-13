import { Footprints } from "lucide-react";
import { useWhatsappLink } from "@/contexts/SettingsContext";

export const FloatingWhatsApp = () => {
  const whatsappLink = useWhatsappLink();
  return (
    <a
      href={whatsappLink("Olá! Vim pelo site da Corporação Assessoria Esportiva.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Fale com nossa equipe no WhatsApp"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        right: "calc(env(safe-area-inset-right, 0px) + 1.5rem)",
      }}
      className="hidden md:flex group fixed z-40 h-12 items-center gap-2 pl-3 pr-4 rounded-full bg-success/90 backdrop-blur-md text-white shadow-[0_10px_30px_-10px_hsl(var(--success)/0.6)] hover:shadow-[0_14px_36px_-10px_hsl(var(--success)/0.8)] hover:scale-[1.03] active:scale-95 transition-all duration-300"
    >
      <Footprints className="w-5 h-5 transition-transform duration-300 group-hover:-rotate-12" />
      <span className="text-[13px] font-semibold tracking-tight">Fale com nossa equipe</span>
    </a>
  );
};
