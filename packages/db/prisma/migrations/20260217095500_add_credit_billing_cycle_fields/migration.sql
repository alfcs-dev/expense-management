-- AlterTable
ALTER TABLE "Account"
  ADD COLUMN "statementClosingDay" INTEGER,
  ADD COLUMN "paymentGraceDays" INTEGER;
