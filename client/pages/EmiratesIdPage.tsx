import React from 'react';
import { GenericDocumentPage } from './GenericDocumentPage';
import { EmiratesIdUpload } from '../components/EmiratesIdUpload';

export const EmiratesIdPage: React.FC = () => {
    return (
        <GenericDocumentPage
            documentType="EmiratesID"
            title="Emirates ID"
            UploadComponent={EmiratesIdUpload}
        />
    );
};
