# Complete CRUD Operations Guide - Type 2 Workflow

## ✅ Full CRUD Now Available!

All data types now support **Create, Read, Update, and Delete** operations:

- ✅ **Sessions** - Full CRUD
- ✅ **Balances** - Full CRUD  
- ✅ **Transactions** - Full CRUD
- ✅ **Step Data** - Full CRUD

---

## Backend API Endpoints (Complete)

### Sessions
```
GET    /api/ct-filing-typetwo/sessions              → List all sessions
GET    /api/ct-filing-typetwo/sessions/:id          → Get one session
POST   /api/ct-filing-typetwo/sessions              → Create session
PUT    /api/ct-filing-typetwo/sessions/:id          → Update session
DELETE /api/ct-filing-typetwo/sessions/:id          → Delete session
```

### Balances
```
GET    /api/ct-filing-typetwo/sessions/:id/balances/:step  → Get balances
POST   /api/ct-filing-typetwo/sessions/:id/balances        → Save balances
DELETE /api/ct-filing-typetwo/sessions/:id/balances/:step  → Delete balances
```

### Transactions
```
GET    /api/ct-filing-typetwo/sessions/:id/transactions         → Get all transactions
POST   /api/ct-filing-typetwo/sessions/:id/transactions/bulk    → Bulk save
PUT    /api/ct-filing-typetwo/transactions/:txId                → Update one
DELETE /api/ct-filing-typetwo/transactions/:txId                → Delete one
DELETE /api/ct-filing-typetwo/sessions/:id/transactions         → Delete all
```

### Step Data
```
GET    /api/ct-filing-typetwo/sessions/:id/step-data/:step  → Get step data
POST   /api/ct-filing-typetwo/sessions/:id/step-data        → Save step data
DELETE /api/ct-filing-typetwo/sessions/:id/step-data/:step  → Delete step data
```

---

## Frontend Service Methods (Complete)

### Sessions
```typescript
// Create
const session = await ctFilingSessionService.createSession({...});

// Read
const sessions = await ctFilingSessionService.listSessions({...});
const session = await ctFilingSessionService.getSession(sessionId);

// Update
await ctFilingSessionService.updateSession(sessionId, {...});

// Delete
await ctFilingSessionService.deleteSession(sessionId);
```

### Balances
```typescript
// Create/Update (upsert)
await ctFilingSessionService.saveBalances(sessionId, {...});

// Read
const balances = await ctFilingSessionService.getBalances(sessionId, stepNumber);

// Delete
await ctFilingSessionService.deleteBalances(sessionId, stepNumber);
```

### Transactions
```typescript
// Create
await ctFilingSessionService.bulkSaveTransactions(sessionId, [...]);

// Read
const transactions = await ctFilingSessionService.getTransactions(sessionId);

// Update 
await ctFilingSessionService.updateTransaction(transactionId, {...});

// Delete one
await ctFilingSessionService.deleteTransaction(transactionId);

// Delete all for session
await ctFilingSessionService.deleteAllTransactions(sessionId);
```

### Step Data
```typescript
// Create/Update (upsert)
await ctFilingSessionService.saveStepData(sessionId, {...});

// Read
const data = await ctFilingSessionService.getStepData(sessionId, stepNumber);

// Delete
await ctFilingSessionService.deleteStepData(sessionId, stepNumber);
```

---

## UI Integration Examples

### Example 1: Edit Transaction Category

```typescript
const handleEditCategory = async (transactionId: string newCategory: string) => {
  try {
    // Update UI optimistically
    setTransactions(prev => prev.map(t => 
      t.id === transactionId 
        ? { ...t, category: newCategory, userModified: true }
        : t
    ));

    // Save to database
    await ctFilingSessionService.updateTransaction(transactionId, {
      category: newCategory,
      isCategorized: true,
      userModified: true
    });

    toast.success('Category updated!');
  } catch (error) {
    // Revert on error
    toast.error('Failed to update category');
    console.error(error);
  }
};

// In your JSX
<select 
  value={transaction.category}
  onChange={(e) => handleEditCategory(transaction.id, e.target.value)}
>
  <option value="">Select category...</option>
  <option value="Revenue">Revenue</option>
  <option value="Expense - Rent">Rent Expense</option>
  {/* ... more categories */}
</select>
```

---

### Example 2: Delete Single Transaction

```typescript
const handleDeleteTransaction = async (transactionId: string) => {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    return;
  }

  try {
    // Update UI optimistically
    setTransactions(prev => prev.filter(t => t.id !== transactionId));

    // Delete from database
    await ctFilingSessionService.deleteTransaction(transactionId);

    toast.success('Transaction deleted!');
  } catch (error) {
    toast.error('Failed to delete transaction');
    console.error(error);
  }
};

// In your JSX
<button 
  onClick={() => handleDeleteTransaction(transaction.id)}
  className="text-red-600 hover:text-red-800"
>
  <TrashIcon className="w-5 h-5" />
</button>
```

---

### Example 3: Edit Session Status

```typescript
const handleChangeStatus = async (newStatus: 'in_progress' | 'completed' | 'review' | 'submitted' | 'cancelled') => {
  try {
    await ctFilingSessionService.updateSession(sessionId, {
      status: newStatus
    });

    setSession(prev => ({ ...prev, status: newStatus }));
    toast.success(`Status changed to ${newStatus}`);
  } catch (error) {
    toast.error('Failed to update status');
  }
};

// In your JSX
<select 
  value={session?.status}
  onChange={(e) => handleChangeStatus(e.target.value)}
>
  <option value="in_progress">In Progress</option>
  <option value="review">Under Review</option>
  <option value="completed">Completed</option>
  <option value="submitted">Submitted</option>
  <option value="cancelled">Cancelled</option>
</select>
```

