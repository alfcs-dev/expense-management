import "./i18n";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { httpBatchLink } from "@trpc/client";
import { router } from "./routes/router";
import { trpc } from "./utils/trpc";
import { env } from "./env";
import { authRouterContext } from "./utils/auth-session";
import { Toaster } from "@components/ui/sonner";

function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    data?: { code?: string };
    shape?: { data?: { code?: string } };
  };
  return (
    candidate.data?.code === "UNAUTHORIZED" ||
    candidate.shape?.data?.code === "UNAUTHORIZED"
  );
}

let isAuthRedirectInFlight = false;

function handleUnauthorized() {
  if (isAuthRedirectInFlight) return;

  const currentPath = window.location.pathname;
  if (currentPath === "/sign-in" || currentPath === "/register") return;

  isAuthRedirectInFlight = true;
  authRouterContext.invalidateSession();
  void router
    .navigate({
      to: "/sign-in",
      search: { redirect: window.location.href },
      replace: true,
    })
    .finally(() => {
      isAuthRedirectInFlight = false;
    });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
      }
    },
  }),
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${env.VITE_API_URL}/api/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ auth: authRouterContext }} />
        <Toaster />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
