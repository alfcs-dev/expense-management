import { User } from "@expense-management/trpc";
import { Link } from "@tanstack/react-router";

import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

export function Nav({ user }: { user?: User | null }) {
    const { t, i18n } = useTranslation();
    
    const onChangeLanguage = async (nextLanguage: "en" | "es") => {
        if (i18n.language === nextLanguage) return;
        await i18n.changeLanguage(nextLanguage);
    };

    return user ? 
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <nav className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/">{t("nav.home")}</Link>
        <Link to="/dashboard">{t("nav.dashboard")}</Link>
        <Link to="/accounts">{t("nav.accounts")}</Link>
        <Link to="/budgets">{t("nav.budgets")}</Link>
        <Link to="/categories">{t("nav.categories")}</Link>
        <Link to="/expenses">{t("nav.expenses")}</Link>
        <Link to="/recurring-expenses">{t("nav.recurringExpenses")}</Link>
        </nav>
      <div className="ml-auto flex items-center gap-2" title={t("language.label")}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void onChangeLanguage("en")}
          disabled={i18n.language.startsWith("en")}
        >
          {t("language.en")}
        </Button>
        <Button
          type="button"
          variant="secondary"
    
          className="rounded-full"
          size="lg"
          onClick={() => void onChangeLanguage("es")}
          disabled={i18n.language.startsWith("es")}
        >
          {t("language.es")}
        </Button>
      </div>
    </div>
  </header>
    : null
}