import { router } from "./trpc.js";
import { accountRouter } from "./routers/account.js";
import { budgetRouter } from "./routers/budget.js";
import { budgetAllocationRouter } from "./routers/budget-allocation.js";
import { budgetPeriodRouter } from "./routers/budget-period.js";
import { budgetRuleRouter } from "./routers/budget-rule.js";
import { categoryRouter } from "./routers/category.js";
import { creditCardStatementRouter } from "./routers/credit-card-statement.js";
import { expenseRouter } from "./routers/expense.js";
import { incomePlanItemRouter } from "./routers/income-plan-item.js";
import { installmentRouter } from "./routers/installment.js";
import { recurringExpenseRouter } from "./routers/recurring-expense.js";
import { userRouter } from "./routers/user.js";

export const appRouter = router({
  user: userRouter,
  account: accountRouter,
  category: categoryRouter,
  recurringExpense: recurringExpenseRouter,
  budget: budgetRouter,
  budgetPeriod: budgetPeriodRouter,
  budgetRule: budgetRuleRouter,
  budgetAllocation: budgetAllocationRouter,
  incomePlanItem: incomePlanItemRouter,
  creditCardStatement: creditCardStatementRouter,
  installment: installmentRouter,
  expense: expenseRouter,
});

export type AppRouter = typeof appRouter;
