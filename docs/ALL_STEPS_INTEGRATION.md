# Complete Type 2 Workflow Data Storage Integration

## Overview

This guide shows how to save data for **ALL** Type 2 workflow steps, not just step 1.

## Type 2 Workflow Steps

Based on typical CT Filing Type 2 workflow:

1. **Step 1: Review Categories** - Bank statement transactions with categorization
2. **Step 2: Invoice Processing** - Upload and process invoices
3. **Step 3: Match Transactions** - Match bank transactions with invoices
4. **Step 4: Trial Balance** - Generate and review trial balance
5. **Step 5: Adjustments** - Make accounting adjustments
6. **Step 6: Financial Statements** - Generate P&L and Balance Sheet
7. **Step 7: Working Notes** - Add working notes and explanations
8. **Step 8: Tax Computation** - Calculate tax liabilities
9. **Step 9: Review & Submit** - Final review before submission
10. **Step 10: Submission** - Submit to authorities

---

## Implementation for Each Step

### Step 1: Review Categories (Bank Transactions)

**Data to Save:**
- Opening/Closing balances → `ct_filing_step_balances`
- All transactions with categories → `ct_filing_transactions`

```typescript
// After processing bank statement
useEffect(() => {
  if (!sessionId || !summary) return;
  
  // Save balances
  ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 1,
    stepName: 'Review Categories',
    openingBalance: summary.openingBalance || 0,
    closingBalance: summary.closingBalance || 0,
    totalCount: transactions.length,
    uncategorizedCount: transactions.filter(t => !t.category).length,
    filesCount: uploadedFiles?.length || 0,
    currency: 'AED'
  });
  
  // Save transactions
  if (transactions.length > 0) {
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
    ctFilingSessionService.bulkSaveTransactions(sessionId, txData);
  }
}, [sessionId, summary, transactions]);
```

---

### Step 2: Invoice Processing

**Data to Save:**
- Invoice data → `ct_filing_step_data`
- Invoice totals → `ct_filing_step_balances`

```typescript
// When invoices are processed
const saveInvoiceData = async () => {
  if (!sessionId || !invoices) return;

  // Save invoice details
  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 2,
    stepName: 'Invoice Processing',
    data: {
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.number,
        date: inv.date,
        vendor: inv.vendor,
        amount: inv.amount,
        category: inv.category,
        status: inv.status
      })),
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      processedDate: new Date().toISOString()
    }
  });

  // Save totals in balances
  await ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 2,
    stepName: 'Invoice Processing',
    openingBalance: 0,
    closingBalance: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    totalCount: invoices.length,
    uncategorizedCount: invoices.filter(i => !i.category).length,
    filesCount: invoices.length,
    currency: 'AED'
  });
};
```

---

### Step 3: Match Transactions with Invoices

**Data to Save:**
- Matched pairs → `ct_filing_step_data`
- Match statistics → `ct_filing_step_balances`

```typescript
const saveMatchingData = async () => {
  if (!sessionId || !matches) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 3,
    stepName: 'Match Transactions',
    data: {
      matches: matches.map(m => ({
        transactionId: m.transactionId,
        invoiceId: m.invoiceId,
        matchType: m.type, // 'exact', 'partial', 'manual'
        confidence: m.confidence,
        amount: m.amount
      })),
      unmatchedTransactions: unmatchedTransactions.length,
      unmatchedInvoices: unmatchedInvoices.length
    }
  });

  // Save match statistics
  await ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 3,
    stepName: 'Match Transactions',
    openingBalance: 0,
    closingBalance: 0,
    totalCount: matches.length,
    uncategorizedCount: unmatchedTransactions.length + unmatchedInvoices.length,
    filesCount: 0,
    currency: 'AED'
  });
};
```

---

### Step 4: Trial Balance

**Data to Save:**
- Trial balance entries → `ct_filing_step_data`
- Balance totals → `ct_filing_step_balances`

