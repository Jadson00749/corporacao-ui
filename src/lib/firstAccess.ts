/**
 * Chaves e eventos de primeiro acesso.
 * Ordem: completar cadastro (página) → Welcome → tour da conta → coachmark das abas.
 * Nunca dois overlays empilhados.
 */

export const WELCOME_FLAG = "show_welcome";
export const ACCOUNT_TOUR_KEY = "corp_account_tour_v1";
export const ATHLETE_TABS_TOUR_KEY = "athlete_area_onboarding_v1";
export const WELCOME_CLOSED_EVENT = "corp:welcome-closed";
export const ACCOUNT_TOUR_DONE_EVENT = "corp:account-tour-done";

export const isWelcomePending = () => {
  try {
    return localStorage.getItem(WELCOME_FLAG) === "1";
  } catch {
    return false;
  }
};

export const isAccountTourDone = () => {
  try {
    return !!localStorage.getItem(ACCOUNT_TOUR_KEY);
  } catch {
    return true;
  }
};

export const isAthleteTabsTourDone = () => {
  try {
    return localStorage.getItem(ATHLETE_TABS_TOUR_KEY) === "completed";
  } catch {
    return true;
  }
};

export const notifyWelcomeClosed = () => {
  try {
    localStorage.removeItem(WELCOME_FLAG);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WELCOME_CLOSED_EVENT));
  }
};

export const markAccountTourDone = () => {
  try {
    localStorage.setItem(ACCOUNT_TOUR_KEY, "1");
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCOUNT_TOUR_DONE_EVENT));
  }
};
