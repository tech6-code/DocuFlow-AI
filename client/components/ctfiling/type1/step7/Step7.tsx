import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ProfitAndLossStep } from '../../../ProfitAndLossStep';
import { CtType1Context } from '../types';

export const Step7: React.FC = () => {
    const {
        handleContinueToBalanceSheet,
        handleBack,
        computedValues,
        pnlStructure,
        handlePnlChange,
        handleExportStepPnl,
        handleAddPnlAccount,
        pnlWorkingNotes,
        handleUpdatePnlWorkingNote
    } = useOutletContext<CtType1Context>();

    return (
        <ProfitAndLossStep
            onNext={handleContinueToBalanceSheet}
            onBack={handleBack}
            data={computedValues.pnl}
            structure={pnlStructure}
            onChange={handlePnlChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );
};
