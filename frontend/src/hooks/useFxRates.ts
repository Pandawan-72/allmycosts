import { useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

const CACHE_KEY = "amc.fx.eur.cache";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h

type Cached = { ts: number; rates: Record<string, number> };

export function useFxRatesEUR() {
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await storage.getItem<Cached | null>(CACHE_KEY, null);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS && cached.rates?.EUR) {
          if (!cancelled) {
            setRates(cached.rates);
            setLoading(false);
          }
          return;
        }
      } catch {}
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/EUR");
        const json = await res.json();
        if (json && json.rates && !cancelled) {
          setRates(json.rates);
          await storage.setItem(CACHE_KEY, { ts: Date.now(), rates: json.rates });
        }
      } catch {
        // keep defaults (EUR: 1); UI will fall back to EUR
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function convertFromEur(amountEur: number, toCurrency: string): number {
    const r = rates[toCurrency.toUpperCase()];
    return r ? amountEur * r : amountEur;
  }

  function convert(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;
    const fromR = rates[fromCurrency.toUpperCase()];
    const toR = rates[toCurrency.toUpperCase()];
    if (!fromR || !toR) return amount;
    const amountInEur = amount / fromR;
    return amountInEur * toR;
  }

  return { rates, loading, convertFromEur, convert };
}
