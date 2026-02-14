import { router } from "./trpc.js";
import { accountRouter } from "./routers/account.js";
import { userRouter } from "./routers/user.js";

export const appRouter = router({
  user: userRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;
