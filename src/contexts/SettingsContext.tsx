import { createContext, useContext, ReactNode } from "react";
import { useSiteSettings, type SiteSettings } from "@/hooks/useContent";
import { siteSettings as fallbackSettings } from "@/data/settings";

type SettingsContextValue = SiteSettings & { __loaded: boolean };

const SettingsContext = createContext<SettingsContextValue>({
  ...fallbackSettings,
  __loaded: false,
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { data, isSuccess } = useSiteSettings();
  const value: SettingsContextValue = {
    ...(data ?? fallbackSettings),
    __loaded: isSuccess && !!data,
  };
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

export const useSettingsLoaded = () => useContext(SettingsContext).__loaded;

export const useWhatsappLink = () => {
  const s = useSettings();
  return (message?: string) => {
    const base = `https://wa.me/${s.contact.whatsapp}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  };
};
