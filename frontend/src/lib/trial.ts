// Gestion du trial 15 jours, avec Firestore comme source de vérité (liée
// au compte/uid) et AsyncStorage comme cache local pour un accès rapide et
// un fonctionnement hors-ligne. Empêche un utilisateur de relancer un
// nouveau trial en désinstallant/réinstallant l'app : le timestamp de
// départ du trial est attaché à son compte côté serveur, pas à l'appareil.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRemoteTrialStart, startRemoteTrialIfNeeded } from "@/src/lib/firestore";

const TRIAL_KEY = "amc.trial_start";
const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000; // 15 jours
const TRIAL_WARNING_DAY = 13; // Rappel au 13ème jour (2 jours avant la fin)

// Démarre le trial si ce n'est pas déjà fait (appelé au login), en
// consultant Firestore en priorité. Met à jour le cache local ensuite.
export async function startTrialIfNeeded(uid?: string): Promise<void> {
  try {
    if (uid) {
      const start = await startRemoteTrialIfNeeded(uid);
      await AsyncStorage.setItem(TRIAL_KEY, String(start));
      return;
    }
    // Repli local si aucun uid n'est fourni (ne devrait pas arriver en usage normal).
    const existing = await AsyncStorage.getItem(TRIAL_KEY);
    if (!existing) {
      await AsyncStorage.setItem(TRIAL_KEY, String(Date.now()));
    }
  } catch (e) {
    console.warn("[trial] startTrialIfNeeded failed", e);
    // En cas d'échec réseau, on utilise/initialise le cache local pour ne
    // pas bloquer l'utilisateur — la prochaine connexion resynchronisera.
    const existing = await AsyncStorage.getItem(TRIAL_KEY);
    if (!existing) {
      await AsyncStorage.setItem(TRIAL_KEY, String(Date.now()));
    }
  }
}

// Synchronise le cache local avec Firestore (à appeler après login, avant
// toute lecture du trial, pour éviter de se fier à un cache périmé après
// une réinstallation).
export async function syncTrialFromRemote(uid: string): Promise<void> {
  try {
    const remoteStart = await getRemoteTrialStart(uid);
    if (remoteStart) {
      await AsyncStorage.setItem(TRIAL_KEY, String(remoteStart));
    }
  } catch (e) {
    console.warn("[trial] syncTrialFromRemote failed", e);
  }
}

// Retourne le timestamp de début du trial, ou null si pas encore démarré
export async function getTrialStart(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_KEY);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

// Retourne true si le trial est encore actif
export async function isTrialActive(): Promise<boolean> {
  const start = await getTrialStart();
  if (!start) return false;
  return Date.now() - start < TRIAL_DURATION_MS;
}

// Retourne les heures restantes du trial (0 si expiré)
export async function getTrialHoursLeft(): Promise<number> {
  const start = await getTrialStart();
  if (!start) return 0;
  const elapsed = Date.now() - start;
  const remaining = TRIAL_DURATION_MS - elapsed;
  return Math.max(0, Math.ceil(remaining / 3600000));
}

// Retourne true si le trial a été utilisé (même expiré)
export async function hasUsedTrial(): Promise<boolean> {
  const start = await getTrialStart();
  return start !== null;
}

// Retourne true si on est au jour 13 (2 jours avant la fin)
export async function isTrialEndingSoon(): Promise<boolean> {
  const start = await getTrialStart();
  if (!start) return false;
  const daysElapsed = (Date.now() - start) / (24 * 60 * 60 * 1000);
  return daysElapsed >= TRIAL_WARNING_DAY && daysElapsed < 15;
}
