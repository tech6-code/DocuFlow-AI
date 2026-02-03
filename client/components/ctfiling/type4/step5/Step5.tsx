
import React from 'react';
import { useCtType4 } from '../types';
import { BalanceSheetStep, BalanceSheetItem } from '../../../BalanceSheetStep';
import { WorkingNoteEntry } from '../../../../types';
import * as XLSX from 'xlsx';

export const Step5: React.FC = () => {
    const {
        balanceSheetValues,
        setBalanceSheetValues,
        bsStructure,
        setBsStructure,
        bsWorkingNotes,
        setBsWorkingNotes,
        setCurrentStep,
        companyName
    } = useCtType4();

    const handleBalanceSheetChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setBalanceSheetValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleAddBsAccount = (item: BalanceSheetItem & { sectionId: string }) => {
        setBsStructure(prev => {
            const index = prev.findIndex(i => i.id === item.sectionId);
            if (index === -1) return prev;
            const newStructure = [...prev];
            newStructure.splice(index + 1, 0, { ...item, type: 'item', isEditable: true });
            return newStructure;
        });
    };

    const handleUpdateBsWorkingNote = (id: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const currentTotal = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
        setBalanceSheetValues(prev => ({
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

    const handleExportStepBS = () => {
        const wb = XLSX.utils.book_new();
        const data = bsStructure.map(item => ({
            'Item': item.label,
            'Current Year (AED)': balanceSheetValues[item.id]?.currentYear || 0,
            'Previous Year (AED)': balanceSheetValues[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");

        const bsNotesItems: any[] = [];
        Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = bsStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    bsNotesItems.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });

        if (bsNotesItems.length > 0) {
            const notesWs = XLSX.utils.json_to_sheet(bsNotesItems);
            notesWs['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, notesWs, "Working Notes");
        }

        XLSX.writeFile(wb, `${companyName}_BalanceSheet.xlsx`);
    };

    return (
        <BalanceSheetStep
            onNext={() => setCurrentStep(6)} // To LOU (Step 6)
            onBack={() => setCurrentStep(4)} // Back to P&L (Step 4)
            data={balanceSheetValues}
            structure={bsStructure}
            onChange={handleBalanceSheetChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );
};
