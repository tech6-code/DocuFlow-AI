
import React from 'react';
import { useCtType3 } from '../types';
import { ProfitAndLossStep, ProfitAndLossItem } from '../../../ProfitAndLossStep';
import { WorkingNoteEntry } from '../../../../types';
import * as XLSX from 'xlsx';

export const Step5: React.FC = () => {
    const {
        pnlValues,
        setPnlValues,
        pnlStructure,
        setPnlStructure,
        pnlWorkingNotes,
        setPnlWorkingNotes,
        setCurrentStep,
        handleBack,
        companyName
    } = useCtType3();

    const handlePnlChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setPnlValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleAddPnlAccount = (item: ProfitAndLossItem & { sectionId: string }) => {
        setPnlStructure(prev => {
            const index = prev.findIndex(i => i.id === item.sectionId);
            if (index === -1) return prev;
            const newStructure = [...prev];
            newStructure.splice(index + 1, 0, { ...item, type: 'item', isEditable: true });
            return newStructure;
        });
    };

    const handleUpdatePnlWorkingNote = (id: string, notes: WorkingNoteEntry[]) => {
        setPnlWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const currentTotal = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
        setPnlValues(prev => ({
            ...prev,
            [id]: {
                currentYear: currentTotal,
                previousYear: previousTotal
            }
        }));
    };

    const applySheetStyling = (worksheet: any, headerRows: number) => {
        // Placeholder
    };

    const handleExportStepPnl = () => {
        const wb = XLSX.utils.book_new();
        const data = pnlStructure.map(item => ({
            'Item': item.label,
            'Current Year (AED)': pnlValues[item.id]?.currentYear || 0,
            'Previous Year (AED)': pnlValues[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Profit and Loss");

        const pnlNotesItems: any[] = [];
        Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = pnlStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    pnlNotesItems.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });

        if (pnlNotesItems.length > 0) {
            const notesWs = XLSX.utils.json_to_sheet(pnlNotesItems);
            notesWs['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, notesWs, "Working Notes");
        }

        XLSX.writeFile(wb, `${companyName}_ProfitAndLoss.xlsx`);
    };

    return (
        <ProfitAndLossStep
            onNext={() => setCurrentStep(6)}
            onBack={handleBack}
            data={pnlValues}
            structure={pnlStructure}
            onChange={handlePnlChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );
};
