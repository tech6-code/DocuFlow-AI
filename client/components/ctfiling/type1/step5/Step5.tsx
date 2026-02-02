import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { OpeningBalancesType1 } from '../../../OpeningBalancesType1';
import { CtType1Context } from '../types';

export const Step5: React.FC = () => {
    const {
        handleOpeningBalancesComplete,
        handleBack,
        currency,
        openingBalancesData,
        setOpeningBalancesData,
        handleExportOpeningBalances,
        openingBalanceFiles,
        setOpeningBalanceFiles,
        handleExtractOpeningBalances,
        isExtractingOpeningBalances,
        company
    } = useOutletContext<CtType1Context>();

    return (
        <div className="space-y-6">
            <OpeningBalancesType1
                onComplete={handleOpeningBalancesComplete}
                onBack={handleBack}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={handleExportOpeningBalances}
                selectedFiles={openingBalanceFiles}
                onFilesSelect={setOpeningBalanceFiles}
                onExtract={handleExtractOpeningBalances}
                isExtracting={isExtractingOpeningBalances}
                companyName={company?.name}
                periodStart={company?.ctPeriodStart}
                periodEnd={company?.ctPeriodEnd}
            />
        </div>
    );
};
