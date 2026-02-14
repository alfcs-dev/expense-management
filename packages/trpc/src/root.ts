import { router } from "./trpc.js";
import { accountRouter } from "./routers/account.js";
import { budgetRouter } from "./routers/budget.js";
import { categoryRouter } from "./routers/category.js";
import { expenseRouter } from "./routers/expense.js";
import { installmentPlanRouter } from "./routers/installment-plan.js";
import { importRouter } from "./routers/import.js";
import { recurringExpenseRouter } from "./routers/recurring-expense.js";
import { reportRouter } from "./routers/report.js";
import { savingsGoalRouter } from "./routers/savings-goal.js";
import { transferRouter } from "./routers/transfer.js";
import { userRouter } from "./routers/user.js";

export const appRouter = router({
  user: userRouter,
  account: accountRouter,
  category: categoryRouter,
  recurringExpense: recurringExpenseRouter,
  budget: budgetRouter,
  expense: expenseRouter,
  installmentPlan: installmentPlanRouter,
  import: importRouter,
  transfer: transferRouter,
  savingsGoal: savingsGoalRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
