import { useEffect } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type RouterAuthContext } from "../utils/auth-session";

export const rootRoute = createRootRouteWithContext<{ auth: RouterAuthContext }>()({
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);

  return (
    <>
      <Outlet />
    </>
  );
}
