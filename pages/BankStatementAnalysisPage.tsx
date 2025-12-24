import React from 'react';
import { BankStatementAnalysis } from '../components/BankStatementAnalysis';
import { useData } from '../contexts/DataContext';
import { analyzeTransactions } from '../services/geminiService';

export const BankStatementAnalysisPage: React.FC = () => {
    const { documentHistory, updateHistoryItem, deleteHistoryItem } = useData();
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [analysisError, setAnalysisError] = React.useState<string | null>(null);

    const handleAnalyzeHistoryItem = async (historyItemId: string, transactionsToAnalyze: any[]) => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeTransactions(transactionsToAnalyze);
            const historyItem = documentHistory.find(i => i.id === historyItemId);
            if (historyItem) {
                updateHistoryItem({ ...historyItem, analysis: result.analysis, transactions: result.categorizedTransactions });
            }
        } catch (err: any) {
            setAnalysisError(err.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <BankStatementAnalysis
            documentHistory={documentHistory}
            onUpdateHistoryItem={updateHistoryItem}
            onDeleteHistoryItem={deleteHistoryItem}
            onAnalyzeTransactions={handleAnalyzeHistoryItem}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
        />
    );
};
