import React from 'react';
import { GenericDocumentPage } from './GenericDocumentPage';
import { TradeLicenseUpload } from '../components/TradeLicenseUpload';

export const TradeLicensePage: React.FC = () => {
    return (
        <GenericDocumentPage
            documentType="TradeLicense"
            title="Trade License"
            UploadComponent={TradeLicenseUpload}
        />
    );
};
