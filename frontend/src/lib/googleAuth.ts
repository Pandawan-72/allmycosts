// Google Sign-In helper — version sans Emergent.
// ✅ Fix : force le sélecteur de compte à chaque connexion
import { Platform } from "react-native";

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

let configured = false;
let GoogleSignin: any | null = null;

export function isGoogleNativeSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function loadGoogleSignin(): Promise<any | null> {
  if (!isGoogleNativeSupported()) return null;
  if (GoogleSignin) return GoogleSignin;
  try {
    const mod = await import("@react-native-google-signin/google-signin");
    GoogleSignin = mod.GoogleSignin || (mod as any).default?.GoogleSignin;
    return GoogleSignin;
  } catch (e) {
    console.warn("[GoogleAuth] Failed to load native SDK", e);
    return null;
  }
}

export async function configureGoogleSignin() {
  if (configured) return;
  const GS = await loadGoogleSignin();
  if (!GS) return;
  try {
    GS.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      offlineAccess: false,
    });
    configured = true;
  } catch (e) {
    console.warn("[GoogleAuth] configure failed", e);
  }
}

export async function nativeGoogleSignIn(): Promise<string | null> {
  const GS = await loadGoogleSignin();
  if (!GS) throw new Error("Google Sign-In SDK not available on this platform.");
  await configureGoogleSignin();
  try {
    // ✅ Se déconnecter d'abord pour forcer le sélecteur de compte
    try {
      await GS.signOut();
      await GS.revokeAccess?.();
    } catch {
      // Ignorer si pas encore connecté
    }

    await GS.hasPlayServices?.({ showPlayServicesUpdateDialog: true });
    const result = await GS.signIn();
    if (result && result.type === "cancelled") return null;
    const data = result?.data ?? result;
    const idToken = data?.idToken || data?.user?.idToken || null;
    if (!idToken) {
      const tokens = await GS.getTokens?.();
      return tokens?.idToken || null;
    }
    return idToken;
  } catch (e: any) {
    const code = e?.code;
    if (code === "SIGN_IN_CANCELLED" || code === "12501" || code === "-5") return null;
    throw e;
  }
}

export async function nativeGoogleSignOut() {
  const GS = await loadGoogleSignin();
  if (!GS) return;
  try {
    await GS.signOut();
    try { await GS.revokeAccess?.(); } catch {}
  } catch {}
}

export async function emergentWebGoogleSignIn(): Promise<string | null> {
  console.warn("[GoogleAuth] emergentWebGoogleSignIn n'est plus supporté.");
  return null;
}