```typescript
const saveTrialBalance = async () => {
  if (!sessionId || !trialBalance) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 4,
    stepName: 'Trial Balance',
    data: {
      entries: trialBalance.map(entry => ({
        accountCode: entry.code,
        accountName: entry.name,
        debit: entry.debit,
        credit: entry.credit,
        balance: entry.balance
      })),
      totalDebit: trialBalance.reduce((sum, e) => sum + e.debit, 0),
      totalCredit: trialBalance.reduce((sum, e) => sum + e.credit, 0),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    }
  });

  await ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 4,
    stepName: 'Trial Balance',
    openingBalance: trialBalance.reduce((sum, e) => sum + e.debit, 0),
    closingBalance: trialBalance.reduce((sum, e) => sum + e.credit, 0),
    totalCount: trialBalance.length,
    uncategorizedCount: 0,
    filesCount: 0,
    currency: 'AED'
  });
};
```

---

### Step 5: Adjustments

**Data to Save:**
- Adjustment entries → `ct_filing_step_data`

```typescript
const saveAdjustments = async () => {
  if (!sessionId || !adjustments) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 5,
    stepName: 'Adjustments',
    data: {
      adjustments: adjustments.map(adj => ({
        id: adj.id,
        date: adj.date,
        description: adj.description,
        debitAccount: adj.debitAccount,
        creditAccount: adj.creditAccount,
        amount: adj.amount,
        reason: adj.reason,
        approvedBy: adj.approvedBy
      })),
      totalAdjustments: adjustments.length,
      totalAmount: adjustments.reduce((sum, a) => sum + a.amount, 0)
    }
  });
};
```

---

### Step 6: Financial Statements

**Data to Save:**
- P&L statement → `ct_filing_step_data`
- Balance sheet → `ct_filing_step_data`

```typescript
const saveFinancialStatements = async () => {
  if (!sessionId || !financialStatements) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 6,
    stepName: 'Financial Statements',
    data: {
      profitAndLoss: {
        revenue: financialStatements.revenue,
        expenses: financialStatements.expenses,
        netIncome: financialStatements.netIncome,
        breakdown: financialStatements.pnlBreakdown
      },
      balanceSheet: {
        assets: financialStatements.assets,
        liabilities: financialStatements.liabilities,
        equity: financialStatements.equity,
        breakdown: financialStatements.bsBreakdown
      },
      ratios: {
        currentRatio: financialStatements.currentRatio,
        debtRatio: financialStatements.debtRatio,
        profitMargin: financialStatements.profitMargin
      }
    }
  });
};
```

---

### Step 7: Working Notes

**Data to Save:**
- Working notes → `ct_filing_step_data`

```typescript
const saveWorkingNotes = async () => {
  if (!sessionId || !workingNotes) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 7,
    stepName: 'Working Notes',
    data: {
      notes: workingNotes.map(note => ({
        id: note.id,
        section: note.section, // 'P&L', 'Balance Sheet', 'General'
        accountName: note.accountName,
        noteText: note.text,
        amount: note.amount,
        attachments: note.attachments
      })),
      totalNotes: workingNotes.length
    }
  });
};
```

---

### Step 8: Tax Computation

**Data to Save:**
- Tax calculations → `ct_filing_step_data`
- Tax amounts → `ct_filing_step_balances`

```typescript
const saveTaxComputation = async () => {
  if (!sessionId || !taxComputation) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 8,
    stepName: 'Tax Computation',
    data: {
      taxableIncome: taxComputation.taxableIncome,
      taxRate: taxComputation.taxRate,
      taxAmount: taxComputation.taxAmount,
      adjustments: taxComputation.adjustments,
      deductions: taxComputation.deductions,
      credits: taxComputation.credits,
      netTaxDue: taxComputation.netTaxDue
    }
  });

  await ctFilingSessionService.saveBalances(sessionId, {
    stepNumber: 8,
    stepName: 'Tax Computation',
    openingBalance: taxComputation.taxableIncome,
    closingBalance: taxComputation.netTaxDue,
    totalCount: 1,
    uncategorizedCount: 0,
    filesCount: 0,
    currency: 'AED'
  });
};
```

