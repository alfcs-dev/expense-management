import { createRoute, redirect } from "@tanstack/react-router";
import { protectedRoute } from "./protected";

export const dashboardLegacyRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
