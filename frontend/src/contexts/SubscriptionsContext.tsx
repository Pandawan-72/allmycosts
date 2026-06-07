import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import * as Localization from "expo-localization";
import { currencyForRegion } from "@/src/data/currencies";
import { Category } from "@/src/data/categories";
import { useAuth } from "@/src/contexts/AuthContext";

export type BillingCycle = "monthly" | "yearly";

export type Subscription = {
  id: string;
  name: string;
  price: number; // amount per billing cycle in the chosen currency
  currency: string;
  cycle: BillingCycle;
  categoryId: string;
  createdAt: string;
};

type SubsState = {
  loading: boolean;
  baseCurrency: string;
  setBaseCurrency: (c: string) => Promise<void>;
  subscriptions: Subscription[];
  customCategories: Category[];
  addSubscription: (s: Omit<Subscription, "id" | "createdAt">) => Promise<void>;
  updateSubscription: (id: string, s: Partial<Omit<Subscription, "id" | "createdAt">>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  addCustomCategory: (c: Omit<Category, "id"> & { id?: string }) => Promise<Category>;
  monthlyTotal: number;
  yearlyTotal: number;
};

const Ctx = createContext<SubsState | undefined>(undefined);

function userScopedKey(userId: string | undefined, name: string) {
  return `amc.${userId || "anon"}.${name}`;
}

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uidKey = user?.user_id;

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrencyState] = useState<string>("EUR");

  // Load when user becomes available
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!uidKey) {
        setSubscriptions([]);
        setCustomCategories([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const subs = await storage.getItem<Subscription[]>(userScopedKey(uidKey, "subs"), []);
      const cats = await storage.getItem<Category[]>(userScopedKey(uidKey, "cats"), []);
      const cur = await storage.getItem<string>(userScopedKey(uidKey, "currency"), "");
      if (canceled) return;
      setSubscriptions(subs || []);
      setCustomCategories(cats || []);
      if (cur) {
        setBaseCurrencyState(cur);
      } else {
        const region = Localization.getLocales?.()[0]?.regionCode || null;
        setBaseCurrencyState(currencyForRegion(region));
      }
      setLoading(false);
    })();
    return () => { canceled = true; };
  }, [uidKey]);

  const persistSubs = useCallback(async (next: Subscription[]) => {
    setSubscriptions(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "subs"), next);
  }, [uidKey]);

  const persistCats = useCallback(async (next: Category[]) => {
    setCustomCategories(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "cats"), next);
  }, [uidKey]);

  const setBaseCurrency = useCallback(async (c: string) => {
    setBaseCurrencyState(c);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "currency"), c);
  }, [uidKey]);

  const addSubscription = useCallback(async (s: Omit<Subscription, "id" | "createdAt">) => {
    const newSub: Subscription = { ...s, id: uid(), createdAt: new Date().toISOString() };
    await persistSubs([newSub, ...subscriptions]);
  }, [persistSubs, subscriptions]);

  const updateSubscription = useCallback(async (id: string, s: Partial<Omit<Subscription, "id" | "createdAt">>) => {
    await persistSubs(subscriptions.map((x) => (x.id === id ? { ...x, ...s } : x)));
  }, [persistSubs, subscriptions]);

  const deleteSubscription = useCallback(async (id: string) => {
    await persistSubs(subscriptions.filter((x) => x.id !== id));
  }, [persistSubs, subscriptions]);

  const addCustomCategory = useCallback(async (c: Omit<Category, "id"> & { id?: string }) => {
    const cat: Category = { id: c.id || `c_${Date.now().toString(36)}`, label: c.label, icon: c.icon, color: c.color };
    await persistCats([...customCategories, cat]);
    return cat;
  }, [persistCats, customCategories]);

  const { monthlyTotal, yearlyTotal } = useMemo(() => {
    // Sum only matching base currency (no conversion). Future: integrate FX rates.
    let m = 0;
    let y = 0;
    for (const s of subscriptions) {
      if (s.currency !== baseCurrency) continue;
      const monthly = s.cycle === "monthly" ? s.price : s.price / 12;
      m += monthly;
      y += monthly * 12;
    }
    return { monthlyTotal: m, yearlyTotal: y };
  }, [subscriptions, baseCurrency]);

  return (
    <Ctx.Provider
      value={{
        loading,
        baseCurrency,
        setBaseCurrency,
        subscriptions,
        customCategories,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        addCustomCategory,
        monthlyTotal,
        yearlyTotal,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSubscriptions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSubscriptions must be used inside SubscriptionsProvider");
  return ctx;
}
