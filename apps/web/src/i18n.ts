import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

const DEFAULT_LANG = "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
