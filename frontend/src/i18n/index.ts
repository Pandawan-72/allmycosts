import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import fr from "./locales/fr";
import en from "./locales/en";
import es from "./locales/es";
import de from "./locales/de";
import it from "./locales/it";
import pt from "./locales/pt";
import nl from "./locales/nl";
import ru from "./locales/ru";

export const SUPPORTED_LANGS = ["fr", "en", "es", "de", "it", "pt", "nl", "ru"] as const;
export type AppLang = typeof SUPPORTED_LANGS[number];

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  nl: { translation: nl },
  ru: { translation: ru },
};

function detectDeviceLang(): AppLang {
  const loc = Localization.getLocales?.()[0];
  const code = (loc?.languageCode || "fr").toLowerCase();
  return (SUPPORTED_LANGS.includes(code as AppLang) ? code : "fr") as AppLang;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLang(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
  returnEmptyString: false,
});

export default i18n;
