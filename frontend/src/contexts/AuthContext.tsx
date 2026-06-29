// AuthContext — Version simplifiée sans Firebase.
// Pro piloté uniquement par RevenueCat/Google Billing.
// En mode test : FORCE_PRO_FOR_TESTING = true pour tout le monde.
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentEntitlement } from "@/src/lib/revenuecat";

const FORCE_PRO_FOR_TESTING = true; // ← passer à false quand Google Billing est configuré

export type AuthUser = {
  name: string;
  isPro: boolean;
};

type AuthContextType = {
  user: AuthUser;
  isPro: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: { name: "", isPro: true },
  isPro: true,
  loading: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (FORCE_PRO_FOR_TESTING) {
      setIsPro(true);
      return;
    }
    setLoading(true);
    getCurrentEntitlement()
      .then(setIsPro)
      .catch(() => setIsPro(false))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user: { name: "", isPro }, isPro, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
