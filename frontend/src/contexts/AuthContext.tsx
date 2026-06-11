// AuthContext — Firebase Auth + trial 72h local.
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

  // Si l'utilisateur a un achat lifetime réel (géré par RevenueCat via refreshUser)
  // on ne touche pas à son statut pro. Sinon on calcule depuis le trial local.
  let plan: AuthUser["pro"]["plan"] = "free";
  let is_pro = false;
  let trial_end: string | null = null;

  if (trialActive) {
    plan = "trialing";
    is_pro = true; // trial actif = accès pro complet
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

  // Écoute les changements de session Firebase
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
    const base = await firebaseLogin(email, password);
    await startTrialIfNeeded(); // démarre le trial si premier login
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
    try {
      const { nativeGoogleSignOut } = await import("@/src/lib/googleAuth");
      await nativeGoogleSignOut();
    } catch {}
    await firebaseSignOut();
    setUser(null);
  }, []);

  // refreshUser : re-calcule le statut trial depuis le storage local
  const refreshUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const base = firebaseUserToAuthUser(fbUser);
    const enriched = await enrichWithTrial(base);
    setUser(enriched);
  }, []);

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
