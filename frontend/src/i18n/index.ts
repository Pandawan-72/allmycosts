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

import legalFr from "./locales/legal/fr";
import legalEn from "./locales/legal/en";
import legalEs from "./locales/legal/es";
import legalDe from "./locales/legal/de";
import legalIt from "./locales/legal/it";
import legalPt from "./locales/legal/pt";
import legalNl from "./locales/legal/nl";
import legalRu from "./locales/legal/ru";

export const SUPPORTED_LANGS = ["fr", "en", "es", "de", "it", "pt", "nl", "ru"] as const;
export type AppLang = typeof SUPPORTED_LANGS[number];

const resources = {
  fr: { translation: { ...fr, legal: legalFr } },
  en: { translation: { ...en, legal: legalEn } },
  es: { translation: { ...es, legal: legalEs } },
  de: { translation: { ...de, legal: legalDe } },
  it: { translation: { ...it, legal: legalIt } },
  pt: { translation: { ...pt, legal: legalPt } },
  nl: { translation: { ...nl, legal: legalNl } },
  ru: { translation: { ...ru, legal: legalRu } },
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
  returnObjects: true,
});

export default i18n;
