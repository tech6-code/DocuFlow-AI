
import React, { useState } from 'react';
import type { Customer, User, ContactPerson, Shareholder, DocumentUploadPayload } from '../types';
import { XMarkIcon, InformationCircleIcon, BanknotesIcon, BuildingOfficeIcon, PlusIcon, TrashIcon, UserCircleIcon, UploadIcon, SparklesIcon, BriefcaseIcon, CheckIcon, PencilIcon } from './icons';
import { extractVatCertificateData, extractCorporateTaxCertificateData, extractBusinessEntityDetails, extractTradeLicenseDetailsForCustomer, extractMoaDetails, LICENSE_AUTHORITIES } from '../services/geminiService';

interface CustomerModalProps {
    customer: Partial<Customer> | null;
    users: User[];
    onSave: (customerData: Omit<Customer, 'id'> | Customer, documents?: DocumentUploadPayload[]) => void;
    onClose: () => void;
    viewOnly?: boolean;
}

interface UploadedDocumentRow {
    id: string;
    type: string;
    file: File | null;
    status: 'idle' | 'extracting' | 'success' | 'error';
}

const TAX_TREATMENTS = [
    'VAT Registered',
    'Non VAT Registered',
    'VAT Registered - Designated Zone',
    'Non VAT Registered - Designated Zone',
    'GCC VAT Registered',
    'GCC Non VAT Registered'
];

const CORP_TAX_TREATMENTS = [
    'Corporate Tax Registered',
    'Not Registered'
];

const ENTITY_TYPES = [
    'Legal Person - Incorporated (LLC)',
    'Legal Person - Foreign Business',
    'Legal Person - Club/ Association/ Society',
    'Legal Person - Charity',
    'Legal Person - Federal Government Entity',
    'Legal Person - Emirate Government Entity',
    'Legal Person - Other',
    'Partnership'
];

const ENTITY_SUB_TYPES = [
    'UAE Private Company (Incl. an Establishment)',
    'Public Joint Stock Company',
    'Foundation',
    'Trust'
];

const PLACES_OF_SUPPLY = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss.', 'Dr.'];
const DOCUMENT_TYPES = [
    'Trade License',
    'Memorandum of Association',
    'Certificate of Incorporation',
    'Passport',
    'Emirates ID',
    'Other'
];

const fileToPart = (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            // Infer mime type if missing
            let mimeType = file.type;
            if (!mimeType && file.name.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
            } else if (!mimeType && (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg'))) {
                mimeType = 'image/jpeg';
            } else if (!mimeType && file.name.toLowerCase().endsWith('.png')) {
                mimeType = 'image/png';
            }
            
            resolve({ inlineData: { data: base64, mimeType: mimeType || 'image/jpeg' } });
        };
        reader.onerror = reject;
    });
};

const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.startDate && val.endDate) return `${val.startDate} - ${val.endDate}`;
        if (val.start && val.end) return `${val.start} - ${val.end}`;
        return ''; 
    }
    return '';
};

// Robust helper to convert various date string formats to YYYY-MM-DD
const convertToIsoDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    const cleanStr = dateStr.trim();

    // 1. Check if already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;

    // 2. Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // 3. Try Generic Date Parse (handles "12 Jan 2023", "Jan 12, 2023", "12-May-2023")
    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        try {
            return date.toISOString().split('T')[0];
        } catch (e) {
            // fallback
        }
    }

    // Return empty if parsing failed, rather than invalid string that might break inputs
    return ''; 
};

