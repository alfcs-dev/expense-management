# Finance V2 ERD

## Mermaid ERD

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : owns
  USER ||--o{ CATEGORY : defines
  USER ||--o{ PROJECT : owns
  USER ||--o{ TRANSACTION : records
  USER ||--o{ TRANSFER : executes
  USER ||--o{ CREDIT_CARD_STATEMENT : tracks
  USER ||--o{ INSTALLMENT_PLAN : creates
  USER ||--o{ INSTALLMENT : schedules
  USER ||--o{ BUDGET_PERIOD : plans
  USER ||--o{ BUDGET_RULE : configures
  USER ||--o{ BUDGET : allocates
  USER ||--o{ INCOME_PLAN_ITEM : plans_income
  USER ||--o{ INCOME_EVENT : captures_income
  USER ||--o{ PLANNED_TRANSFER : plans_transfers
  USER ||--o{ BILL : defines
  USER ||--o{ ACCOUNT_BALANCE_SNAPSHOT : reconciles

  ACCOUNT ||--o| ACCOUNT_TRANSFER_PROFILE : routing_profile
  ACCOUNT ||--o| ACCOUNT_CARD_PROFILE : card_profile
  INSTITUTION_CATALOG ||--o{ ACCOUNT : classifies
  ACCOUNT ||--o| CREDIT_CARD_SETTINGS : card_config
  ACCOUNT ||--o{ CREDIT_CARD_STATEMENT : issues
  ACCOUNT ||--o{ TRANSACTION : charged_to
  ACCOUNT ||--o{ TRANSFER : source_or_dest
  ACCOUNT ||--o{ INCOME_PLAN_ITEM : receives_plan_income
  ACCOUNT ||--o{ INCOME_EVENT : receives_income
  ACCOUNT ||--o{ PLANNED_TRANSFER : source_or_dest
  ACCOUNT ||--o{ BILL : paying_or_funding
  ACCOUNT ||--o{ ACCOUNT_BALANCE_SNAPSHOT : snapshots

  CATEGORY ||--o{ TRANSACTION : classifies
  CATEGORY ||--o{ BUDGET : targets
  CATEGORY ||--o{ BUDGET_RULE : drives
  CATEGORY ||--o{ BILL : groups

  PROJECT ||--o{ TRANSACTION : groups
  PROJECT ||--o{ INSTALLMENT_PLAN : groups

  BUDGET_PERIOD ||--o{ INCOME_PLAN_ITEM : includes
  BUDGET_PERIOD ||--o{ INCOME_EVENT : captures
  BUDGET_PERIOD ||--o{ BUDGET : contains

  BUDGET_RULE ||--o{ BUDGET : generates

  CREDIT_CARD_STATEMENT ||--o{ TRANSACTION : includes
  CREDIT_CARD_STATEMENT ||--o{ STATEMENT_PAYMENT : receives

  TRANSFER ||--o{ STATEMENT_PAYMENT : applied_as

  INSTALLMENT_PLAN ||--o{ INSTALLMENT : schedules
  INSTALLMENT ||--o{ TRANSACTION : posts_as

  INCOME_EVENT ||--o{ PLANNED_TRANSFER : funds
  PLANNED_TRANSFER ||--o{ TRANSFER : executed_as
```

## DBML Note

Use `.planning/docs/SCHEMA_VISUALIZATION.md` + the branch Prisma schema as the source of truth for implementation.
This document is a conceptual map of the transactions-first model.
