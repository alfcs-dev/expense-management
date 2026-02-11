# Database Schema Visualization

This document contains the Mermaid ER diagram for the Budget Manager database, including the support for split purchases (Meses Sin Intereses - MSI).

## Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : owns
    USER ||--o{ BUDGET : owns
    USER ||--o{ TRANSFER : initiates
    USER ||--o{ BUDGET_COLLABORATOR : participates

    ACCOUNT ||--o{ EXPENSE : pays_for
    ACCOUNT ||--o{ INSTALLMENT_PLAN : "auto-pays"
    
    BUDGET ||--o{ CATEGORY : contains
    BUDGET ||--o{ EXPENSE : tracks
    BUDGET ||--o{ INSTALLMENT_PLAN : "future_impact"

    CATEGORY ||--o{ EXPENSE : categorizes
    CATEGORY ||--o{ INSTALLMENT_PLAN : "groups_plan"

    INSTALLMENT_PLAN ||--o{ EXPENSE : generates
    
    USER {
        string id PK
        string email UK
    }

    ACCOUNT {
        string id PK
        string accountName
        string type "Debit/Credit"
        string CLABE UK
        float balance
    }

    INSTALLMENT_PLAN {
        string id PK
        string description "MacBook MSI"
        float totalAmount
        int months "e.g. 12"
        float interestRate "0.0 for MSI"
        datetime startDate
        string status "active | completed | cancelled"
    }

    EXPENSE {
        string id PK
        string description "Installment 3/12"
        float amount
        datetime date
        string installmentPlanId FK "null if single purchase"
        int installmentNumber "null if single purchase"
    }

    BUDGET {
        string id PK
        string name
    }

    CATEGORY {
        string id PK
        string name
    }

    TRANSFER {
        string id PK
        float amount
        string sourceAccountId FK
        string destinationAccountId FK
    }
```

## Logic for Split Expenses (MSI)

1.  **Orchestration**: The `InstallmentPlan` acts as a parent entity. When created, the system generates $N$ `Expense` records scheduled over the coming months.
2.  **Budgeting**: Individual `Expense` records hit the monthly budget, preventing a single large purchase from "breaking" the budget of the month it was purchased in.
3.  **Debt Tracking**: By querying future expenses linked to an `InstallmentPlan`, the system can calculate the remaining balance of the debt.
4.  **Interest**: Supports both 0% (MSI) and interest-bearing installment plans through the `interestRate` field.
