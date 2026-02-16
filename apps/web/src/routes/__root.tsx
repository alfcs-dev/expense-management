import { useEffect } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "../utils/auth-client";

import { Nav } from "@/components/layout/Nav";
import { type RouterAuthContext } from "../utils/auth-session";

export const rootRoute = createRootRouteWithContext<{ auth: RouterAuthContext }>()({
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);
  const { data: session } = authClient.useSession();

  return (
    <>
      <Nav user={session?.user} />
      <Outlet />
    </>
  );
}
