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
  price: number;
  currency: string;
  cycle: BillingCycle;
  categoryId: string;
  dueDate?: string | null;
  createdAt: string;
};

// Dépense ponctuelle (one-off), ex: "Courses Super U" à une date précise.
// Distincte des abonnements récurrents (Subscription ci-dessus).
export type Expense = {
  id: string;
  name: string;
  price: number;
  currency: string;
  categoryId: string;
  date: string; // ISO date (YYYY-MM-DD) — date à laquelle la dépense a eu lieu
  createdAt: string;
  // Chemin local (FileSystem.documentDirectory) vers une photo du ticket de
  // caisse associée, copiée de façon permanente lors de la création (scan
  // OCR ou ajout manuel). Optionnel — fonctionnalité Pro.
  receiptImageUri?: string;
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
  deleteCustomCategory: (id: string) => Promise<void>;
  installedAt: string;
  setInstalledAt: (date: string) => Promise<void>;
  replaceAllSubscriptions: (next: Subscription[]) => Promise<void>;
  replaceAllCustomCategories: (next: Category[]) => Promise<void>;
  monthlyIncome: number;
  setMonthlyIncome: (amount: number) => Promise<void>;
  incomeOverrides: Record<string, number>;
  // Définit (ou efface si amount est null) un revenu spécifique pour un mois donné.
  setIncomeForMonth: (year: number, month: number, amount: number | null) => Promise<void>;
  // Retourne le revenu effectif pour un mois donné : l'override s'il existe, sinon le défaut.
  getIncomeForMonth: (year: number, month: number) => number;
  monthlyTotal: number;
  yearlyTotal: number;
  // Dépenses ponctuelles
  expenses: Expense[];
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (id: string, e: Partial<Omit<Expense, "id" | "createdAt">>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  replaceAllExpenses: (next: Expense[]) => Promise<void>;
  expensesMonthlyTotal: (year: number, month: number) => number;
  expensesYearlyTotal: (year: number) => number;
};

const Ctx = createContext<SubsState | undefined>(undefined);

function userScopedKey(userId: string | undefined, name: string) {
  return `amc.${userId || "anon"}.${name}`;
}

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function uidExpense() {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uidKey = user?.user_id;

  const [loading, setLoading] = useState(true);
  const [installedAt, setInstalledAt] = useState<string>("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrencyState] = useState<string>("EUR");
  const [monthlyIncome, setMonthlyIncomeState] = useState<number>(0);
  // Revenus spécifiques à certains mois, qui remplacent le revenu par défaut.
  // Clé au format "YYYY-MM" (ex: "2026-06").
  const [incomeOverrides, setIncomeOverridesState] = useState<Record<string, number>>({});

  // ✅ Charge TOUTES les données au démarrage, y compris les revenus
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!uidKey) {
        setSubscriptions([]);
        setExpenses([]);
        setCustomCategories([]);
        setMonthlyIncomeState(0);
        setIncomeOverridesState({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const subs = await storage.getItem<Subscription[]>(userScopedKey(uidKey, "subs"), []);
      const exps = await storage.getItem<Expense[]>(userScopedKey(uidKey, "expenses"), []);
      const cats = await storage.getItem<Category[]>(userScopedKey(uidKey, "cats"), []);
      const cur = await storage.getItem<string>(userScopedKey(uidKey, "currency"), "");
      // ✅ Charge les revenus depuis le storage local
      const income = await storage.getItem<number>(userScopedKey(uidKey, "income"), 0);
      const overrides = await storage.getItem<Record<string, number>>(userScopedKey(uidKey, "incomeOverrides"), {});

      if (canceled) return;
      setSubscriptions(subs || []);
      setExpenses(exps || []);
      setCustomCategories(cats || []);
      // ✅ Restaure les revenus
      setMonthlyIncomeState(income || 0);
      setIncomeOverridesState(overrides || {});

      if (cur) {
        setBaseCurrencyState(cur);
      } else {
        const region = Localization.getLocales?.()[0]?.regionCode || null;
        setBaseCurrencyState(currencyForRegion(region));
      }
      // Stocke la date d'installation au premier lancement — utilisée pour
      // ne pas afficher d'épargne sur les mois antérieurs à l'installation.
      const stored = await storage.getItem<string>(userScopedKey(uidKey, "installedAt"), "");
      if (stored) {
        setInstalledAt(stored);
      } else {
        const now = new Date().toISOString();
        await storage.setItem(userScopedKey(uidKey, "installedAt"), now);
        setInstalledAt(now);
      }
      setLoading(false);
    })();
    return () => { canceled = true; };
  }, [uidKey]);

  const persistSubs = useCallback(async (next: Subscription[]) => {
    setSubscriptions(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "subs"), next);
  }, [uidKey]);

  const persistExpenses = useCallback(async (next: Expense[]) => {
    setExpenses(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "expenses"), next);
  }, [uidKey]);

  const persistCats = useCallback(async (next: Category[]) => {
    setCustomCategories(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "cats"), next);
  }, [uidKey]);

  const setBaseCurrency = useCallback(async (c: string) => {
    setBaseCurrencyState(c);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "currency"), c);
  }, [uidKey]);

  // ✅ Sauvegarde les revenus à chaque modification
  const setMonthlyIncome = useCallback(async (amount: number) => {
    const safe = Math.max(0, Number(amount) || 0);
    setMonthlyIncomeState(safe);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "income"), safe);
  }, [uidKey]);

  function incomeKey(year: number, month: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  const setIncomeForMonth = useCallback(async (year: number, month: number, amount: number | null) => {
    const key = incomeKey(year, month);
    const next = { ...incomeOverrides };
    if (amount === null) {
      delete next[key];
    } else {
      next[key] = Math.max(0, Number(amount) || 0);
    }
    setIncomeOverridesState(next);
    if (uidKey) await storage.setItem(userScopedKey(uidKey, "incomeOverrides"), next);
  }, [uidKey, incomeOverrides]);

  const getIncomeForMonth = useCallback((year: number, month: number) => {
    const key = incomeKey(year, month);
    return incomeOverrides[key] ?? monthlyIncome;
  }, [incomeOverrides, monthlyIncome]);

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

  const addExpense = useCallback(async (e: Omit<Expense, "id" | "createdAt">) => {
    const newExpense: Expense = { ...e, id: uidExpense(), createdAt: new Date().toISOString() };
    await persistExpenses([newExpense, ...expenses]);
  }, [persistExpenses, expenses]);

  const updateExpense = useCallback(async (id: string, e: Partial<Omit<Expense, "id" | "createdAt">>) => {
    await persistExpenses(expenses.map((x) => (x.id === id ? { ...x, ...e } : x)));
  }, [persistExpenses, expenses]);

  const deleteExpense = useCallback(async (id: string) => {
    await persistExpenses(expenses.filter((x) => x.id !== id));
  }, [persistExpenses, expenses]);

  const replaceAllExpenses = useCallback(async (next: Expense[]) => {
    await persistExpenses(next);
  }, [persistExpenses]);

  const addCustomCategory = useCallback(async (c: Omit<Category, "id"> & { id?: string }) => {
    const cat: Category = { id: c.id || `c_${Date.now().toString(36)}`, label: c.label, icon: c.icon, color: c.color };
    await persistCats([...customCategories, cat]);
    return cat;
  }, [persistCats, customCategories]);

  const deleteCustomCategory = useCallback(async (id: string) => {
    await persistCats(customCategories.filter((c) => c.id !== id));
  }, [persistCats, customCategories]);

  const setInstalledAtFn = useCallback(async (date: string) => {
    if (!uidKey) return;
    await storage.setItem(userScopedKey(uidKey, "installedAt"), date);
    setInstalledAt(date);
  }, [uidKey]);

  // Remplace l'intégralité des abonnements/catégories en une seule opération
  // atomique (utilisé pour la restauration de sauvegarde) — évite les
  // problèmes de "stale closure" d'une boucle d'appels addSubscription/addCustomCategory.
  const replaceAllSubscriptions = useCallback(async (next: Subscription[]) => {
    await persistSubs(next);
  }, [persistSubs]);

  const replaceAllCustomCategories = useCallback(async (next: Category[]) => {
    await persistCats(next);
  }, [persistCats]);

  const { monthlyTotal, yearlyTotal } = useMemo(() => {
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

  // Total des dépenses ponctuelles pour un mois donné (year: ex 2026, month: 0-11)
  const expensesMonthlyTotal = useCallback((year: number, month: number) => {
    let total = 0;
    for (const e of expenses) {
      if (e.currency !== baseCurrency) continue;
      const d = new Date(e.date);
      if (d.getFullYear() === year && d.getMonth() === month) total += e.price;
    }
    return total;
  }, [expenses, baseCurrency]);

  // Total des dépenses ponctuelles pour une année donnée
  const expensesYearlyTotal = useCallback((year: number) => {
    let total = 0;
    for (const e of expenses) {
      if (e.currency !== baseCurrency) continue;
      const d = new Date(e.date);
      if (d.getFullYear() === year) total += e.price;
    }
    return total;
  }, [expenses, baseCurrency]);

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
        deleteCustomCategory,
        installedAt,
        setInstalledAt: setInstalledAtFn,
        replaceAllSubscriptions,
        replaceAllCustomCategories,
        monthlyIncome,
        setMonthlyIncome,
        incomeOverrides,
        setIncomeForMonth,
        getIncomeForMonth,
        monthlyTotal,
        yearlyTotal,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        replaceAllExpenses,
        expensesMonthlyTotal,
        expensesYearlyTotal,
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
