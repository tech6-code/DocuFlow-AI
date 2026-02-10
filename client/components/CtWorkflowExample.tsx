import React, { useState, useEffect } from 'react';
import { useCtWorkflow } from '../hooks/useCtWorkflow';

interface Props {
    customerId: string;
    ctTypeId: string;
    periodId: string;
}

/**
 * CtWorkflowExample
 * 
 * This component demonstrates how to use the useCtWorkflow hook to persist
 * data for each step in a multi-step Corporate Tax filing process.
 * 
 * Design Decisions:
 * 1. Single Table Design: All steps are stored in a single table 'ct_workflow_data'
 *    keyed by (period_id, ct_type_id, step_key).
 * 2. Hook-based Logic: useCtWorkflow abstracts API calls and local state management.
 * 3. Auto-save Pattern: Data is saved when the user moves to the next step.
 * 4. Authorization: The backend ensures users only touch their own data (unless Super Admin).
 */
export const CtWorkflowExample: React.FC<Props> = ({ customerId, ctTypeId, periodId }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const { saveStep, getStepData, loading, error } = useCtWorkflow({
        customerId,
        ctTypeId,
        periodId
    });

    // Local state for the current step's form data
    const [formData, setFormData] = useState<any>({});

    // When the component loads or step changes, hydrate formData from persisted workflow data
    useEffect(() => {
        const persisted = getStepData(`step_${currentStep}`);
        if (persisted) {
            setFormData(persisted.data);
        } else {
            setFormData({}); // Reset if no data found for this step
        }
    }, [currentStep, getStepData]);

    const handleNext = async () => {
        // Save current step data before moving forward
        try {
            await saveStep(
                `step_${currentStep}`, // Unique key for this step
                currentStep,           // Step number for ordering
                formData,              // The JSON data for this step
                'draft'                // Status
            );
            setCurrentStep((prev) => prev + 1);
        } catch (err) {
            alert("Failed to save progress. Please try again.");
        }
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(1, prev - 1));
    };

    if (loading) return <div>Loading workflow data...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-white">CT Filing Workflow - Step {currentStep}</h2>

            {/* Dynamic Form Content based on currentStep */}
            <div className="space-y-4 mb-6">
                {currentStep === 1 && (
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Taxable Person Name</label>
                        <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Operating Revenue (AED)</label>
                        <input
                            type="number"
                            className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                            value={formData.revenue || ''}
                            onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                        />
                    </div>
                )}

                {/* Add more steps as needed... */}
            </div>

            <div className="flex justify-between">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="px-4 py-2 bg-slate-700 text-white rounded disabled:opacity-50"
                >
                    Back
                </button>
                <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                >
                    {currentStep === 15 ? 'Submit' : 'Next Step'}
                </button>
            </div>

            <p className="mt-4 text-xs text-slate-500 italic">
                * Navigation automatically saves your progress to the backend.
            </p>
        </div>
    );
};
