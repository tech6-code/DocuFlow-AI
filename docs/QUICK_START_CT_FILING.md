# Quick Start Guide - CT Filing Type 2 Data Storage

## 1. Apply Database Schema

Run the SQL schema in your Supabase SQL Editor:

```sql
-- File: server/src/database/ctfillingtype_schema.sql
-- Creates 4 tables: ct_filing_typetwo, ct_filing_step_balances, 
-- ct_filing_transactions, ct_filing_step_data
```

Copy and execute the entire contents of `server/src/database/ctfillingtype_schema.sql` in Supabase.

## 2. Server is Ready

The API routes are already registered at:
- `/api/ct-filing-typetwo/*`

Restart your server if it's running:
```bash
cd server
npm run dev
```

## 3. Usage in Type 2 Component

### Import the service:
```typescript
import { ctFilingSessionService } from '../services/ctFilingSessionService';
```

### Create a session:
```typescript
const session = await ctFilingSessionService.createSession({
  companyId: company.id,
  customerId: customer.id,
  ctTypeId: 2,
  filingPeriodId: period.id
});
```

### Save Step 1 balances:
```typescript
await ctFilingSessionService.saveBalances(session.id, {
  stepNumber: 1,
  stepName: 'Review Categories',
  openingBalance: 5967.74,
  closingBalance: 9565.11,
  totalCount: 150,
  uncategorizedCount: 5,
  filesCount: 1
});
```

### Save transactions:
```typescript
await ctFilingSessionService.bulkSaveTransactions(session.id, 
  transactions.map(t => ({
    date: t.date,
    description: t.description,
    debit: t.debit,
    credit: t.credit,
    category: t.category,
    isCategorized: !!t.category
  }))
);
```

### Update transaction category:
```typescript
await ctFilingSessionService.updateTransaction(transactionId, {
  category: 'New Category',
  userModified: true
});
```

## 4. Full Documentation

See `docs/CT_FILING_TYPE2_STORAGE.md` for complete documentation including:
- Database schema details
- All API endpoints
- Integration examples
- React hooks

## Files Created

- ✅ `server/src/database/ctfillingtype_schema.sql`
- ✅ `server/src/routes/ctFilingSessions.ts`
- ✅ `server/src/index.ts` (modified)
- ✅ `client/services/ctFilingSessionService.ts`
- ✅ `client/utils/ctFilingSessionIntegration.ts`
- ✅ `docs/CT_FILING_TYPE2_STORAGE.md`