const OtherDocumentInputModal = ({ 
    isOpen, 
    onSave, 
    onCancel 
}: { 
    isOpen: boolean; 
    onSave: (name: string) => void; 
    onCancel: () => void; 
}) => {
    const [name, setName] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl w-full max-w-sm p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Enter Document Name</h3>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tenancy Contract"
                    className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 mb-4"
                    autoFocus
                />
                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-300 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            if (name.trim()) onSave(name);
                        }}
                        disabled={!name.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const FormRow = ({ label, children, helpText, required, viewOnly }: { label: string, children?: React.ReactNode, helpText?: string, required?: boolean, viewOnly?: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start py-4 border-b border-gray-800 last:border-0">
        <div className="md:col-span-1 pt-2">
            <label className="block text-sm font-medium text-gray-300">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
        </div>
        <div className="md:col-span-2">
            {children}
        </div>
    </div>
);

export const CustomerModal: React.FC<CustomerModalProps> = ({ customer, users, onSave, onClose, viewOnly = false }) => {
    const [activeTab, setActiveTab] = useState<'business' | 'tax' | 'contact' | 'remarks'>('business');
    const [isExtractingVat, setIsExtractingVat] = useState(false);
    const [isExtractingCt, setIsExtractingCt] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Document Upload State
    const [documentRows, setDocumentRows] = useState<UploadedDocumentRow[]>([
        { id: '1', type: 'Trade License', file: null, status: 'idle' }
    ]);
    
    // Custom Document Modal State
    const [customDocModalOpen, setCustomDocModalOpen] = useState(false);
    const [customDocIndex, setCustomDocIndex] = useState<number | null>(null);
    
    const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
        type: customer?.type || 'business',
        salutation: customer?.salutation || '',
        firstName: customer?.firstName || '',
        lastName: customer?.lastName || '',
        companyName: customer?.companyName || '',
        email: customer?.email || '',
        workPhone: customer?.workPhone || '',
        mobile: customer?.mobile || '',
        currency: customer?.currency || 'AED',
        language: customer?.language || 'English',
        billingAddress: customer?.billingAddress || '',
        shippingAddress: customer?.shippingAddress || '',
        remarks: customer?.remarks || '',
        
        // Business Details
        entityType: customer?.entityType || '',
        entitySubType: customer?.entitySubType || '',
        incorporationDate: customer?.incorporationDate || '',
        tradeLicenseAuthority: customer?.tradeLicenseAuthority || '',
        tradeLicenseNumber: customer?.tradeLicenseNumber || '',
        tradeLicenseIssueDate: customer?.tradeLicenseIssueDate || '',
        tradeLicenseExpiryDate: customer?.tradeLicenseExpiryDate || '',
        businessActivity: customer?.businessActivity || '',
        isFreezone: customer?.isFreezone || false,
        freezoneName: customer?.freezoneName || '',
        shareholders: customer?.shareholders || [],
        authorisedSignatories: customer?.authorisedSignatories || '',
        shareCapital: customer?.shareCapital || '',

        // Tax & Financials
        taxTreatment: customer?.taxTreatment || 'Non VAT Registered',
        trn: customer?.trn || '',
        vatRegisteredDate: customer?.vatRegisteredDate || '',
        firstVatFilingPeriod: customer?.firstVatFilingPeriod || '',
        vatFilingDueDate: customer?.vatFilingDueDate || '',
        vatReportingPeriod: customer?.vatReportingPeriod || 'Quarterly',
        corporateTaxTreatment: customer?.corporateTaxTreatment || 'Not Registered',
        corporateTaxTrn: customer?.corporateTaxTrn || '',
        corporateTaxRegisteredDate: customer?.corporateTaxRegisteredDate || '',
        corporateTaxPeriod: customer?.corporateTaxPeriod || '',
        firstCorporateTaxPeriodStart: customer?.firstCorporateTaxPeriodStart || '',
        firstCorporateTaxPeriodEnd: customer?.firstCorporateTaxPeriodEnd || '',
        corporateTaxFilingDueDate: customer?.corporateTaxFilingDueDate || '',
        businessRegistrationNumber: customer?.businessRegistrationNumber || '',
        placeOfSupply: customer?.placeOfSupply || 'Dubai',
        openingBalance: customer?.openingBalance || 0,
        paymentTerms: customer?.paymentTerms || 'Due on Receipt',
        ownerId: customer?.ownerId || '',
        portalAccess: customer?.portalAccess || false,
        contactPersons: customer?.contactPersons || [],
    });

    const isEditing = !!customer?.id;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (viewOnly) return;
        const { name, value, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (viewOnly) return;
        
        if (formData.type === 'business' && !formData.companyName?.trim()) {
            alert("Company Name is required for Business customers.");
            setActiveTab('business');
            return;
        }

        setIsSaving(true);
        try {
            // Collect files that need to be uploaded
            const documentsToUpload: DocumentUploadPayload[] = documentRows
                .filter(row => row.file !== null)
                .map(row => ({
                    documentType: row.type,
                    file: row.file!
                }));

            if (isEditing) {
                await onSave({ ...customer, ...formData } as Customer, documentsToUpload);
            } else {
                await onSave(formData, documentsToUpload);
            }
            onClose();
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save customer. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleContactPersonChange = (index: number, field: keyof ContactPerson, value: string) => {
        if (viewOnly) return;
        const updatedContacts = [...(formData.contactPersons || [])];
        updatedContacts[index] = { ...updatedContacts[index], [field]: value };
        setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
    };

    const handleAddContactPerson = () => {
        if (viewOnly) return;
        setFormData(prev => ({
            ...prev,
            contactPersons: [...(prev.contactPersons || []), { salutation: '', firstName: '', lastName: '', email: '', workPhone: '', mobile: '' }]
        }));
    };

    const handleRemoveContactPerson = (index: number) => {
        if (viewOnly) return;
        const updatedContacts = [...(formData.contactPersons || [])];
        updatedContacts.splice(index, 1);
        setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
    };

    const handleShareholderChange = (index: number, field: keyof Shareholder, value: string | number) => {
        if (viewOnly) return;
        const updatedShareholders = [...(formData.shareholders || [])];
        updatedShareholders[index] = { ...updatedShareholders[index], [field]: value };
        setFormData(prev => ({ ...prev, shareholders: updatedShareholders }));
    };

    const handleAddShareholder = () => {
        if (viewOnly) return;
        setFormData(prev => ({
            ...prev,
            shareholders: [...(prev.shareholders || []), { ownerType: 'Individual', name: '', nationality: '', percentage: 0 }]
        }));
    };

    const handleRemoveShareholder = (index: number) => {
        if (viewOnly) return;
        const updatedShareholders = [...(formData.shareholders || [])];
        updatedShareholders.splice(index, 1);
        setFormData(prev => ({ ...prev, shareholders: updatedShareholders }));
    };

    const addDocumentRow = () => {
        setDocumentRows(prev => [...prev, { id: Date.now().toString(), type: 'Trade License', file: null, status: 'idle' }]);
    };

    const removeDocumentRow = (index: number) => {
        setDocumentRows(prev => prev.filter((_, i) => i !== index));
    };

    const updateDocumentType = (index: number, newType: string) => {
        setDocumentRows(prev => {
            const updated = [...prev];
            updated[index].type = newType;
            return updated;
        });
    };

    const handleCustomDocSave = (name: string) => {
        if (customDocIndex !== null) {
            updateDocumentType(customDocIndex, name);
        }
        setCustomDocModalOpen(false);
        setCustomDocIndex(null);
    };

    const handleCustomDocCancel = () => {
        if (customDocIndex !== null) {
            updateDocumentType(customDocIndex, 'Trade License');
        }
        setCustomDocModalOpen(false);
        setCustomDocIndex(null);
    };

    // Modified handleDocumentFileChange
    const handleDocumentFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (viewOnly) return;
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const docType = documentRows[index].type;
            
            setDocumentRows(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], file: file, status: 'extracting' };
                return updated;
            });

            // If it's a known document type for extraction, try to extract.
            // Otherwise just mark as success (uploaded).
            if (['Trade License', 'Memorandum of Association'].includes(docType) || docType.includes('Certificate')) {
                try {
                    const part = await fileToPart(file);
                    let extracted: any = null;

                    if (docType === 'Trade License') {
                        extracted = await extractTradeLicenseDetailsForCustomer([part]);
                    } else if (docType === 'Memorandum of Association') {
                        extracted = await extractMoaDetails([part]);
                    } else {
                        extracted = await extractBusinessEntityDetails([part]);
                    }
                    
                    if (extracted) {
                        // Merge extracted data
                        setFormData(prev => {
                            const newData = { ...prev };

                            if (docType === 'Trade License') {
                                newData.companyName = prev.companyName || safeString(extracted.companyName);
                                newData.entityType = prev.entityType || safeString(extracted.entityType);
                                newData.entitySubType = prev.entitySubType || safeString(extracted.entitySubType);
                                newData.incorporationDate = prev.incorporationDate || convertToIsoDate(safeString(extracted.incorporationDate));
                                newData.tradeLicenseAuthority = prev.tradeLicenseAuthority || safeString(extracted.tradeLicenseAuthority);
                                newData.tradeLicenseNumber = prev.tradeLicenseNumber || safeString(extracted.tradeLicenseNumber);
                                newData.tradeLicenseIssueDate = prev.tradeLicenseIssueDate || convertToIsoDate(safeString(extracted.tradeLicenseIssueDate));
                                newData.tradeLicenseExpiryDate = prev.tradeLicenseExpiryDate || convertToIsoDate(safeString(extracted.tradeLicenseExpiryDate));
                                newData.businessActivity = prev.businessActivity || safeString(extracted.businessActivity);
                                newData.isFreezone = prev.isFreezone ? true : (extracted.isFreezone ?? false);
                                newData.freezoneName = prev.freezoneName || safeString(extracted.freezoneName);
                            } else if (docType === 'Memorandum of Association') {
                                if (Array.isArray(extracted.shareholders) && extracted.shareholders.length > 0) {
                                    if (!prev.shareholders || prev.shareholders.length === 0) {
                                        newData.shareholders = extracted.shareholders;
                                    }
                                }
                                newData.authorisedSignatories = prev.authorisedSignatories || safeString(extracted.authorisedSignatories);
                                newData.shareCapital = prev.shareCapital || (extracted.shareCapital ? String(extracted.shareCapital) : '');
                            } else {
                                // Generic Fallback
                                newData.companyName = prev.companyName || safeString(extracted.companyName);
                                newData.entityType = prev.entityType || safeString(extracted.entityType);
                                // ... map other fields liberally
                            }

                            return newData;
                        });
                    }
                } catch (err) {
                    console.error("Extraction warning", err);
                    // Don't fail the upload just because extraction failed
                }
            }
            
            // Mark as success (meaning file is selected and ready to upload on save)
            setDocumentRows(prev => {
                const updated = [...prev];
                updated[index].status = 'success';
                return updated;
            });
        }
    };

    const handleVatCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (viewOnly) return;
        if (e.target.files && e.target.files.length > 0) {
            setIsExtractingVat(true);
            try {
                const file = e.target.files[0];
                const part = await fileToPart(file);
                const extracted = await extractVatCertificateData([part]);
                
                if (extracted) {
                    setFormData(prev => ({
                        ...prev,
                        trn: extracted.trn ? safeString(extracted.trn) : prev.trn,
                        vatRegisteredDate: extracted.vatRegisteredDate ? safeString(extracted.vatRegisteredDate) : prev.vatRegisteredDate,
                        firstVatFilingPeriod: extracted.firstVatReturnPeriod ? safeString(extracted.firstVatReturnPeriod) : prev.firstVatFilingPeriod,
                        vatFilingDueDate: extracted.vatReturnDueDate ? safeString(extracted.vatReturnDueDate) : prev.vatFilingDueDate,
                        companyName: extracted.companyName ? safeString(extracted.companyName) : prev.companyName
                    }));
                }
            } catch (err) {
                console.error("Failed to extract VAT certificate", err);
                alert("Failed to extract data from VAT Certificate.");
            } finally {
                setIsExtractingVat(false);
            }
        }
    };

    const handleCtCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsExtractingCt(true);
            try {
                const file = e.target.files[0];
                const part = await fileToPart(file);
                const extracted = await extractCorporateTaxCertificateData([part]);
                
                if (extracted) {
                    setFormData(prev => ({
                        ...prev,
                        corporateTaxTrn: extracted.corporateTaxTrn ? safeString(extracted.corporateTaxTrn) : prev.corporateTaxTrn,
                        corporateTaxRegisteredDate: extracted.corporateTaxRegisteredDate ? safeString(extracted.corporateTaxRegisteredDate) : prev.corporateTaxRegisteredDate,
                        firstCorporateTaxPeriodStart: extracted.firstCorporateTaxPeriodStart ? safeString(extracted.firstCorporateTaxPeriodStart) : prev.firstCorporateTaxPeriodStart,
                        firstCorporateTaxPeriodEnd: extracted.firstCorporateTaxPeriodEnd ? safeString(extracted.firstCorporateTaxPeriodEnd) : prev.firstCorporateTaxPeriodEnd,
                        corporateTaxFilingDueDate: extracted.corporateTaxFilingDueDate ? safeString(extracted.corporateTaxFilingDueDate) : prev.corporateTaxFilingDueDate,
                        companyName: extracted.companyName ? safeString(extracted.companyName) : prev.companyName
                    }));
                }
            } catch (err) {
                console.error("Failed to extract CT certificate", err);
                alert("Failed to extract data from CT Certificate.");
            } finally {
                setIsExtractingCt(false);
            }
        }
    };

    const isVatRegistered = formData.taxTreatment?.includes('VAT Registered') && !formData.taxTreatment?.includes('Non');
    const isNonVat = formData.taxTreatment?.includes('Non');
    const isCorporateTaxRegistered = formData.corporateTaxTreatment === 'Corporate Tax Registered';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-950 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-gray-800">
               <div className="px-8 py-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h3 className="text-xl font-semibold text-white">
                        {viewOnly ? 'Customer Details' : (isEditing ? 'Edit Customer' : 'New Customer')}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-800 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <form id="customer-form" onSubmit={handleSubmit} className="space-y-2 max-w-4xl mx-auto">
                        <fieldset disabled={viewOnly || isSaving} className="contents">
                            <FormRow label="Customer Type" helpText="Select if the customer is a business or individual" viewOnly={viewOnly}>
                                <div className="flex items-center space-x-6">
                                    <label className="flex items-center cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="customerTypeGroup" 
                                            value="business" 
                                            checked={formData.type === 'business'} 
                                            onChange={() => setFormData(prev => ({ ...prev, type: 'business' }))}
                                            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-600 accent-blue-600"
                                        />
                                        <span className="ml-2 text-white">Business</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="customerTypeGroup" 
                                            value="individual" 
                                            checked={formData.type === 'individual'} 
                                            onChange={() => setFormData(prev => ({ ...prev, type: 'individual' }))}
                                            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-600 accent-blue-600"
                                        />
                                        <span className="ml-2 text-white">Individual</span>
                                    </label>
                                </div>
                            </FormRow>
                            
                            {formData.type === 'business' && (
                                 <FormRow label="Company Name" required viewOnly={viewOnly}>
                                    <input 
                                        type="text" 
                                        name="companyName" 
                                        value={formData.companyName} 
                                        onChange={handleChange}
                                        required={!viewOnly}
                                        className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                    />
                                </FormRow>
                            )}

                            <FormRow label="Primary Contact" viewOnly={viewOnly}>
                                <div className="flex gap-3">
                                    <select 
                                        name="salutation" 
                                        value={formData.salutation} 
                                        onChange={handleChange}
                                        className="w-24 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70"
                                    >
                                        <option value="">Salutation</option>
                                        {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input 
                                        type="text" 
                                        name="firstName" 
                                        placeholder="First Name" 
                                        value={formData.firstName} 
                                        onChange={handleChange}
                                        className="flex-1 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                    />
                                    <input 
                                        type="text" 
                                        name="lastName" 
                                        placeholder="Last Name" 
                                        value={formData.lastName} 
                                        onChange={handleChange}
                                        className="flex-1 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                    />
                                </div>
                            </FormRow>
                            
                            <FormRow label="Email Address" viewOnly={viewOnly}>
                                 <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleChange}
                                    className="w-full md:w-2/3 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                />
                            </FormRow>

                            <FormRow label="Phone" viewOnly={viewOnly}>
                                <div className="flex gap-3 w-full md:w-2/3">
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500 text-xs">Work</span>
                                        <input 
                                            type="tel" 
                                            name="workPhone" 
                                            value={formData.workPhone} 
                                            onChange={handleChange}
                                            className="w-full pl-12 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500 text-xs">Mobile</span>
                                        <input 
                                            type="tel" 
                                            name="mobile" 
                                            value={formData.mobile} 
                                            onChange={handleChange}
                                            className="w-full pl-14 p-2.5 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" 
                                        />
                                    </div>
                                </div>
                            </FormRow>
                        </fieldset>

                        <div className="mt-8 mb-6 border-b border-gray-700 flex space-x-1">
                            {['Business Details', 'Tax & Financials', 'Contact Persons', 'Remarks'].map((tab) => {
                                const key = tab === 'Business Details' ? 'business' : tab === 'Tax & Financials' ? 'tax' : tab.toLowerCase().split(' ')[0];
                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(key as any)}
                                        className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                                            activeTab === key 
                                                ? 'text-white bg-gray-800 border-b-2 border-blue-500' 
                                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                )
                            })}
                        </div>
                        
                        <fieldset disabled={viewOnly || isSaving} className="contents">
                            <div className="py-4">
                                {activeTab === 'business' && (
                                    <div className="space-y-8">
                                        {!viewOnly && (
                                            <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                                <div className="flex items-center mb-4 pb-2 border-b border-gray-700/50 justify-between">
                                                    <div className="flex items-center">
                                                        <UploadIcon className="w-5 h-5 text-blue-400 mr-2"/>
                                                        <h4 className="text-white font-semibold">Document Upload</h4>
                                                    </div>
                                                    <button type="button" onClick={addDocumentRow} className="text-xs flex items-center text-blue-400 hover:text-blue-300 font-medium">
                                                        <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add Document
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    {documentRows.map((doc, index) => (
                                                        <div key={doc.id} className="flex flex-col md:flex-row gap-4 items-start bg-gray-800 p-3 rounded-lg border border-gray-700">
                                                            <div className="w-full md:w-1/3">
                                                                <label className="block text-xs text-gray-500 mb-1">Document Type</label>
                                                                {!DOCUMENT_TYPES.includes(doc.type) ? (
                                                                    <div className="flex items-center w-full bg-gray-900 border border-gray-600 rounded text-white text-xs p-2">
                                                                        <span className="flex-1 truncate">{doc.type}</span>
                                                                        <button onClick={() => updateDocumentType(index, 'Trade License')} className="ml-2 text-gray-400 hover:text-white"><PencilIcon className="w-3.5 h-3.5" /></button>
                                                                    </div>
                                                                ) : (
                                                                    <select value={doc.type} onChange={(e) => { const val = e.target.value; if (val === 'Other') { setCustomDocIndex(index); setCustomDocModalOpen(true); updateDocumentType(index, 'Other'); } else { updateDocumentType(index, val); } }} className="w-full bg-gray-900 border border-gray-600 rounded text-white text-xs p-2 focus:ring-1 focus:ring-blue-500 outline-none">
                                                                        {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                    </select>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 w-full">
                                                                <label className="block text-xs text-gray-500 mb-1">File</label>
                                                                {doc.file ? (
                                                                    <div className="flex items-center justify-between bg-gray-900 border border-gray-600 rounded p-2">
                                                                        <span className="text-xs text-white truncate max-w-[200px]">{doc.file.name}</span>
                                                                        <span className={`text-xs flex items-center ${doc.status === 'extracting' ? 'text-blue-400 animate-pulse' : doc.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {doc.status === 'extracting' && <SparklesIcon className="w-3 h-3 mr-1" />}
                                                                            {doc.status === 'success' && <CheckIcon className="w-3 h-3 mr-1" />}
                                                                            {doc.status === 'extracting' ? 'Extracting...' : doc.status === 'success' ? 'Ready to Upload' : doc.status === 'error' ? 'Failed' : ''}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative">
                                                                        <input type="file" accept="application/pdf,image/*" onChange={(e) => handleDocumentFileChange(index, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                                                        <div className="w-full bg-gray-900 border border-gray-600 border-dashed rounded p-2 flex items-center justify-center hover:bg-gray-700 transition-colors"><span className="text-xs text-gray-400 pointer-events-none">Click to upload</span></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {documentRows.length > 1 && (<button onClick={() => removeDocumentRow(index)} className="md:mt-6 p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-gray-900 transition-colors"><TrashIcon className="w-4 h-4" /></button>)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                            <div className="flex items-center mb-5 pb-2 border-b border-gray-700/50">
                                                <BriefcaseIcon className="w-5 h-5 text-purple-400 mr-2"/>
                                                <h4 className="text-white font-semibold">Entity Details</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Entity Type</label>
                                                    <select name="entityType" value={formData.entityType} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">
                                                        <option value="">Select Entity Type</option>
                                                        {ENTITY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Entity Sub Type</label>
                                                    <select name="entitySubType" value={formData.entitySubType} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">
                                                        <option value="">Select Entity Sub Type</option>
                                                        {ENTITY_SUB_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Date of Incorporation</label>
                                                    <input type="date" name="incorporationDate" value={formData.incorporationDate} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Trade License Issuing Authority</label>
                                                    <select name="tradeLicenseAuthority" value={formData.tradeLicenseAuthority} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">
                                                        <option value="">Select Authority</option>
                                                        {LICENSE_AUTHORITIES.map(auth => <option key={auth} value={auth}>{auth}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Trade License Number</label>
                                                    <input type="text" name="tradeLicenseNumber" value={formData.tradeLicenseNumber} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1">License Issue Date</label>
                                                        <input type="date" name="tradeLicenseIssueDate" value={formData.tradeLicenseIssueDate} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1">License Expiry Date</label>
                                                        <input type="date" name="tradeLicenseExpiryDate" value={formData.tradeLicenseExpiryDate} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" />
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">Business Activity Details</label>
                                                    <textarea name="businessActivity" value={formData.businessActivity} onChange={handleChange} placeholder="(As per Trade License)" rows={2} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" />
                                                </div>
                                                <div className="md:col-span-2 space-y-2">
                                                    <label className="flex items-center space-x-2">
                                                        <input type="checkbox" name="isFreezone" checked={formData.isFreezone} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-600 disabled:opacity-70" />
                                                        <span className="text-sm text-gray-300">Is the company located in a Freezone/Designated Freezone?</span>
                                                    </label>
                                                    {formData.isFreezone && (<div><input type="text" name="freezoneName" value={formData.freezoneName} onChange={handleChange} placeholder="Name of Freezone/Designated Freezone" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                            <div className="flex items-center mb-5 pb-2 border-b border-gray-700/50">
                                                <UserCircleIcon className="w-5 h-5 text-green-400 mr-2"/>
                                                <h4 className="text-white font-semibold">Owner/Shareholding Details</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left text-gray-400 mb-4">
                                                    <thead className="text-xs text-gray-500 uppercase bg-gray-800"><tr><th className="px-4 py-2">Owner Type</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Nationality</th><th className="px-4 py-2">Shareholding %</th>{!viewOnly && <th className="px-4 py-2"></th>}</tr></thead>
                                                    <tbody>{formData.shareholders?.map((shareholder, index) => (<tr key={index} className="border-b border-gray-800"><td className="px-4 py-2"><select value={shareholder.ownerType} onChange={(e) => handleShareholderChange(index, 'ownerType', e.target.value)} className="bg-gray-800 border border-gray-600 rounded text-white text-xs p-1 disabled:opacity-70"><option value="Individual">Individual</option><option value="Corporate">Corporate</option></select></td><td className="px-4 py-2"><input type="text" value={shareholder.name} onChange={(e) => handleShareholderChange(index, 'name', e.target.value)} className="bg-gray-800 border border-gray-600 rounded text-white text-xs p-1 w-full disabled:opacity-70" /></td><td className="px-4 py-2"><input type="text" value={shareholder.nationality} onChange={(e) => handleShareholderChange(index, 'nationality', e.target.value)} className="bg-gray-800 border border-gray-600 rounded text-white text-xs p-1 w-full disabled:opacity-70" /></td><td className="px-4 py-2"><input type="number" value={shareholder.percentage} onChange={(e) => handleShareholderChange(index, 'percentage', parseFloat(e.target.value))} className="bg-gray-800 border border-gray-600 rounded text-white text-xs p-1 w-20 disabled:opacity-70" /></td>{!viewOnly && (<td className="px-4 py-2 text-center"><button type="button" onClick={() => handleRemoveShareholder(index)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button></td>)}</tr>))}</tbody>
                                                </table>
                                                {!viewOnly && (<button type="button" onClick={handleAddShareholder} className="flex items-center text-sm font-medium text-blue-400 hover:text-blue-300"><PlusIcon className="w-4 h-4 mr-1"/> Add Shareholder</button>)}
                                            </div>
                                        </div>
                                        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">Authorised Signatories</label><input type="text" name="authorisedSignatories" value={formData.authorisedSignatories} onChange={handleChange} placeholder="(Names as per MOA)" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">Share Capital</label><input type="text" name="shareCapital" value={formData.shareCapital} onChange={handleChange} placeholder="(As per MOA)" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTab === 'tax' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                                <div className="flex items-center mb-5 pb-2 border-b border-gray-700/50 justify-between"><div className="flex items-center"><BanknotesIcon className="w-5 h-5 text-blue-400 mr-2"/><h4 className="text-white font-semibold">VAT Information</h4></div></div>
                                                <div className="space-y-4">
                                                    <div><label className="block text-xs font-medium text-gray-400 mb-1">Tax Treatment</label><select name="taxTreatment" value={formData.taxTreatment} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">{TAX_TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                                    {!viewOnly && isVatRegistered && (<div className="mt-2"><label className="flex items-center justify-center w-full px-4 py-3 border border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-800 transition-colors group"><div className="flex items-center space-x-2 text-xs text-gray-400 group-hover:text-blue-400">{isExtractingVat ? <SparklesIcon className="w-4 h-4 animate-pulse"/> : <UploadIcon className="w-4 h-4"/>}<span className="font-medium">{isExtractingVat ? 'Extracting Data...' : 'Upload VAT Certificate to Auto-fill'}</span></div><input type="file" className="hidden" accept="image/*,.pdf" onChange={handleVatCertUpload} disabled={isExtractingVat} /></label></div>)}
                                                    {isVatRegistered && (
                                                        <>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">Tax Registration Number (TRN)</label><input type="text" name="trn" value={formData.trn} onChange={handleChange} placeholder="15-digit TRN" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">VAT Registered Date</label><input type="text" name="vatRegisteredDate" value={formData.vatRegisteredDate} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">First VAT Return Period</label><input type="text" name="firstVatFilingPeriod" value={formData.firstVatFilingPeriod} onChange={handleChange} placeholder="e.g. Jan 2024 - Mar 2024" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            </div>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">VAT Return Due Date</label><input type="text" name="vatFilingDueDate" value={formData.vatFilingDueDate} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">Reporting Period</label><select name="vatReportingPeriod" value={formData.vatReportingPeriod} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70"><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option></select></div>
                                                        </>
                                                    )}
                                                    {!isVatRegistered && !isNonVat && (<div><label className="block text-xs font-medium text-gray-400 mb-1">Tax Registration Number (TRN) <span className="text-xs text-gray-600">(If applicable)</span></label><input type="text" name="trn" value={formData.trn} onChange={handleChange} placeholder="15-digit TRN" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>)}
                                                    {!isNonVat && (<div><label className="block text-xs font-medium text-gray-400 mb-1">Place of Supply</label><select name="placeOfSupply" value={formData.placeOfSupply} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">{PLACES_OF_SUPPLY.map(p => <option key={p} value={p}>{p}</option>)}</select></div>)}
                                                </div>
                                            </div>
                                            <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-700">
                                                <div className="flex items-center mb-5 pb-2 border-b border-gray-700/50 justify-between"><div className="flex items-center"><BuildingOfficeIcon className="w-5 h-5 text-green-400 mr-2"/><h4 className="text-white font-semibold">Corporate Tax Information</h4></div></div>
                                                <div className="space-y-4">
                                                    <div><label className="block text-xs font-medium text-gray-400 mb-1">Corporate Tax Treatment</label><select name="corporateTaxTreatment" value={formData.corporateTaxTreatment} onChange={handleChange} className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70">{CORP_TAX_TREATMENTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                                                    {!viewOnly && isCorporateTaxRegistered && (<div className="mt-2"><label className="flex items-center justify-center w-full px-4 py-3 border border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-800 transition-colors group"><div className="flex items-center space-x-2 text-xs text-gray-400 group-hover:text-blue-400">{isExtractingCt ? <SparklesIcon className="w-4 h-4 animate-pulse"/> : <UploadIcon className="w-4 h-4"/>}<span className="font-medium">{isExtractingCt ? 'Extracting Data...' : 'Upload CT Certificate to Auto-fill'}</span></div><input type="file" className="hidden" accept="image/*,.pdf" onChange={handleCtCertUpload} disabled={isExtractingCt} /></label></div>)}
                                                    {isCorporateTaxRegistered && (
                                                        <>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">Corporate Tax TRN</label><input type="text" name="corporateTaxTrn" value={formData.corporateTaxTrn} onChange={handleChange} placeholder="Enter CT Registration Number" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">CT Registered Date</label><input type="text" name="corporateTaxRegisteredDate" value={formData.corporateTaxRegisteredDate} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">First Corporate Tax Period Start Date</label><input type="text" name="firstCorporateTaxPeriodStart" value={formData.firstCorporateTaxPeriodStart} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                                <div><label className="block text-xs font-medium text-gray-400 mb-1">First Corporate Tax Period End Date</label><input type="text" name="firstCorporateTaxPeriodEnd" value={formData.firstCorporateTaxPeriodEnd} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                            </div>
                                                            <div><label className="block text-xs font-medium text-gray-400 mb-1">First Corporate Tax Return Filing Due Date</label><input type="text" name="corporateTaxFilingDueDate" value={formData.corporateTaxFilingDueDate} onChange={handleChange} placeholder="DD/MM/YYYY" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>
                                                        </>
                                                    )}
                                                    {!isCorporateTaxRegistered && formData.corporateTaxTreatment !== 'Not Registered' && (<div><label className="block text-xs font-medium text-gray-400 mb-1">Corporate Tax TRN <span className="text-xs text-gray-600">(If applicable)</span></label><input type="text" name="corporateTaxTrn" value={formData.corporateTaxTrn} onChange={handleChange} placeholder="Enter CT Registration Number" className="w-full p-2.5 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70" /></div>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {activeTab === 'contact' && (
                                    <div className="space-y-4">
                                        {formData.contactPersons?.map((contact, index) => (
                                            <div key={index} className="bg-gray-900 p-4 rounded-lg border border-gray-700 relative group">
                                                {!viewOnly && (<button type="button" onClick={() => handleRemoveContactPerson(index)} className="absolute top-4 right-4 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Contact"><TrashIcon className="w-4 h-4" /></button>)}
                                                <h5 className="text-sm font-semibold text-gray-300 mb-3 flex items-center"><UserCircleIcon className="w-4 h-4 mr-2"/>Contact Person {index + 1}</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="flex gap-2"><select value={contact.salutation} onChange={(e) => handleContactPersonChange(index, 'salutation', e.target.value)} className="w-20 p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70"><option value="">Mr.</option>{SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}</select><input type="text" placeholder="First Name" value={contact.firstName} onChange={(e) => handleContactPersonChange(index, 'firstName', e.target.value)} className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70" /></div>
                                                    <input type="text" placeholder="Last Name" value={contact.lastName} onChange={(e) => handleContactPersonChange(index, 'lastName', e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70" />
                                                    <input type="email" placeholder="Email" value={contact.email} onChange={(e) => handleContactPersonChange(index, 'email', e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70" />
                                                    <input type="tel" placeholder="Work Phone" value={contact.workPhone} onChange={(e) => handleContactPersonChange(index, 'workPhone', e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70" />
                                                    <input type="tel" placeholder="Mobile" value={contact.mobile} onChange={(e) => handleContactPersonChange(index, 'mobile', e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm disabled:opacity-70" />
                                                </div>
                                            </div>
                                        ))}
                                        {!viewOnly && (<button type="button" onClick={handleAddContactPerson} className="flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 mt-2"><PlusIcon className="w-4 h-4 mr-1" /> Add Contact Person</button>)}
                                    </div>
                                )}
                                
                                {activeTab === 'remarks' && (
                                    <div className="max-w-3xl">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Internal Remarks</label>
                                        <textarea name="remarks" rows={6} placeholder="Add notes about this customer..." value={formData.remarks} onChange={handleChange} className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-70" />
                                    </div>
                                )}
                            </div>
                        </fieldset>
                    </form>
                </div>
                
                <div className="px-8 py-5 border-t border-gray-800 bg-gray-900/50 flex justify-end space-x-3 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 border border-gray-700 transition-colors text-sm">{viewOnly ? 'Close' : 'Cancel'}</button>
                    {!viewOnly && (<button type="submit" form="customer-form" disabled={isSaving} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'Saving...' : 'Save Customer'}</button>)}
                </div>
            </div>
            <OtherDocumentInputModal isOpen={customDocModalOpen} onSave={handleCustomDocSave} onCancel={handleCustomDocCancel} />
        </div>
    );
};
