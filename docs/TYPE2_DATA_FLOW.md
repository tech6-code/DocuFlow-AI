# Type 2 Data Flow - How Data Gets Saved

## Quick Overview

**Frontend** → **API Routes** → **Database Tables**

---

## Step-by-Step: Saving Type 2 Workflow Data

### Step 1: Create a Session (Start Workflow)

**Frontend Code:**
```typescript
import { ctFilingSessionService } from '../services/ctFilingSessionService';

// When user starts Type 2 workflow
const session = await ctFilingSessionService.createSession({
  companyId: "uuid-of-company",
  customerId: "uuid-of-customer",
  filingPeriodId: "uuid-of-filing-period",
  currentStep: 1,
  totalSteps: 10,
  status: 'in_progress'
});

console.log('Session created:', session.id);
```

**What happens:**
- Frontend calls: `POST /api/ct-filing-typetwo/sessions`
- Backend inserts into: `ct_filing_typetwo` table
- Returns session with ID

**Database Result:**
```sql
-- ct_filing_typetwo table now has:
id: "abc-123-..."
company_id: "uuid-of-company"
customer_id: "uuid-of-customer"
filing_period_id: "uuid-of-filing-period"
status: "in_progress"
current_step: 1
```

---

### Step 2: Save Opening/Closing Balances (Step 1 Data)

**Frontend Code:**
```typescript
// After processing bank statement
await ctFilingSessionService.saveBalances(session.id, {
  stepNumber: 1,
  stepName: 'Review Categories',
  openingBalance: 5967.74,
  closingBalance: 9565.11,
  totalCount: 150,
  uncategorizedCount: 5,
  filesCount: 1,
  currency: 'AED'
});
```

**What happens:**
- Frontend calls: `POST /api/ct-filing-typetwo/sessions/{sessionId}/balances`
- Backend inserts/updates: `ct_filing_step_balances` table

**Database Result:**
```sql
-- ct_filing_step_balances table now has:
id: "xyz-456-..."
ct_type_id: "abc-123-..." (links to session)
step_number: 1
opening_balance: 5967.74
closing_balance: 9565.11
total_count: 150
uncategorized_count: 5
```

---

### Step 3: Save Transactions

**Frontend Code:**
```typescript
// Save all transactions at once
const transactions = [
  {
    date: '2025-07-23',
    description: 'B/O INSIGNIA CHEMICAL TRADING LLC',
    debit: 0,
    credit: 45000.00,
    currency: 'AED',
    category: 'Revenue',
    isCategorized: true
  },
  {
    date: '2025-07-24',
    description: 'RENT PAYMENT',
    debit: 5000.00,
    credit: 0,
    currency: 'AED',
    category: 'Rent Expense',
    isCategorized: true
  }
  // ... more transactions
];

await ctFilingSessionService.bulkSaveTransactions(session.id, transactions);
```

**What happens:**
- Frontend calls: `POST /api/ct-filing-typetwo/sessions/{sessionId}/transactions/bulk`
- Backend inserts to: `ct_filing_transactions` table (multiple rows)

**Database Result:**
```sql
-- ct_filing_transactions table now has:
id: "tx1-..."
ct_type_id: "abc-123-..." (links to session)
transaction_date: "2025-07-23"
description: "B/O INSIGNIA CHEMICAL TRADING LLC"
debit: 0.00
credit: 45000.00
category: "Revenue"
is_categorized: true

id: "tx2-..."
ct_type_id: "abc-123-..."
transaction_date: "2025-07-24"
description: "RENT PAYMENT"
debit: 5000.00
credit: 0.00
category: "Rent Expense"
is_categorized: true
```

---

### Step 4: Update Transaction Category (When User Edits)

**Frontend Code:**
```typescript
// When user changes a category
await ctFilingSessionService.updateTransaction(transactionId, {
  category: 'Fixed Assets',
  isCategorized: true,
  userModified: true
});
```

