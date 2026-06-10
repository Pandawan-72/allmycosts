// Google Sign-In helper. Uses native @react-native-google-signin/google-signin
// on iOS/Android and falls back to Emergent's web OAuth flow on the web preview.
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

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
  if (!GOOGLE_WEB_CLIENT_ID) {
    console.warn("[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID missing");
  }
  try {
    GS.configure({
      // The Web Client ID is what generates an ID token usable for backend
      // verification. Even on Android, the SDK requires the web client ID.
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      offlineAccess: false,
    });
    configured = true;
  } catch (e) {
    console.warn("[GoogleAuth] configure failed", e);
  }
}

/**
 * Native sign-in. Returns the Google ID token on success (string),
 * null if the user cancelled, throws on hard error.
 */
export async function nativeGoogleSignIn(): Promise<string | null> {
  const GS = await loadGoogleSignin();
  if (!GS) throw new Error("Google Sign-In SDK not available on this platform.");
  await configureGoogleSignin();
  try {
    await GS.hasPlayServices?.({ showPlayServicesUpdateDialog: true });
    const result = await GS.signIn();
    // SDK v16+ returns { type: "success"|"cancelled", data: { idToken, user } }
    if (result && result.type === "cancelled") return null;
    const data = result?.data ?? result;
    const idToken = data?.idToken || data?.user?.idToken || null;
    if (!idToken) {
      // Try tokens API as fallback (some SDK versions return only user object)
      const tokens = await GS.getTokens?.();
      return tokens?.idToken || null;
    }
    return idToken;
  } catch (e: any) {
    const code = e?.code;
    // SIGN_IN_CANCELLED = "12501" on Android, "-5" on iOS
    if (code === "SIGN_IN_CANCELLED" || code === "12501" || code === "-5") {
      return null;
    }
    throw e;
  }
}

export async function nativeGoogleSignOut() {
  const GS = await loadGoogleSignin();
  if (!GS) return;
  try {
    // signOut clears the cached session; revokeAccess forces the Google account
    // picker to show again on the next sign-in (so the user can pick another
    // account or the same one).
    await GS.signOut();
    try {
      await GS.revokeAccess?.();
    } catch {
      /* revokeAccess can fail silently when no user is currently signed in. */
    }
  } catch {
    /* noop */
  }
}

/**
 * Web fallback: Emergent OAuth flow returning the session_id.
 * Used only on web platform where the native SDK is unavailable.
 */
export async function emergentWebGoogleSignIn(): Promise<string | null> {
  const redirectUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin + "/"
      : Linking.createURL("auth");
  const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
    redirectUrl,
  )}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.href = authUrl;
    return null; // page will reload after redirect
  }
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type !== "success" || !result.url) return null;
  const url = result.url;
  const hashIdx = url.indexOf("#");
  let params: URLSearchParams | null = null;
  if (hashIdx >= 0) params = new URLSearchParams(url.slice(hashIdx + 1));
  if (!params || !params.get("session_id")) {
    const qIdx = url.indexOf("?");
    if (qIdx >= 0) params = new URLSearchParams(url.slice(qIdx + 1));
  }
  return params?.get("session_id") || null;
}
