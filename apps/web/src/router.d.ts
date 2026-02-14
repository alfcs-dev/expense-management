/* eslint-disable @typescript-eslint/no-unused-vars */
import type { router } from "./routes/router";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
