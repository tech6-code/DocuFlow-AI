import React, { createContext, useContext } from 'react';

type CtType2StepContextValue = Record<string, any>;

const CtType2StepContext = createContext<CtType2StepContextValue | null>(null);

export const CtType2StepProvider = CtType2StepContext.Provider;

export const useCtType2StepContext = () => {
    const context = useContext(CtType2StepContext);
    if (!context) {
        throw new Error('useCtType2StepContext must be used within CtType2StepProvider');
    }
    return context;
};
