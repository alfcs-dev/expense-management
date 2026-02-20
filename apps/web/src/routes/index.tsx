import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const session = await context.auth.getSession();
    throw redirect({ to: session?.user ? "/dashboard" : "/sign-in" });
  },
  component: () => null,
});
