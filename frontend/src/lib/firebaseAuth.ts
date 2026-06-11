import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

function getFirebaseAuth() {
  const app = getFirebaseApp();
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export { onAuthStateChanged, getFirebaseAuth };

export function firebaseUserToAuthUser(fbUser: any) {
  return {
    user_id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split("@")[0] || "Utilisateur",
    email: fbUser.email || "",
    provider: fbUser.providerData[0]?.providerId || "email",
    picture: fbUser.photoURL || null,
    pro: {
      plan: "free" as const,
      is_pro: false,
      trial_end: null,
      current_period_end: null,
      has_used_trial: false,
    },
  };
}

export async function firebaseLogin(email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return firebaseUserToAuthUser(cred.user);
}

export async function firebaseRegister(name: string, email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return firebaseUserToAuthUser({ ...cred.user, displayName: name });
}

export async function firebaseGoogleSignIn(idToken: string) {
  const auth = getFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  return firebaseUserToAuthUser(cred.user);
}

export async function firebaseSignOut() {
  const auth = getFirebaseAuth();
  await signOut(auth);
}
