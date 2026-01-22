
import React from 'react';
import { FileUpload } from './FileUpload';

interface UploadComponentProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  previewUrls: string[];
  pdfPassword: string;
  onPasswordChange: (password: string) => void;
  onProcess?: () => void;
}

export const BankStatementUpload: React.FC<UploadComponentProps> = (props) => (
  <FileUpload 
    {...props} 
    title="Upload Bank Statement" 
    subtitle="Upload PDF or Image statements for analysis."
    uploadButtonText="Add Bank Statement"
  />
);

export const EmiratesIdUpload: React.FC<UploadComponentProps> = (props) => (
  <FileUpload 
    {...props} 
    title="Upload Emirates ID" 
    subtitle="Upload the front and back of the Emirates ID card."
    uploadButtonText="Add Emirates ID"
  />
);

export const PassportUpload: React.FC<UploadComponentProps> = (props) => (
  <FileUpload 
    {...props} 
    title="Upload Passport" 
    subtitle="Upload the main identity page of the passport."
    uploadButtonText="Add Passport"
  />
);

export const VisaUpload: React.FC<UploadComponentProps> = (props) => (
  <FileUpload 
    {...props} 
    title="Upload Visa" 
    subtitle="Upload a valid residence or visit visa document."
    uploadButtonText="Add Visa"
  />
);

export const TradeLicenseUpload: React.FC<UploadComponentProps> = (props) => (
  <FileUpload 
    {...props} 
    title="Upload Trade License" 
    subtitle="Upload the company trade license document."
    uploadButtonText="Add Trade License"
  />
);