---

### Step 9: Review & Submit

**Data to Save:**
- Review checklist → `ct_filing_step_data`
- Validation results → `ct_filing_step_data`

```typescript
const saveReviewData = async () => {
  if (!sessionId || !reviewChecklist) return;

  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 9,
    stepName: 'Review & Submit',
    data: {
      checklist: reviewChecklist.map(item => ({
        item: item.name,
        completed: item.completed,
        reviewer: item.reviewer,
        reviewDate: item.reviewDate,
        notes: item.notes
      })),
      validationErrors: validationErrors,
      allChecksPass: validationErrors.length === 0,
      reviewedBy: currentUser.name,
      reviewDate: new Date().toISOString()
    }
  });
};
```

---

### Step 10: Submission

**Data to Save:**
- Submission details → `ct_filing_step_data`
- Update session status → `ct_filing_typetwo`

```typescript
const submitFiling = async () => {
  if (!sessionId) return;

  // Save submission details
  await ctFilingSessionService.saveStepData(sessionId, {
    stepNumber: 10,
    stepName: 'Submission',
    data: {
      submittedAt: new Date().toISOString(),
      submittedBy: currentUser.name,
      submissionMethod: 'electronic',
      confirmationNumber: confirmationNumber,
      attachments: submittedDocuments.map(d => d.filename)
    }
  });

  // Update session to completed
  await ctFilingSessionService.updateSession(sessionId, {
    currentStep: 10,
    status: 'completed'
    // completed_at is auto-set by database trigger
  });
};
```

---

## Master Integration Code

Add this to your `CtType2Results.tsx` to handle ALL steps:

```typescript
import { ctFilingSessionService } from '../services/ctFilingSessionService';
import { useState, useEffect } from 'react';

// ... in component

const [sessionId, setSessionId] = useState<string | null>(null);
const [currentStep, setCurrentStep] = useState(1);

// Initialize session
useEffect(() => {
  const initSession = async () => {
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
        setCurrentStep(sessions[0].currentStep || 1);
      } else {
        const newSession = await ctFilingSessionService.createSession({
          companyId: company.id,
          customerId: customer.id,
          filingPeriodId: selectedPeriod.id,
          currentStep: 1,
          totalSteps: 10
        });
        setSessionId(newSession.id);
      }
    } catch (error) {
      console.error('Session init error:', error);
    }
  };
  
  initSession();
}, [company?.id, customer?.id, selectedPeriod?.id]);

// Update session step when user changes step
const handleStepChange = async (newStep: number) => {
  setCurrentStep(newStep);
  
  if (sessionId) {
    await ctFilingSessionService.updateSession(sessionId, {
      currentStep: newStep,
      status: newStep === 10 ? 'completed' : 'in_progress'
    });
  }
};

// Auto-save for each step (add these useEffects)
// Step 1
useEffect(() => {
  if (currentStep === 1 && sessionId && summary) {
    // Save balances and transactions (code from above)
  }
}, [currentStep, sessionId, summary, transactions]);

// Step 2  
useEffect(() => {
  if (currentStep === 2 && sessionId && invoices) {
    // Save invoice data (code from above)
  }
}, [currentStep, sessionId, invoices]);

// ... add similar useEffects for steps 3-10
```

---

## Quick Summary

**Data Storage Pattern:**

1. **Session Creation** → Creates record in `ct_filing_typetwo`
2. **Each Step** → Saves to `ct_filing_step_data` (JSON data)
3. **Financial Data** → Saves to `ct_filing_step_balances` (balances/totals)
4. **Transactions** → Saves to `ct_filing_transactions` (individual records)
5. **Completion** → Updates `status` to 'completed' with `completed_at` timestamp

All data is linked via `ct_type_id` (session ID) foreign key!
