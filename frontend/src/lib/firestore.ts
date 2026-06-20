// Firestore — utilisé uniquement pour stocker l'horodatage de début du trial Pro,
// lié au compte (uid), afin qu'une désinstallation/réinstallation de l'app
// ne permette pas de relancer indéfiniment un nouvel essai gratuit.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY        || "",
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN    || "",
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID     || "",
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID         || "",
};

function getFirebaseApp() {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

function db() {
  return getFirestore(getFirebaseApp());
}

// Lit le timestamp de début de trial stocké côté serveur pour cet utilisateur.
// Retourne null si l'utilisateur n'a jamais démarré de trial.
export async function getRemoteTrialStart(uid: string): Promise<number | null> {
  const ref = doc(db(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const ts = data?.trial_start as Timestamp | undefined;
  return ts ? ts.toMillis() : null;
}

// Démarre le trial côté serveur UNIQUEMENT s'il n'existe pas déjà
// (ne réinitialise jamais un trial existant, même expiré).
// Retourne le timestamp effectif (existant ou nouvellement créé).
export async function startRemoteTrialIfNeeded(uid: string): Promise<number> {
  const ref = doc(db(), "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.trial_start) {
    return (snap.data().trial_start as Timestamp).toMillis();
  }
  const now = Date.now();
  await setDoc(ref, { trial_start: Timestamp.fromMillis(now) }, { merge: true });
  return now;
}
