import { useEffect } from "react";
import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "../utils/auth-client";
import { Button } from "../components/ui/button";
import { Nav } from "@/components/layout/Nav";

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
    <>
    <Nav user={session?.user} />
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
        <p className="mb-3 text-sm text-slate-600">
        {isPending
          ? t("session.loading")
          : session
            ? t("session.signedInAs", { email: session.user.email })
            : t("session.notSignedIn")}
      </p>
      {session ? (
        <Button type="button" variant="destructive" size="sm" onClick={onSignOut}>
          {t("session.signOut")}
        </Button>
      ) : null}
      </div>
      <Outlet />
    </div>
    </>
  );
}
