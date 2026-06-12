// AuthContext — Firebase Auth + trial 72h local + compte de test dev.
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import {
  firebaseLogin,
  firebaseRegister,
  firebaseGoogleSignIn,
  firebaseSignOut,
  firebaseUserToAuthUser,
  getFirebaseAuth,
  onAuthStateChanged,
} from "@/src/lib/firebaseAuth";
import {
  startTrialIfNeeded,
  isTrialActive,
  getTrialHoursLeft,
  hasUsedTrial,
} from "@/src/lib/trial";

// ✅ Compte de test local (défini dans .env, jamais exposé sur GitHub)
const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL || "";
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD || "";

export type AuthUser = {
  user_id: string;
  name: string;
  email: string;
  provider: string;
  picture?: string | null;
  pro: {
    plan: "free" | "trialing" | "active_monthly" | "active_yearly" | "lifetime" | "expired";
    is_pro: boolean;
    trial_end?: string | null;
    current_period_end?: string | null;
    has_used_trial: boolean;
  };
};

// ✅ Utilisateur de test avec accès Pro complet
const DEV_USER: AuthUser = {
  user_id: "dev_local_user",
  name: "Dev User",
  email: DEV_EMAIL || "dev@local.test",
  provider: "dev",
  picture: null,
  pro: {
    plan: "lifetime",
    is_pro: true,
    trial_end: null,
    current_period_end: null,
    has_used_trial: true,
  },
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogleSession: (sessionId: string) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// Enrichit un AuthUser de base avec les infos du trial local
async function enrichWithTrial(baseUser: ReturnType<typeof firebaseUserToAuthUser>): Promise<AuthUser> {
  const trialActive = await isTrialActive();
  const trialUsed = await hasUsedTrial();
  const hoursLeft = await getTrialHoursLeft();

  let plan: AuthUser["pro"]["plan"] = "free";
  let is_pro = false;
  let trial_end: string | null = null;

  if (trialActive) {
    plan = "trialing";
    is_pro = true;
    const trialEndTs = Date.now() + hoursLeft * 3600000;
    trial_end = new Date(trialEndTs).toISOString();
  } else if (trialUsed) {
    plan = "expired";
    is_pro = false;
  }

  return {
    ...baseUser,
    pro: {
      plan,
      is_pro,
      trial_end,
      current_period_end: null,
      has_used_trial: trialUsed,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (fbUser: any) => {
      if (fbUser) {
        const base = firebaseUserToAuthUser(fbUser);
        const enriched = await enrichWithTrial(base);
        setUser(enriched);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // ✅ Compte de test local — bypass Firebase
    if (
      DEV_EMAIL &&
      DEV_PASSWORD &&
      email.toLowerCase().trim() === DEV_EMAIL.toLowerCase().trim() &&
      password === DEV_PASSWORD
    ) {
      setUser(DEV_USER);
      return;
    }

    // Connexion Firebase normale
    const base = await firebaseLogin(email, password);
    await startTrialIfNeeded();
    const enriched = await enrichWithTrial(base);
    setUser(enriched);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const base = await firebaseRegister(name, email, password);
    await startTrialIfNeeded();
    const enriched = await enrichWithTrial(base);
    setUser(enriched);
  }, []);

  const loginWithGoogleSession = useCallback(async (_sessionId: string) => {
    throw new Error("Non supporté. Utilisez la connexion Google native.");
  }, []);

  const loginWithGoogleIdToken = useCallback(async (idToken: string) => {
    const base = await firebaseGoogleSignIn(idToken);
    await startTrialIfNeeded();
    const enriched = await enrichWithTrial(base);
    setUser(enriched);
  }, []);

  const logout = useCallback(async () => {
    // ✅ Si c'est le compte de test, juste vider le state
    if (user?.user_id === "dev_local_user") {
      setUser(null);
      return;
    }
    try {
      const { nativeGoogleSignOut } = await import("@/src/lib/googleAuth");
      await nativeGoogleSignOut();
    } catch {}
    await firebaseSignOut();
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    // ✅ Ne pas rafraîchir le compte de test
    if (user?.user_id === "dev_local_user") return;

    const auth = getFirebaseAuth();
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const base = firebaseUserToAuthUser(fbUser);
    const enriched = await enrichWithTrial(base);
    setUser(enriched);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        loading,
        login,
        register,
        loginWithGoogleSession,
        loginWithGoogleIdToken,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
