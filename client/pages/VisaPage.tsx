import React from 'react';
import { GenericDocumentPage } from './GenericDocumentPage';
import { VisaUpload } from '../components/VisaUpload';

export const VisaPage: React.FC = () => {
    return (
        <GenericDocumentPage
            documentType="Visa"
            title="Visa"
            UploadComponent={VisaUpload}
        />
    );
};
