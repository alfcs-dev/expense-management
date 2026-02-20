import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

const DEFAULT_LANG = "en";
const STORAGE_KEY = "expense-management.language";

function detectInitialLanguage(): "en" | "es" {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("es")
  ) {
    return "es";
  }

  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectInitialLanguage(),
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
});

void i18n.on("languageChanged", (language: string) => {
  if (typeof window === "undefined") return;
  if (language !== "en" && language !== "es") return;
  window.localStorage.setItem(STORAGE_KEY, language);
});

export default i18n;
