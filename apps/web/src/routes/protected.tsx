import { createRoute, Outlet } from "@tanstack/react-router";
import { requireSession } from "../utils/auth-session";
import { rootRoute } from "./__root";

export const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async ({ context, location }) => {
    await requireSession(context.auth, location.href);
  },
  component: Outlet,
});
