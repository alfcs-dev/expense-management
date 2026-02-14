import { router, protectedProcedure } from "../trpc.js";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),
});
