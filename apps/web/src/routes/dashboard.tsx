import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { protectedRoute } from "./protected";
import { authClient } from "../utils/auth-client";
import { Button } from "@components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/Card";

export const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const onSignOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/sign-in" });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("dashboard.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("dashboard.description")}</p>
          <p className="text-sm">
            {session?.user?.name ?? session?.user?.email ?? t("home.signIn")}
          </p>
          <Button variant="outline" onClick={() => void navigate({ to: "/accounts" })}>
            Accounts
          </Button>
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/credit-card-statements" })}
          >
            Credit Card Statements
          </Button>
          <Button onClick={() => void onSignOut()}>{t("session.signOut")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}
