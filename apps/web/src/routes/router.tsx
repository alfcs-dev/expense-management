import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";
import { categoriesRoute } from "./categories";

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  accountsRoute,
  categoriesRoute,
]);

export const router = createRouter({ routeTree });
