import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { categoriesRoute } from "./categories";
import { expensesRoute } from "./expenses";
import { installmentsRoute } from "./installments";
import { recurringExpensesRoute } from "./recurring-expenses";
import { savingsGoalsRoute } from "./savings-goals";
import { transfersRoute } from "./transfers";

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  accountsRoute,
  categoriesRoute,
  expensesRoute,
  installmentsRoute,
  recurringExpensesRoute,
  savingsGoalsRoute,
  transfersRoute,
]);

export const router = createRouter({ routeTree });
