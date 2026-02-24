import React from 'react';
import { GenericDocumentPage } from './GenericDocumentPage';
import { PassportUpload } from '../components/PassportUpload';

export const PassportPage: React.FC = () => {
    return (
        <GenericDocumentPage
            documentType="Passport"
            title="Passport"
            UploadComponent={PassportUpload}
        />
    );
};
