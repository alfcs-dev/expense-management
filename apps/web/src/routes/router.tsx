import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { signInRoute } from "./sign-in";
import { registerRoute } from "./register";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { protectedRoute } from "./protected";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  registerRoute,
  protectedRoute.addChildren([dashboardRoute, accountsRoute]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
});
