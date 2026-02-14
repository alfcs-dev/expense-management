import { router } from "./trpc.js";
import { accountRouter } from "./routers/account.js";
import { categoryRouter } from "./routers/category.js";
import { userRouter } from "./routers/user.js";

export const appRouter = router({
  user: userRouter,
  account: accountRouter,
  category: categoryRouter,
});

export type AppRouter = typeof appRouter;
