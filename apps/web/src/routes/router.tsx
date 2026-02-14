import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { categoriesRoute } from "./categories";
import { expensesRoute } from "./expenses";
import { recurringExpensesRoute } from "./recurring-expenses";

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  accountsRoute,
  categoriesRoute,
  expensesRoute,
  recurringExpensesRoute,
]);

export const router = createRouter({ routeTree });
