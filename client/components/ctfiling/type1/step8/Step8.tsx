import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { BalanceSheetStep } from '../../../BalanceSheetStep';
import { CtType1Context } from '../types';

export const Step8: React.FC = () => {
    const {
        handleContinueToLOU,
        handleBack,
        computedValues,
        bsStructure,
        handleBalanceSheetChange,
        handleExportStepBS,
        handleAddBsAccount,
        bsWorkingNotes,
        handleUpdateBsWorkingNote
    } = useOutletContext<CtType1Context>();

    return (
        <BalanceSheetStep
            onNext={handleContinueToLOU}
            onBack={handleBack}
            data={computedValues.bs}
            structure={bsStructure}
            onChange={handleBalanceSheetChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );
};
