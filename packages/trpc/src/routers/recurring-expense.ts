import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";

function recurringRemovedError(): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      "Recurring expenses were removed in the transactions-first cutover. Use bills/planned transfers instead.",
  });
}

export const recurringExpenseRouter = router({
  list: protectedProcedure.query(() => []),
  create: protectedProcedure.mutation(() => recurringRemovedError()),
  update: protectedProcedure.mutation(() => recurringRemovedError()),
  delete: protectedProcedure.mutation(() => recurringRemovedError()),
});
