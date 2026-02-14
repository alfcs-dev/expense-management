import { useEffect } from "react";
import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "../utils/auth-client";

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
    <div>
      <nav>
        <Link to="/">{t("nav.home")}</Link> |{" "}
        <Link to="/dashboard">{t("nav.dashboard")}</Link> |{" "}
        <Link to="/accounts">{t("nav.accounts")}</Link> |{" "}
        <Link to="/categories">{t("nav.categories")}</Link> |{" "}
        <Link to="/expenses">{t("nav.expenses")}</Link> |{" "}
        <Link to="/installments">{t("nav.installments")}</Link> |{" "}
        <Link to="/transfers">{t("nav.transfers")}</Link> |{" "}
        <Link to="/savings-goals">{t("nav.savingsGoals")}</Link> |{" "}
        <Link to="/reports">{t("nav.reports")}</Link> |{" "}
        <Link to="/recurring-expenses">{t("nav.recurringExpenses")}</Link>
        <span style={{ marginLeft: "1rem" }} title={t("language.label")}>
          <button
            type="button"
            onClick={() => void onChangeLanguage("en")}
            disabled={i18n.language.startsWith("en")}
          >
            {t("language.en")}
          </button>{" "}
          <button
            type="button"
            onClick={() => void onChangeLanguage("es")}
            disabled={i18n.language.startsWith("es")}
          >
            {t("language.es")}
          </button>
        </span>
      </nav>
      <p>
        {isPending
          ? t("session.loading")
          : session
            ? t("session.signedInAs", { email: session.user.email })
            : t("session.notSignedIn")}
      </p>
      {session ? (
        <button type="button" onClick={onSignOut}>
          {t("session.signOut")}
        </button>
      ) : null}
      <hr />
      <Outlet />
    </div>
  );
}