---

### Example 4: Delete All Transactions (Reset Step)

```typescript
const handleResetStep1 = async () => {
  if (!confirm('Delete all transactions? This cannot be undone!')) {
    return;
  }

  try {
    // Delete all transactions
    await ctFilingSessionService.deleteAllTransactions(sessionId);

    // Also delete balances
    await ctFilingSessionService.deleteBalances(sessionId, 1);

    // Clear UI
    setTransactions([]);
    setSummary(null);

    toast.success('Step 1 data cleared');
  } catch (error) {
    toast.error('Failed to clear data');
  }
};

// In your JSX
<button 
  onClick={handleResetStep1}
  className="px-4 py-2 bg-red-600 text-white rounded"
>
  Reset Step 1
</button>
```

---

### Example 5: Edit Balance (Re-process)

```typescript
const handleUpdateBalance = async () => {
  try {
    await ctFilingSessionService.saveBalances(sessionId, {
      stepNumber: 1,
      stepName: 'Review Categories',
      openingBalance: newOpeningBalance, // Updated value
      closingBalance: newClosingBalance, // Updated value
      totalCount: transactions.length,
      uncategorizedCount: uncategorizedCount,
      filesCount: files.length,
      currency: 'AED'
    });

    toast.success('Balances updated!');
  } catch (error) {
    toast.error('Failed to update balances');
  }
};
```

---

### Example 6: Delete Entire Session

```typescript
const handleDeleteSession = async () => {
  if (!confirm('Delete this entire filing session? All related data will be deleted!')) {
    return;
  }

  try {
    await ctFilingSessionService.deleteSession(sessionId);
    
    // Navigate back to sessions list
    navigate('/ct-filing/sessions');
    
    toast.success('Session deleted');
  } catch (error) {
    toast.error('Failed to delete session');
  }
};
```

---

### Example 7: Edit Step Data (Update Invoice)

```typescript
const handleUpdateInvoiceData = async () => {
  try {
    // Update existing step 2 data
    await ctFilingSessionService.saveStepData(sessionId, {
      stepNumber: 2,
      stepName: 'Invoice Processing',
      data: {
        invoices: updatedInvoices, // Modified array
        totalInvoices: updatedInvoices.length,
        totalAmount: updatedInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        lastModified: new Date().toISOString()
      }
    });

    toast.success('Invoice data updated!');
  } catch (error) {
    toast.error('Failed to update invoice data');
  }
};
```

---

### Example 8: Batch Update Transactions

```typescript
const handleBatchUpdateCategories = async (updates: Array<{ id: string, category: string }>) => {
  try {
    // Update each transaction
    await Promise.all(
      updates.map(({ id, category }) => 
        ctFilingSessionService.updateTransaction(id, {
          category,
          isCategorized: true,
          userModified: true
        })
      )
    );

    // Update UI
    setTransactions(prev => prev.map(t => {
      const update = updates.find(u => u.id === t.id);
      return update ? { ...t, category: update.category, userModified: true } : t;
    }));

    toast.success(`Updated ${updates.length} transactions`);
  } catch (error) {
    toast.error('Batch update failed');
  }
};
```

---

## Complete Component Example with Full CRUD

```typescript
import { useState, useEffect } from 'react';
import { ctFilingSessionService } from '../services/ctFilingSessionService';

function TransactionManager({ sessionId }) {
  const [transactions, setTransactions] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // CREATE - Load transactions
  useEffect(() => {
    const loadTransactions = async () => {
      const data = await ctFilingSessionService.getTransactions(sessionId);
      setTransactions(data);
    };
    loadTransactions();
  }, [sessionId]);

  // UPDATE - Edit category
  const handleUpdate = async (id, category) => {
    await ctFilingSessionService.updateTransaction(id, { category });
    setTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, category } : t
    ));
    setEditingId(null);
  };

  // DELETE - Remove transaction
  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await ctFilingSessionService.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Category</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(tx => (
          <tr key={tx.id}>
            <td>{tx.date}</td>
            <td>{tx.description}</td>
            <td>{tx.debit || tx.credit}</td>
            <td>
              {editingId === tx.id ? (
                <input
                  value={tx.category}
                  onChange={(e) => handleUpdate(tx.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  autoFocus
                />
              ) : (
                <span onClick={() => setEditingId(tx.id)}>
                  {tx.category || 'Uncategorized'}
                </span>
              )}
            </td>
            <td>
              <button onClick={() => setEditingId(tx.id)}>Edit</button>
              <button onClick={() => handleDelete(tx.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Key Features

### 🎯 Optimistic UI Updates
Update UI immediately, then save to database. Revert on error.

### ⚡ Auto-save
Save changes automatically on blur/timeout.

### 🔒 Confirmation Dialogs
Always confirm destructive actions (deletes).

### 🔄 Cascade Deletes
Database handles cascading deletes via foreign keys:
- Delete session → deletes all balances, transactions, step data
- Delete balance → only that step's balance
- Delete transaction → only that transaction
- Delete step data → only that step's data

### 📝 Audit Trail
All updates set `updated_at` timestamp automatically.

---

## Summary

✅ **Backend**: All CRUD routes implemented  
✅ **Frontend**: All CRUD methods in service  
✅ **UI Examples**: Edit & Delete patterns ready to use  
✅ **Cascade Deletes**: Database handles cleanup automatically  

You now have complete control over all Type 2 workflow data!
