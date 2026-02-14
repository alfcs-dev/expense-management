import { useEffect } from "react";
import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "../utils/auth-client";
import { Button } from "../components/ui/button";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);
  const { data: session, isPending, refetch } = authClient.useSession();

  const onSignOut = async () => {
    await authClient.signOut();
    await refetch();
  };

  const onChangeLanguage = async (nextLanguage: "en" | "es") => {
    if (i18n.language === nextLanguage) return;
    await i18n.changeLanguage(nextLanguage);
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
              size="sm"
              onClick={() => void onChangeLanguage("es")}
              disabled={i18n.language.startsWith("es")}
            >
              {t("language.es")}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
        <p className="mb-3 text-sm text-slate-600">
        {isPending
          ? t("session.loading")
          : session
            ? t("session.signedInAs", { email: session.user.email })
            : t("session.notSignedIn")}
      </p>
      {session ? (
        <Button type="button" variant="danger" size="sm" onClick={onSignOut}>
          {t("session.signOut")}
        </Button>
      ) : null}
      </div>
      <Outlet />
    </div>
  );
}
