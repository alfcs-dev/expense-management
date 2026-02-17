# Finance V2 ERD

## Mermaid ERD

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : owns
  USER ||--o{ CATEGORY : defines
  USER ||--o{ EXPENSE : records
  USER ||--o{ BUDGET_PERIOD : plans
  USER ||--o{ BUDGET_RULE : configures
  USER ||--o{ BUDGET_ALLOCATION : owns
  USER ||--o{ INSTALLMENT_PLAN : creates
  USER ||--o{ INSTALLMENT : tracks

  ACCOUNT ||--o{ EXPENSE : charged_to
  ACCOUNT ||--o{ CREDIT_CARD_STATEMENT : issues
  ACCOUNT ||--o{ TRANSFER : source_or_dest
  ACCOUNT ||--o{ INCOME_PLAN_ITEM : receives

  CATEGORY ||--o{ EXPENSE : classifies
  CATEGORY ||--o{ BUDGET_RULE : targets
  CATEGORY ||--o{ BUDGET_ALLOCATION : allocated_to

  BUDGET_PERIOD ||--o{ INCOME_PLAN_ITEM : includes
  BUDGET_PERIOD ||--o{ BUDGET_ALLOCATION : contains
  BUDGET_RULE ||--o{ BUDGET_ALLOCATION : generates

  CREDIT_CARD_STATEMENT ||--o{ EXPENSE : includes
  CREDIT_CARD_STATEMENT ||--o{ STATEMENT_PAYMENT : receives
  TRANSFER ||--o{ STATEMENT_PAYMENT : applied_as

  INSTALLMENT_PLAN ||--o{ INSTALLMENT : schedules
  INSTALLMENT ||--o{ EXPENSE : posted_as
```

## DBML (dbdiagram.io)

```dbml
Table budget_periods {
  id text [pk]
  user_id text
  month text
  currency text
  expected_income_amount int
}

Table income_plan_items {
  id text [pk]
  budget_period_id text
  account_id text [null]
  source text
  amount int
  is_recurring boolean
}

Table budget_rules {
  id text [pk]
  user_id text
  category_id text
  rule_type text
  value int
  apply_order int
  min_amount int [null]
  cap_amount int [null]
  active_from text [null]
  active_to text [null]
}

Table budget_allocations {
  id text [pk]
  user_id text
  budget_period_id text
  category_id text
  planned_amount int
  generated_from_rule_id text [null]
  is_override boolean
}

Table credit_card_statements {
  id text [pk]
  account_id text
  period_start datetime
  period_end datetime
  closing_date datetime
  due_date datetime
  statement_balance int
  payments_applied int
  status text
}

Table statement_payments {
  id text [pk]
  statement_id text
  transfer_id text
  amount_applied int
}

Table installments {
  id text [pk]
  user_id text
  installment_plan_id text
  installment_number int
  due_date datetime
  amount int
}
```
