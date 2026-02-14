import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { indexRoute } from "./index";
import { dashboardRoute } from "./dashboard";
import { accountsRoute } from "./accounts";

const routeTree = rootRoute.addChildren([indexRoute, dashboardRoute, accountsRoute]);

export const router = createRouter({ routeTree });
