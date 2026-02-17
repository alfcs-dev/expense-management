-- CreateEnum
CREATE TYPE "CreditCardStatementStatus" AS ENUM ('open', 'closed', 'partial', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "BudgetRuleType" AS ENUM ('fixed', 'percent_of_income');

-- DropIndex
DROP INDEX "RecurringExpense_budgetId_idx";

-- AlterTable
ALTER TABLE "Budget" ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "budgetLimit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "installmentId" TEXT,
ADD COLUMN     "statementId" TEXT;

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installmentPlanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardStatement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" INTEGER NOT NULL DEFAULT 0,
    "paymentsApplied" INTEGER NOT NULL DEFAULT 0,
    "status" "CreditCardStatementStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementPayment" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "amountApplied" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "expectedIncomeAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomePlanItem" (
    "id" TEXT NOT NULL,
    "budgetPeriodId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "accountId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "ruleType" "BudgetRuleType" NOT NULL,
    "value" INTEGER NOT NULL,
    "applyOrder" INTEGER NOT NULL DEFAULT 0,
    "minAmount" INTEGER,
    "capAmount" INTEGER,
    "activeFrom" TEXT,
    "activeTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetPeriodId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "plannedAmount" INTEGER NOT NULL,
    "generatedFromRuleId" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Installment_userId_dueDate_idx" ON "Installment"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_installmentPlanId_installmentNumber_key" ON "Installment"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "CreditCardStatement_accountId_dueDate_idx" ON "CreditCardStatement"("accountId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardStatement_accountId_periodStart_periodEnd_key" ON "CreditCardStatement"("accountId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "StatementPayment_statementId_idx" ON "StatementPayment"("statementId");

-- CreateIndex
CREATE INDEX "StatementPayment_transferId_idx" ON "StatementPayment"("transferId");

-- CreateIndex
CREATE INDEX "BudgetPeriod_userId_month_idx" ON "BudgetPeriod"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPeriod_userId_month_key" ON "BudgetPeriod"("userId", "month");

-- CreateIndex
CREATE INDEX "IncomePlanItem_budgetPeriodId_idx" ON "IncomePlanItem"("budgetPeriodId");

-- CreateIndex
CREATE INDEX "BudgetRule_userId_categoryId_activeFrom_activeTo_idx" ON "BudgetRule"("userId", "categoryId", "activeFrom", "activeTo");

-- CreateIndex
CREATE INDEX "BudgetAllocation_userId_budgetPeriodId_idx" ON "BudgetAllocation"("userId", "budgetPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_budgetPeriodId_categoryId_key" ON "BudgetAllocation"("budgetPeriodId", "categoryId");

-- CreateIndex
CREATE INDEX "Expense_statementId_idx" ON "Expense"("statementId");

-- CreateIndex
CREATE INDEX "Expense_installmentId_idx" ON "Expense"("installmentId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_userId_status_idx" ON "InstallmentPlan"("userId", "status");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardStatement" ADD CONSTRAINT "CreditCardStatement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementPayment" ADD CONSTRAINT "StatementPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementPayment" ADD CONSTRAINT "StatementPayment_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPeriod" ADD CONSTRAINT "BudgetPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomePlanItem" ADD CONSTRAINT "IncomePlanItem_budgetPeriodId_fkey" FOREIGN KEY ("budgetPeriodId") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomePlanItem" ADD CONSTRAINT "IncomePlanItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRule" ADD CONSTRAINT "BudgetRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRule" ADD CONSTRAINT "BudgetRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_budgetPeriodId_fkey" FOREIGN KEY ("budgetPeriodId") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_generatedFromRuleId_fkey" FOREIGN KEY ("generatedFromRuleId") REFERENCES "BudgetRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

