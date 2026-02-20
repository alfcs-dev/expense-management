import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { signInRoute } from "./sign-in";
import { registerRoute } from "./register";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { billsRoute } from "./bills";
import { budgetsRoute } from "./budgets";
import { categoriesRoute } from "./categories";
import { creditCardStatementsRoute } from "./credit-card-statements";
import {
  transactionsDepositRoute,
  transactionsExpenseRoute,
  transactionsRoute,
} from "./transactions";
import { protectedRoute } from "./protected";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  registerRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    accountsRoute,
    categoriesRoute,
    budgetsRoute,
    billsRoute,
    transactionsRoute,
    transactionsDepositRoute,
    transactionsExpenseRoute,
    creditCardStatementsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
  },
});
