import { useState, useEffect, useCallback } from "react";
import { ctFilingService } from "../services/ctFilingService";
import { CtWorkflowData } from "../types";

interface UseCtWorkflowProps {
    conversionId: string | null;
}

/**
 * Custom hook to manage Corporate Tax (CT) workflow persistence.
 * This hook handles fetching all step data on mount and provide a save function
 * to persist step-level data to the backend.
 */
export function useCtWorkflow({ conversionId }: UseCtWorkflowProps) {
    const [workflowData, setWorkflowData] = useState<CtWorkflowData[]>([]);
    const [conversionDetails, setConversionDetails] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all steps for this specific conversion
    const fetchWorkflowData = useCallback(async () => {
        if (!conversionId) {
            setWorkflowData([]);
            setConversionDetails(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await ctFilingService.getWorkflowData(conversionId);
            setConversionDetails(result);
            setWorkflowData(result.steps || []);
            setError(null);
        } catch (err: any) {
            console.error("Failed to fetch CT workflow data:", err);
            setError(err.message || "Failed to load workflow data");
        } finally {
            setLoading(false);
        }
    }, [conversionId]);

    useEffect(() => {
        fetchWorkflowData();
    }, [fetchWorkflowData]);

    /**
     * Saves or updates data for a specific workflow step.
     * Performs an UPSERT in the backend and updates local state.
     */
    const saveStep = async (
        stepKey: string,
        stepNumber: number,
        data: any,
        status: "draft" | "completed" | "submitted" = "draft"
    ) => {
        if (!conversionId) throw new Error("No conversion ID provided");

        try {
            const result = await ctFilingService.saveStepData({
                conversionId,
                stepNumber,
                stepKey,
                data,
                status
            });

            // Update local state by replacing the existing step or adding it if new
            setWorkflowData((prev) => {
                const index = prev.findIndex((s) => s.stepKey === stepKey);
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = result;
                    return updated;
                }
                return [...prev, result];
            });

            return result;
        } catch (err: any) {
            console.error(`Failed to save step ${stepKey}:`, err);
            throw err;
        }
    };

    /**
     * Helper to get data for a specific step from the local state.
     */
    const getStepData = (stepKey: string) => {
        return workflowData.find((s) => s.stepKey === stepKey);
    };

    return {
        workflowData,
        conversionDetails,
        loading,
        error,
        saveStep,
        getStepData,
        refresh: fetchWorkflowData
    };
}
