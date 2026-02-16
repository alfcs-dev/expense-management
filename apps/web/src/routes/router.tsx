import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { signInRoute } from "./sign-in";
import { registerRoute } from "./register";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { budgetsRoute } from "./budgets";
import { categoriesRoute } from "./categories";
import { expensesRoute } from "./expenses";
import { recurringExpensesRoute } from "./recurring-expenses";
import { protectedRoute } from "./protected";
import { dashboardLegacyRoute } from "./dashboard-legacy";

const routeTree = rootRoute.addChildren([
  signInRoute,
  registerRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    dashboardLegacyRoute,
    accountsRoute,
    budgetsRoute,
    categoriesRoute,
    expensesRoute,
    recurringExpensesRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
});
