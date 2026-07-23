// Local app access state + RevenueCat entitlement state.
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  configureRC,
  getCurrentEntitlement,
  isRevenueCatSupported,
  subscribeToEntitlementChanges,
} from "@/src/lib/revenuecat";
import { storage } from "@/src/utils/storage";

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
  user: { name: "", isPro: false },
  isPro: false,
  loading: true,
  refreshPro: async () => {},
  isInTrial: false,
  trialDaysLeft: 0,
  trialExpired: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(isRevenueCatSupported());
  const [installedAt, setInstalledAt] = useState<string>("");

  const trialInfo = getTrialInfo(installedAt);

  const refreshPro = async () => {
    if (!isRevenueCatSupported()) {
      setIsPro(false);
      return;
    }

    const entitled = await getCurrentEntitlement();
    setIsPro(entitled);
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const stored = await storage.getItem<string>(INSTALLED_AT_KEY, "");
        if (!mounted) return;
        if (stored) {
          setInstalledAt(stored);
        } else {
          const now = new Date().toISOString();
          await storage.setItem(INSTALLED_AT_KEY, now);
          if (mounted) setInstalledAt(now);
        }
      } catch {
        // Trial metadata failure must not block app startup.
      }
    })();

    if (!isRevenueCatSupported()) {
      setLoading(false);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        // Configure first, then query entitlement. This removes the startup race
        // where getCustomerInfo()/getOfferings() previously returned before RC
        // was configured.
        await configureRC();
        const entitled = await getCurrentEntitlement();
        if (mounted) setIsPro(entitled);

        unsubscribe = await subscribeToEntitlementChanges((active) => {
          if (mounted) setIsPro(active);
        });
      } catch (error) {
        console.warn("[RC] Unable to initialize entitlement state", error);
        if (mounted) setIsPro(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
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
