# Quick Integration Guide - Add Data Storage to CtType2Results

The issue: **The component is not calling the data storage service!**

## Add These Lines to CtType2Results.tsx

### 1. Import the service (add at top of file, around line 50)
```typescript
import { ctFilingSessionService } from '../services/ctFilingSessionService';
```

### 2. Add session state (in component, after other useState declarations)
```typescript
const [sessionId, setSessionId] = useState<string | null>(null);
const [isSessionLoading, setIsSessionLoading] = useState(false);
```

### 3. Create session when component mounts
```typescript
// Add this useEffect near other useEffects
useEffect(() => {
  const initializeSession = async () => {
    if (!company?.id || !customer?.id || !selectedPeriod?.id) return;
    
    setIsSessionLoading(true);
    try {
      // Try to find existing session first
      const existingSessions = await ctFilingSessionService.listSessions({
        companyId: company.id,
        customerId: customer.id,
        filingPeriodId: selectedPeriod.id,
        status: 'in_progress'
      });

      if (existingSessions.length > 0) {
        // Use existing session
        setSessionId(existingSessions[0].id);
        console.log('✅ Loaded existing session:', existingSessions[0].id);
      } else {
        // Create new session
        const newSession = await ctFilingSessionService.createSession({
          companyId: company.id,
          customerId: customer.id,
          filingPeriodId: selectedPeriod.id,
          currentStep: 1,
          totalSteps: 10,
          status: 'in_progress'
        });
        setSessionId(newSession.id);
        console.log('✅ Created new session:', newSession.id);
      }
    } catch (error) {
      console.error('❌ Error initializing session:', error);
    } finally {
      setIsSessionLoading(false);
    }
  };

  initializeSession();
}, [company?.id, customer?.id, selectedPeriod?.id]);
```

### 4. Save balances when calculated
```typescript
// Add this useEffect after summary is calculated
useEffect(() => {
  const saveBalances = async () => {
    if (!sessionId || !summary) return;

    try {
      await ctFilingSessionService.saveBalances(sessionId, {
        stepNumber: 1,
        stepName: 'Review Categories',
        openingBalance: summary.openingBalance || 0,
        closingBalance: summary.closingBalance || 0,
        totalCount: transactions.length,
        uncategorizedCount: transactions.filter(t => !t.category).length,
        filesCount: uploadedFiles?.length || 0,
        currency: 'AED'
      });
      console.log('✅ Balances saved');
    } catch (error) {
      console.error('❌ Error saving balances:', error);
    }
  };

  saveBalances();
}, [sessionId, summary, transactions.length]);
```

### 5. Save transactions when they're loaded/categorized
```typescript
// Add this useEffect after transactions are processed
useEffect(() => {
  const saveTransactions = async () => {
    if (!sessionId || transactions.length === 0) return;

    try {
      const txData = transactions.map(t => ({
        date: t.date,
        description: t.description || '',
        debit: t.debit || 0,
        credit: t.credit || 0,
        currency: 'AED',
        category: t.category,
        isCategorized: !!t.category,
        originalCategory: t.originalCategory,
        userModified: t.userModified || false
      }));

      await ctFilingSessionService.bulkSaveTransactions(sessionId, txData);
      console.log('✅ Transactions saved:', transactions.length);
    } catch (error) {
      console.error('❌ Error saving transactions:', error);
    }
  };

  // Only save after transactions are loaded (add a flag to prevent repeated saves)
  if (sessionId && transactions.length > 0) {
    saveTransactions();
  }
}, [sessionId, transactions]);
```

### 6. Update transaction when category changes
```typescript
// In your handleCategoryChange function (or wherever you update categories)
const handleCategoryChange = async (transactionId: string, newCategory: string) => {
  // Update local state first
  setTransactions(prev => prev.map(t => 
    t.id === transactionId 
      ? { ...t, category: newCategory, userModified: true }
      : t
  ));

  // Save to database
  try {
    await ctFilingSessionService.updateTransaction(transactionId, {
      category: newCategory,
      isCategorized: true,
      userModified: true
    });
    console.log('✅ Category updated in database');
  } catch (error) {
    console.error('❌ Error updating category:', error);
  }
};
```

---

## Testing

After adding the code:

1. **Open browser DevTools** (F12) → Console tab
2. **Load Type 2 workflow**
3. **Look for these console logs:**
   - ✅ "Created new session: [uuid]" or "Loaded existing session: [uuid]"
   - ✅ "Balances saved"
   - ✅ "Transactions saved: [count]"

4. **Check database:**
```sql
-- Should see your session
SELECT * FROM ct_filing_typetwo ORDER BY created_at DESC LIMIT 1;

-- Should see balances
SELECT * FROM ct_filing_step_balances ORDER BY created_at DESC LIMIT 1;

-- Should see transactions
SELECT COUNT(*) FROM ct_filing_transactions;
```

---

## Quick Copy-Paste Version

Just add these to your CtType2Results component:

```typescript
// 1. Import (top of file)
import { ctFilingSessionService } from '../services/ctFilingSessionService';

// 2. State (with other useState)
const [sessionId, setSessionId] = useState<string | null>(null);

// 3. Initialize session (with other useEffects)
useEffect(() => {
  const init = async () => {
    if (!company?.id || !customer?.id || !selectedPeriod?.id) return;
    try {
      const sessions = await ctFilingSessionService.listSessions({
        companyId: company.id,
        customerId: customer.id,
        filingPeriodId: selectedPeriod.id,
        status: 'in_progress'
      });
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
      } else {
        const s = await ctFilingSessionService.createSession({
          companyId: company.id,
          customerId: customer.id,
          filingPeriodId: selectedPeriod.id
        });
        setSessionId(s.id);
      }
    } catch (e) { console.error(e); }
  };
  init();
}, [company?.id, customer?.id, selectedPeriod?.id]);

// 4. Save data when ready
useEffect(() => {
  if (!sessionId || !summary) return;
  ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 1,
    stepName: 'Review Categories',
    openingBalance: summary.openingBalance || 0,
    closingBalance: summary.closingBalance || 0,
    totalCount: transactions.length,
    uncategorizedCount: transactions.filter(t => !t.category).length,
    filesCount: 1
  }).catch(console.error);
}, [sessionId, summary]);
```

That's it! Data will now save automatically! 🎉
