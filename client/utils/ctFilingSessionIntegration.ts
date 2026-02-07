import { useEffect, useState } from 'react';
import { ctFilingSessionService, CtFilingSession } from '../services/ctFilingSessionService';

/**
 * Example integration for CT Filing Type 2 component
 * This shows how to integrate the CT Filing Session service
 */

// Example 1: Create a session when component mounts
export function useCtFilingSession(
    companyId: string,
    customerId: string,
    filingPeriodId: string
) {
    const [session, setSession] = useState<CtFilingSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeSession = async () => {
            try {
                setLoading(true);

                // Try to find existing session
                const existingSessions = await ctFilingSessionService.listSessions({
                    companyId,
                    customerId,
                    filingPeriodId,
                    status: 'in_progress'
                });

                if (existingSessions.length > 0) {
                    // Use existing session
                    setSession(existingSessions[0]);
                } else {
                    // Create new session
                    const newSession = await ctFilingSessionService.createSession({
                        companyId,
                        customerId,
                        filingPeriodId,
                        currentStep: 1,
                        totalSteps: 10,
                        status: 'in_progress'
                    });
                    setSession(newSession);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (companyId && customerId && filingPeriodId) {
            initializeSession();
        }
    }, [companyId, customerId, filingPeriodId]);

    return { session, loading, error };
}

// Example 2: Save balances after processing bank statements
export async function saveStepBalances(
    sessionId: string,
    openingBalance: number,
    closingBalance: number,
    totalCount: number,
    uncategorizedCount: number,
    filesCount: number
) {
    try {
        await ctFilingSessionService.saveBalances(sessionId, {
            stepNumber: 1,
            stepName: 'Review Categories',
            openingBalance,
            closingBalance,
            totalCount,
            uncategorizedCount,
            filesCount,
            currency: 'AED'
        });
        console.log('Balances saved successfully');
    } catch (error) {
        console.error('Error saving balances:', error);
    }
}

// Example 3: Save transactions with categories
export async function saveTransactionData(
    sessionId: string,
    transactions: Array<{
        date: string;
        description: string;
        debit: number;
        credit: number;
        category?: string;
        originalCategory?: string;
    }>
) {
    try {
        await ctFilingSessionService.bulkSaveTransactions(
            sessionId,
            transactions.map(t => ({
                date: t.date,
                description: t.description,
                debit: t.debit,
                credit: t.credit,
                currency: 'AED',
                category: t.category,
                isCategorized: !!t.category,
                originalCategory: t.originalCategory,
                userModified: t.category !== t.originalCategory
            }))
        );
        console.log('Transactions saved successfully');
    } catch (error) {
        console.error('Error saving transactions:', error);
    }
}

// Example 4: Update transaction category when user modifies it
export async function updateTransactionCategory(
    transactionId: string,
    newCategory: string
) {
    try {
        await ctFilingSessionService.updateTransaction(transactionId, {
            category: newCategory,
            isCategorized: true,
            userModified: true
        });
        console.log('Transaction category updated');
    } catch (error) {
        console.error('Error updating category:', error);
    }
}

// Example 5: Update session progress
export async function updateSessionProgress(
    sessionId: string,
    currentStep: number,
    status: 'in_progress' | 'completed' | 'review' | 'submitted' | 'cancelled'
) {
    try {
        await ctFilingSessionService.updateSession(sessionId, {
            currentStep,
            status
        });
        console.log('Session progress updated');
    } catch (error) {
        console.error('Error updating session:', error);
    }
}

// Example 6: Save generic step data
export async function saveStepData(
    sessionId: string,
    stepNumber: number,
    stepName: string,
    data: any
) {
    try {
        await ctFilingSessionService.saveStepData(sessionId, {
            stepNumber,
            stepName,
            data
        });
        console.log('Step data saved');
    } catch (error) {
        console.error('Error saving step data:', error);
    }
}

// Example usage in CtType2Results component:
/*
function CtType2Results({ company, customer, filingPeriod, ... }) {
  // Initialize session
  const { session, loading, error } = useCtFilingSession(
    company.id,
    customer.id,
    filingPeriod.id
  );

  useEffect(() => {
    if (session && summary) {
      // Save balances when calculated
      saveStepBalances(
        session.id,
        summary.openingBalance,
        summary.closingBalance,
        transactions.length,
        uncategorizedTransactions.length,
        uploadedFiles.length
      );
    }
  }, [session, summary]);

  useEffect(() => {
    if (session && transactions.length > 0) {
      // Save transactions when loaded
      saveTransactionData(session.id, transactions);
    }
  }, [session, transactions]);

  const handleCategoryChange = (transactionId: string, newCategory: string) => {
    // Update local state
    setTransactions(prev => ...);
    
    // Update in database
    updateTransactionCategory(transactionId, newCategory);
  };

  const handleStepChange = (newStep: number) => {
    setCurrentStep(newStep);
    
    // Update session progress
    if (session) {
      updateSessionProgress(session.id, newStep, 'in_progress');
    }
  };

  // ... rest of component
}
*/
