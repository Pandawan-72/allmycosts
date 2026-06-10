import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";

const API = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "amc.auth.token";

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

async function apiPost(path: string, body: any, token?: string | null) {
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail || "Erreur réseau";
    throw new Error(typeof msg === "string" ? msg : "Erreur réseau");
  }
  return data;
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${API}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet<string>(TOKEN_KEY, "");
      if (saved) {
        try {
          const me = await apiGet("/auth/me", saved);
          setUser(me as AuthUser);
          setToken(saved);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (t: string, u: AuthUser) => {
    await storage.secureSet(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost("/auth/login", { email, password });
    await persist(data.token, data.user);
  }, [persist]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiPost("/auth/register", { name, email, password });
    await persist(data.token, data.user);
  }, [persist]);

  const loginWithGoogleSession = useCallback(async (session_id: string) => {
    const data = await apiPost("/auth/google", { session_id });
    await persist(data.token, data.user);
  }, [persist]);

  const loginWithGoogleIdToken = useCallback(async (id_token: string) => {
    const data = await apiPost("/auth/google-native", { id_token });
    await persist(data.token, data.user);
  }, [persist]);

  const logout = useCallback(async () => {
    // Best-effort: clear native Google session so the next sign-in shows the
    // account picker (otherwise the SDK silently reuses the cached account).
    try {
      const { nativeGoogleSignOut } = await import("@/src/lib/googleAuth");
      await nativeGoogleSignOut();
    } catch {
      /* noop — non-fatal */
    }
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await apiGet("/auth/me", token);
      setUser(me as AuthUser);
    } catch {}
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogleSession, loginWithGoogleIdToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