**What happens:**
- Frontend calls: `PUT /api/ct-filing-typetwo/transactions/{transactionId}`
- Backend updates: specific row in `ct_filing_transactions`

---

### Step 5: Save Generic Step Data (Any Step)

**Frontend Code:**
```typescript
// Save custom data for any step
await ctFilingSessionService.saveStepData(session.id, {
  stepNumber: 3,
  stepName: 'Invoice Processing',
  data: {
    invoices: [...],
    totalAmount: 125000,
    processedCount: 45
  }
});
```

**What happens:**
- Frontend calls: `POST /api/ct-filing-typetwo/sessions/{sessionId}/step-data`
- Backend inserts/updates: `ct_filing_step_data` table

---

### Step 6: Update Session Progress

**Frontend Code:**
```typescript
// When moving to next step
await ctFilingSessionService.updateSession(session.id, {
  currentStep: 2,
  status: 'in_progress'
});

// When completing workflow
await ctFilingSessionService.updateSession(session.id, {
  currentStep: 10,
  status: 'completed'
  // completed_at is auto-set by database trigger
});
```

---

## Complete Integration Example

```typescript
// In your CtType2Results component
import { ctFilingSessionService } from '../services/ctFilingSessionService';
import { useEffect, useState } from 'react';

function CtType2Results({ company, customer, filingPeriod }) {
  const [sessionId, setSessionId] = useState(null);
  
  // 1. Create session on mount
  useEffect(() => {
    const initSession = async () => {
      const session = await ctFilingSessionService.createSession({
        companyId: company.id,
        customerId: customer.id,
        filingPeriodId: filingPeriod.id
      });
      setSessionId(session.id);
    };
    initSession();
  }, []);

  // 2. Save balances when calculated
  useEffect(() => {
    if (sessionId && summary) {
      ctFilingSessionService.saveBalances(sessionId, {
        stepNumber: 1,
        stepName: 'Review Categories',
        openingBalance: summary.openingBalance,
        closingBalance: summary.closingBalance,
        totalCount: transactions.length,
        uncategorizedCount: uncategorizedCount
      });
    }
  }, [sessionId, summary]);

  // 3. Save transactions when loaded
  useEffect(() => {
    if (sessionId && transactions.length > 0) {
      ctFilingSessionService.bulkSaveTransactions(sessionId, transactions);
    }
  }, [sessionId, transactions]);

  // 4. Handle category changes
  const handleCategoryChange = async (txId, newCategory) => {
    // Update UI
    setTransactions(prev => /* update state */);
    
    // Save to database
    await ctFilingSessionService.updateTransaction(txId, {
      category: newCategory,
      userModified: true
    });
  };

  return (
    // Your component JSX
  );
}
```

---

## Database Tables Summary

### `ct_filing_typetwo` (Main Session)
Stores: Session metadata, status, current step

### `ct_filing_step_balances` (Step 1 Balances)
Stores: Opening/closing balances, counts

### `ct_filing_transactions` (All Transactions)
Stores: Each transaction with categorization

### `ct_filing_step_data` (Generic Step Data)
Stores: Any custom data for any step

---

## Quick Reference: API Endpoints

```
POST   /api/ct-filing-typetwo/sessions                     → Create session
GET    /api/ct-filing-typetwo/sessions/:id                 → Get session
PUT    /api/ct-filing-typetwo/sessions/:id                 → Update session

POST   /api/ct-filing-typetwo/sessions/:id/balances        → Save balances
GET    /api/ct-filing-typetwo/sessions/:id/balances/:step  → Get balances

POST   /api/ct-filing-typetwo/sessions/:id/transactions/bulk → Save all transactions
GET    /api/ct-filing-typetwo/sessions/:id/transactions    → Get all transactions
PUT    /api/ct-filing-typetwo/transactions/:txId           → Update one transaction

POST   /api/ct-filing-typetwo/sessions/:id/step-data       → Save step data
GET    /api/ct-filing-typetwo/sessions/:id/step-data/:step → Get step data
```
