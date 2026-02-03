import React from 'react';
import { useCtType2 } from '../Layout';
import {
    FolderIcon, DocumentArrowDownIcon, ChevronDownIcon, ChevronRightIcon, DocumentTextIcon
} from '../../../icons';
import { formatWholeNumber } from '../types';
import { BalanceSheetStep, BS_ITEMS } from '../../../BalanceSheetStep';

export const Step11: React.FC = () => {
    const {
        balanceSheetValues,
        handleBalanceSheetValueChange,
        bsWorkingNotes,
        toggleWorkingNote,
        handleExportStep11BS,
        setCurrentStep,
        handleBack
    } = useCtType2();

    return (
        <BalanceSheetStep
            data={balanceSheetValues}
            onChange={handleBalanceSheetValueChange}
            workingNotes={bsWorkingNotes}
            onToggleNote={toggleWorkingNote}
            onExport={handleExportStep11BS}
            onNext={() => setCurrentStep(12)}
            onBack={handleBack}
            items={BS_ITEMS}
        />
    );
};
