/**
 * UX de sessão para confirmação de presença em treinos.
 * NÃO é fonte de verdade permanente — só sessionStorage.
 */

export const trainingPresenceSessionKey = (trainingId: string) =>
  `training_presence_confirmed:${trainingId}`;

const legacyIdentityKey = (trainingId: string, identity: string) =>
  `training_presence_ok:${trainingId}:${identity}`;

export const isTrainingPresenceConfirmedInSession = (
  trainingId: string,
  identity?: string | null,
): boolean => {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (sessionStorage.getItem(trainingPresenceSessionKey(trainingId)) === "1") return true;
    // Migra chave legada (por identidade) → chave por treino, se existir nesta sessão.
    if (identity && sessionStorage.getItem(legacyIdentityKey(trainingId, identity)) === "1") {
      markTrainingPresenceConfirmedInSession(trainingId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const markTrainingPresenceConfirmedInSession = (trainingId: string) => {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(trainingPresenceSessionKey(trainingId), "1");
  } catch {
    /* ignore */
  }
};
