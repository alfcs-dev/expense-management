import { useEffect } from "react";
import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "../utils/auth-client";

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);
  const { data: session, isPending, refetch } = authClient.useSession();

  const onSignOut = async () => {
    await authClient.signOut();
    await refetch();
  };

  return (
    <div>
      <nav>
        <Link to="/">{t("nav.home")}</Link> |{" "}
        <Link to="/dashboard">{t("nav.dashboard")}</Link> |{" "}
        <Link to="/accounts">{t("nav.accounts")}</Link> |{" "}
        <Link to="/categories">{t("nav.categories")}</Link> |{" "}
        <Link to="/expenses">{t("nav.expenses")}</Link> |{" "}
        <Link to="/recurring-expenses">{t("nav.recurringExpenses")}</Link>
        {/* Phase 2: language switcher (e.g. EN / ES) */}
        <span style={{ marginLeft: "1rem" }} title={t("language.label")}>
          {t("language.en")}
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
