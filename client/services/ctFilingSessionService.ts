const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function for fetch requests
async function fetchJSON(url: string, options?: RequestInit) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Request failed');
    }

    return response.json();
}

// Session Types
export interface CtFilingSession {
    id?: string;
    companyId: string;
    customerId: string;
    filingPeriodId: string;
    status?: 'in_progress' | 'completed' | 'review' | 'submitted' | 'cancelled';
    currentStep?: number;
    totalSteps?: number;
    metadata?: any;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
}

export interface CtFilingStepBalances {
    id?: string;
    sessionId: string;
    stepNumber: number;
    stepName?: string;
    openingBalance: number;
    closingBalance: number;
    totalCount: number;
    uncategorizedCount: number;
    filesCount: number;
    currency?: string;
    metadata?: any;
}

export interface CtFilingTransaction {
    id?: string;
    sessionId: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    currency?: string;
    category?: string;
    isCategorized?: boolean;
    originalCategory?: string;
    userModified?: boolean;
    metadata?: any;
}

export interface CtFilingStepData {
    id?: string;
    sessionId: string;
    stepNumber: number;
    stepName?: string;
    data: any;
}

// CT Filing Session Service
export const ctFilingSessionService = {
    // Sessions
    async listSessions(filters?: {
        companyId?: string;
        customerId?: string;
        filingPeriodId?: string;
        status?: string;
    }): Promise<CtFilingSession[]> {
        const params = new URLSearchParams();
        if (filters?.companyId) params.append('companyId', filters.companyId);
        if (filters?.customerId) params.append('customerId', filters.customerId);
        if (filters?.filingPeriodId) params.append('filingPeriodId', filters.filingPeriodId);
        if (filters?.status) params.append('status', filters.status);

        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions?${params.toString()}`);
    },

    async getSession(sessionId: string): Promise<CtFilingSession> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}`);
    },

    async createSession(session: CtFilingSession): Promise<CtFilingSession> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions`, {
            method: 'POST',
            body: JSON.stringify(session),
        });
    },

    async updateSession(sessionId: string, updates: Partial<CtFilingSession>): Promise<CtFilingSession> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    async deleteSession(sessionId: string): Promise<void> {
        await fetch(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    },

    // Balances
    async getBalances(sessionId: string, stepNumber: number): Promise<CtFilingStepBalances> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/balances/${stepNumber}`);
    },

    async saveBalances(sessionId: string, balances: Omit<CtFilingStepBalances, 'id' | 'sessionId'>): Promise<CtFilingStepBalances> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/balances`, {
            method: 'POST',
            body: JSON.stringify(balances),
        });
    },

    async deleteBalances(sessionId: string, stepNumber: number): Promise<void> {
        await fetch(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/balances/${stepNumber}`, {
            method: 'DELETE',
        });
    },

    // Transactions
    async getTransactions(sessionId: string): Promise<CtFilingTransaction[]> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/transactions`);
    },

    async bulkSaveTransactions(sessionId: string, transactions: Omit<CtFilingTransaction, 'id' | 'sessionId'>[]): Promise<any> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/transactions/bulk`, {
            method: 'POST',
            body: JSON.stringify({ transactions }),
        });
    },

    async updateTransaction(transactionId: string, updates: Partial<CtFilingTransaction>): Promise<CtFilingTransaction> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/transactions/${transactionId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    async deleteTransaction(transactionId: string): Promise<void> {
        await fetch(`${API_BASE}/ct-filing-typetwo/transactions/${transactionId}`, {
            method: 'DELETE',
        });
    },

    async deleteAllTransactions(sessionId: string): Promise<void> {
        await fetch(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/transactions`, {
            method: 'DELETE',
        });
    },

    // Step Data
    async getStepData(sessionId: string, stepNumber: number): Promise<CtFilingStepData> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/step-data/${stepNumber}`);
    },

    async saveStepData(sessionId: string, stepData: Omit<CtFilingStepData, 'id' | 'sessionId'>): Promise<CtFilingStepData> {
        return fetchJSON(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/step-data`, {
            method: 'POST',
            body: JSON.stringify(stepData),
        });
    },

    async deleteStepData(sessionId: string, stepNumber: number): Promise<void> {
        await fetch(`${API_BASE}/ct-filing-typetwo/sessions/${sessionId}/step-data/${stepNumber}`, {
            method: 'DELETE',
        });
    }
};

