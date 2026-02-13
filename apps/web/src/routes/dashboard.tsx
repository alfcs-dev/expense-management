import { useEffect } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { rootRoute } from "./__root";
import { trpc } from "../utils/trpc";

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.user.me.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && error?.data?.code === "UNAUTHORIZED") {
      navigate({ to: "/" });
    }
  }, [isLoading, error?.data?.code, navigate]);

  if (isLoading) return <p>{t("dashboard.loading")}</p>;
  if (error?.data?.code === "UNAUTHORIZED") return null; // redirecting
  if (error) return <p>{t("dashboard.error", { message: error.message })}</p>;
  if (!data?.user) return null;

  return (
    <div>
      <h1>{t("dashboard.title")}</h1>
      <p>{t("dashboard.protectedMessage", { email: data.user.email })}</p>
    </div>
  );
}
