import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step11: React.FC = () => {
    const {
        BalanceSheetStep,
        handleContinueToLOU,
        handleBack,
        bsDisplayData,
        bsStructure,
        handleBalanceSheetInputChange,
        handleExportStepBS,
        handleAddBsAccount,
        bsWorkingNotes,
        handleUpdateBsWorkingNote
    } = useCtType2StepContext();

    return (
        <BalanceSheetStep
            onNext={handleContinueToLOU}
            onBack={handleBack}
            data={bsDisplayData}
            structure={bsStructure}
            onChange={handleBalanceSheetInputChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );
};
