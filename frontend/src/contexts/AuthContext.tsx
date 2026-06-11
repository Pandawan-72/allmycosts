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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (fbUser: any) => {
      if (fbUser) { setUser(firebaseUserToAuthUser(fbUser)); } else { setUser(null); }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await firebaseLogin(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const u = await firebaseRegister(name, email, password);
    setUser(u);
  }, []);

  const loginWithGoogleSession = useCallback(async (_sessionId: string) => {
    throw new Error("Non supporte. Utilisez Google natif.");
  }, []);

  const loginWithGoogleIdToken = useCallback(async (idToken: string) => {
    const u = await firebaseGoogleSignIn(idToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try { const { nativeGoogleSignOut } = await import("@/src/lib/googleAuth"); await nativeGoogleSignOut(); } catch {}
    await firebaseSignOut();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const fbUser = auth.currentUser;
    if (fbUser) setUser(firebaseUserToAuthUser(fbUser));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token: null, loading, login, register, loginWithGoogleSession, loginWithGoogleIdToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
