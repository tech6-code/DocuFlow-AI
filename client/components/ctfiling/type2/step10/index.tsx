import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step10: React.FC = () => {
    const {
        ProfitAndLossStep,
        handleContinueToBalanceSheet,
        handleBack,
        pnlDisplayData,
        pnlStructure,
        handlePnlInputChange,
        handleExportStepPnl,
        handleAddPnlAccount,
        pnlWorkingNotes,
        handleUpdatePnlWorkingNote
    } = useCtType2StepContext();

    return (
        <ProfitAndLossStep
            onNext={handleContinueToBalanceSheet}
            onBack={handleBack}
            data={pnlDisplayData}
            structure={pnlStructure}
            onChange={handlePnlInputChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );
};
