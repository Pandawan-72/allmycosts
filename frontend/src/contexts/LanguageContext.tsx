import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { storage } from "@/src/utils/storage";
import i18n, { AppLang, SUPPORTED_LANGS } from "@/src/i18n";

type LangState = {
  lang: AppLang;
  setLang: (l: AppLang) => Promise<void>;
};

const Ctx = createContext<LangState | undefined>(undefined);
const KEY = "amc.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>((i18n.language as AppLang) || "fr");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(KEY, "");
      if (saved && SUPPORTED_LANGS.includes(saved as AppLang)) {
        await i18n.changeLanguage(saved);
        setLangState(saved as AppLang);
      }
    })();
  }, []);

  const setLang = useCallback(async (l: AppLang) => {
    await i18n.changeLanguage(l);
    await storage.setItem(KEY, l);
    setLangState(l);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLanguage must be inside LanguageProvider");
  return c;
}
