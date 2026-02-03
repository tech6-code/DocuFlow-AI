import React from 'react';
import { useCtType2 } from '../Layout';
import {
    FolderIcon, DocumentArrowDownIcon, ChevronDownIcon, ChevronRightIcon, DocumentTextIcon
} from '../../../icons';
import { formatWholeNumber } from '../types';
import { ProfitAndLossStep, PNL_ITEMS } from '../../../ProfitAndLossStep';

export const Step10: React.FC = () => {
    const {
        pnlValues,
        handlePnlValueChange,
        pnlWorkingNotes,
        toggleWorkingNote,
        handleExportStep10PnL,
        setCurrentStep,
        handleBack
    } = useCtType2();

    return (
        <ProfitAndLossStep
            data={pnlValues}
            onChange={handlePnlValueChange}
            workingNotes={pnlWorkingNotes}
            onToggleNote={toggleWorkingNote}
            onExport={handleExportStep10PnL}
            onNext={() => setCurrentStep(11)}
            onBack={handleBack}
            items={PNL_ITEMS}
        />
    );
};
