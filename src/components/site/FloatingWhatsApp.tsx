import { useEffect, useState } from "react";
import { useWhatsappLink } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

/** Ícone oficial WhatsApp (SVG vetorial leve — sem asset/PNG). */
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 6.165L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const meaningfullyVisible = (entry: IntersectionObserverEntry) => {
  if (!entry.isIntersecting) return false;
  const { width, height } = entry.intersectionRect;
  // Evita 1px na borda da viewport
  return width >= 24 && height >= 20;
};

/**
 * FAB WhatsApp.
 * Mobile: esconde enquanto qualquer `[data-whatsapp-cta]` estiver visível (Set).
 * Desktop: sempre visível.
 */
export const FloatingWhatsApp = () => {
  const whatsappLink = useWhatsappLink();
  const [ready, setReady] = useState(false);
  const [hideForCtaMobile, setHideForCtaMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const visibleCtas = new Set<Element>();

    const sync = () => {
      if (mq.matches) {
        setHideForCtaMobile(false);
        return;
      }
      setHideForCtaMobile(visibleCtas.size > 0);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (meaningfullyVisible(entry)) {
            visibleCtas.add(entry.target);
          } else {
            visibleCtas.delete(entry.target);
          }
        }
        sync();
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        // Margem interna leve: não conta CTA só “raspando” a borda
        rootMargin: "-12px 0px -12px 0px",
      }
    );

    const observed = new WeakSet<Element>();
    let observedList: Element[] = [];

    const refresh = () => {
      const nodes = Array.from(document.querySelectorAll("[data-whatsapp-cta]"));
      const next = new Set(nodes);

      for (const el of observedList) {
        if (!next.has(el) || !el.isConnected) {
          io.unobserve(el);
          visibleCtas.delete(el);
        }
      }

      observedList = nodes;
      for (const el of nodes) {
        if (!observed.has(el)) {
          observed.add(el);
        }
        io.observe(el);
      }
      sync();
    };

    refresh();
    setReady(true);

    const mo = new MutationObserver(() => refresh());
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-whatsapp-cta"],
    });

    const onMq = () => sync();
    mq.addEventListener?.("change", onMq);

    return () => {
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  const hideMobile = !ready || hideForCtaMobile;

  return (
    <a
      href={whatsappLink("Olá! Vim pelo site da Corporação Assessoria Esportiva.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar pelo WhatsApp"
      aria-hidden={hideMobile || undefined}
      tabIndex={hideMobile ? -1 : undefined}
      className={cn(
        "group fixed z-40 flex items-center justify-center rounded-full bg-[#25D366] text-white",
        "shadow-[0_10px_28px_-10px_rgba(37,211,102,0.65)]",
        "transition-[opacity,transform,box-shadow] duration-300",
        "hover:scale-[1.03] hover:shadow-[0_14px_34px_-10px_rgba(37,211,102,0.8)] active:scale-95",
        "h-14 w-14 md:h-12 md:w-auto md:gap-2 md:pl-3.5 md:pr-4",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] right-[calc(env(safe-area-inset-right,0px)+0.85rem)]",
        "md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] md:right-[calc(env(safe-area-inset-right,0px)+1.5rem)]",
        hideMobile && "max-md:pointer-events-none max-md:opacity-0 max-md:scale-90"
      )}
    >
      <WhatsAppIcon className="h-[26px] w-[26px] md:h-5 md:w-5" />
      <span className="hidden text-[13px] font-semibold tracking-tight md:inline">
        Fale com nossa equipe
      </span>
    </a>
  );
};
