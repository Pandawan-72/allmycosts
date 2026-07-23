// AuthContext — Version simplifiée sans Firebase.
// Pro piloté uniquement par RevenueCat/Google Billing.
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentEntitlement, restorePurchasesRC, configureRC, isRevenueCatSupported } from "@/src/lib/revenuecat";
import { storage } from "@/src/utils/storage";

const FORCE_PRO_FOR_TESTING = false;
const TRIAL_DAYS = 15;
const INSTALLED_AT_KEY = "amc.local_user.installedAt";

export function getTrialInfo(installedAt: string): { isInTrial: boolean; daysLeft: number; trialExpired: boolean } {
  if (!installedAt) return { isInTrial: false, daysLeft: 0, trialExpired: false };
  const install = new Date(installedAt);
  const expiry = new Date(install.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msLeft = expiry.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const isInTrial = daysLeft > 0;
  const trialExpired = !isInTrial && !!installedAt;
  return { isInTrial, daysLeft: Math.max(0, daysLeft), trialExpired };
}

export type AuthUser = {
  name: string;
  isPro: boolean;
};

type AuthContextType = {
  user: AuthUser;
  isPro: boolean;
  loading: boolean;
  refreshPro: () => Promise<void>;
  isInTrial: boolean;
  trialDaysLeft: number;
  trialExpired: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: { name: "", isPro: true },
  isPro: true,
  loading: false,
  refreshPro: async () => {},
  isInTrial: false,
  trialDaysLeft: 0,
  trialExpired: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(FORCE_PRO_FOR_TESTING);
  const [loading, setLoading] = useState(false);
  const [installedAt, setInstalledAt] = useState<string>("");

  const trialInfo = getTrialInfo(installedAt);

  const refreshPro = async () => {
    if (FORCE_PRO_FOR_TESTING) { setIsPro(true); return; }
    try {
      const entitled = await getCurrentEntitlement();
      setIsPro(entitled);
    } catch {
      setIsPro(false);
    }
  };

  useEffect(() => {
    // Charger installedAt depuis le storage dès le démarrage
    (async () => {
      try {
        const stored = await storage.getItem<string>(INSTALLED_AT_KEY, "");
        if (stored) {
          setInstalledAt(stored);
        } else {
          const now = new Date().toISOString();
          await storage.setItem(INSTALLED_AT_KEY, now);
          setInstalledAt(now);
        }
      } catch {}
    })();

    if (FORCE_PRO_FOR_TESTING) { setIsPro(true); return; }
    setLoading(true);
    (async () => {
      try {
        const entitled = await getCurrentEntitlement();
        setIsPro(entitled);
        if (!entitled && isRevenueCatSupported()) {
          restorePurchasesRC().then(async (restored) => {
            if (restored) {
              const recheck = await getCurrentEntitlement();
              setIsPro(recheck);
            }
          }).catch(() => {});
        }
      } catch {
        setIsPro(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider value={{
      user: { name: "", isPro },
      isPro,
      loading,
      refreshPro,
      isInTrial: trialInfo.isInTrial,
      trialDaysLeft: trialInfo.daysLeft,
      trialExpired: trialInfo.trialExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
