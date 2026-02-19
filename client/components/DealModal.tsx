import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { Deal, Customer, AttachedDocument } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { FileAttachment } from './FileAttachment';
import { readExcel, exportToExcel } from '../utils/excelUtils';

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (deal: Omit<Deal, 'id'>) => Promise<void>;
    initialData?: Partial<Deal> | null;
    readOnly?: boolean;
}

export const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, onSave, initialData, readOnly }) => {
    const { customers, salesSettings } = useData();
    const [formData, setFormData] = useState<Omit<Deal, 'id'>>({
        cifNumber: '',
        date: new Date().toISOString().split('T')[0],
        name: '',
        companyName: '',
        brand: '',
        contactNo: '',
        email: '',
        leadSource: '',
        services: '',
        serviceClosed: 'No',
        serviceAmount: 0,
        closingDate: '',
        paymentStatus: 'Pending'
    });

    const [suggestions, setSuggestions] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<string | null>(null); // 'cif' or 'company'
    const suggestionRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customData, setCustomData] = useState<Record<string, any>>({});
    const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);

    useEffect(() => {
        salesSettingsService.getCustomFields('deals').then(setCustomFields);
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                date: initialData.date || prev.date,
                serviceClosed: initialData.serviceClosed || prev.serviceClosed,
                serviceAmount: initialData.serviceAmount ?? prev.serviceAmount,
                paymentStatus: initialData.paymentStatus || prev.paymentStatus
            }));
            if (initialData.custom_data) {
                setCustomData(initialData.custom_data);
            }
            if (initialData.documents) {
                setAttachedDocuments(initialData.documents);
            }
        } else if (isOpen) {
            setFormData({
                cifNumber: '',
                date: new Date().toISOString().split('T')[0],
                name: '',
                companyName: '',
                brand: '',
                contactNo: '',
                email: '',
                leadSource: '',
                services: '',
                serviceClosed: 'No',
                serviceAmount: 0,
                closingDate: '',
                paymentStatus: 'Pending'
            });
            setCustomData({});
            setAttachedDocuments([]);
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCifChange = (val: string) => {
        setFormData({ ...formData, cifNumber: val });
        if (val.length > 0) {
            const matches = customers.filter(c =>
                (c.cifNumber ? String(c.cifNumber).toLowerCase() : '').includes(val.toLowerCase()) ||
                (c.companyName || '').toLowerCase().includes(val.toLowerCase())
            );
            setSuggestions(matches.slice(0, 5));
            setShowSuggestions('cif');
        } else {
            setSuggestions([]);
            setShowSuggestions(null);
        }
    };

    const handleCompanyChange = (val: string) => {
        setFormData({ ...formData, companyName: val });
        if (val.length > 0) {
            const matches = customers.filter(c =>
                (c.companyName || '').toLowerCase().includes(val.toLowerCase()) ||
                (c.cifNumber ? String(c.cifNumber).toLowerCase() : '').includes(val.toLowerCase())
            );
            setSuggestions(matches.slice(0, 5));
            setShowSuggestions('company');
        } else {
            setSuggestions([]);
            setShowSuggestions(null);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setFormData({
            ...formData,
            cifNumber: customer.cifNumber || '',
            name: `${customer.firstName} ${customer.lastName}`,
            companyName: customer.companyName || '',
            email: customer.email || '',
            contactNo: customer.mobile || customer.workPhone || ''
        });
        setShowSuggestions(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        await onSave({ ...formData, custom_data: customData, documents: attachedDocuments });
        onClose();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await readExcel(e.target.files[0]);
                if (data && data.length > 0) {
                    const row = data[0]; // Take first row
                    setFormData(prev => ({
                        ...prev,
                        cifNumber: row['CIF No'] || prev.cifNumber,
                        name: row['Name'] || prev.name,
                        companyName: row['Company Name'] || prev.companyName,
                        brand: row['Brand'] || prev.brand,
                        contactNo: row['Contact No'] || prev.contactNo,
                        email: row['Email'] || prev.email,
                        leadSource: row['Lead Source'] || prev.leadSource,
                        services: row['Services'] || prev.services,
                        serviceAmount: row['Service Amount'] || prev.serviceAmount,
                        serviceClosed: row['Service Closed'] || prev.serviceClosed,
                        paymentStatus: row['Payment Status'] || prev.paymentStatus,
                        date: row['Deal Date'] || prev.date,
                        closingDate: row['Closing Date'] || prev.closingDate
                    }));
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import Excel file');
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = () => {
        const exportData = [{
            'CIF No': formData.cifNumber,
            'Name': formData.name,
            'Company Name': formData.companyName,
            'Brand': formData.brand,
            'Contact No': formData.contactNo,
            'Email': formData.email,
            'Lead Source': formData.leadSource,
            'Services': formData.services,
            'Service Amount': formData.serviceAmount,
            'Service Closed': formData.serviceClosed,
            'Payment Status': formData.paymentStatus,
            'Deal Date': formData.date,
            'Closing Date': formData.closingDate
        }];
        exportToExcel(exportData, `Deal_${formData.companyName || 'New'}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">
                        {readOnly ? 'View Deal' : (initialData ? 'Edit Deal' : 'Add New Deal')}
                    </h3>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        <div className="space-y-4">
                            <div className="relative" ref={showSuggestions === 'cif' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">CIF No</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        disabled={readOnly}
                                        placeholder="Type CIF or search..."
                                        className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        value={formData.cifNumber}
                                        onChange={(e) => handleCifChange(e.target.value)}
                                        onFocus={() => !readOnly && formData.cifNumber && handleCifChange(formData.cifNumber)}
                                    />
                                    {!readOnly && showSuggestions === 'cif' && suggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                                            {suggestions.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-3 hover:bg-primary/10 cursor-pointer border-b border-border last:border-0 transition-colors"
                                                    onClick={() => selectCustomer(c)}
                                                >
                                                    <div className="font-bold text-foreground text-sm">{c.cifNumber}</div>
                                                    <div className="text-xs text-muted-foreground">{c.companyName}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="relative" ref={showSuggestions === 'company' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    placeholder="Type company name..."
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.companyName}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    onFocus={() => !readOnly && formData.companyName && handleCompanyChange(formData.companyName)}
                                />
                                {!readOnly && showSuggestions === 'company' && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                                        {suggestions.map(c => (
                                            <div
                                                key={c.id}
                                                className="p-3 hover:bg-primary/10 cursor-pointer border-b border-border last:border-0"
                                                onClick={() => selectCustomer(c)}
                                            >
                                                <div className="font-bold text-foreground text-sm">{c.companyName}</div>
                                                <div className="text-xs text-muted-foreground">{c.cifNumber}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Brand</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                >
                                    <option value="">Select Brand</option>
                                    {salesSettings.brands.map(brand => (
                                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
                                <input
                                    type="email"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Contact No</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.contactNo}
                                    onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Lead Source</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.leadSource}
                                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                                >
                                    <option value="">Select Lead Source</option>
                                    {salesSettings.leadSources.map(source => (
                                        <option key={source.id} value={source.id}>{source.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Services</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.services}
                                    onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                                >
                                    <option value="">Select Service</option>
                                    {salesSettings.servicesRequired.map(service => (
                                        <option key={service.id} value={service.id}>{service.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Service Amount (AED)</label>
                            <input
                                type="number"
                                required
                                disabled={readOnly}
                                className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none font-mono ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.serviceAmount}
                                onChange={(e) => setFormData({ ...formData, serviceAmount: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Service Closed</label>
                            <select
                                disabled={readOnly}
                                className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.serviceClosed}
                                onChange={(e) => setFormData({ ...formData, serviceClosed: e.target.value })}
                            >
                                <option value="">Select Status</option>
                                {salesSettings.serviceClosedOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Payment Status</label>
                            <select
                                disabled={readOnly}
                                className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                            >
                                <option value="">Select Status</option>
                                {salesSettings.paymentStatusOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Deal Date</label>
                            <input
                                type="date"
                                required
                                disabled={readOnly}
                                className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Closing Date</label>
                            <input
                                type="date"
                                disabled={readOnly}
                                className={`w-full bg-muted/50 border border-border rounded-xl p-3 text-foreground focus:ring-2 focus:ring-primary outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.closingDate}
                                onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                            />
                        </div>
                    </div>

                    {customFields.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-border">
                            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Additional Information</h4>
                            <CustomFieldRenderer
                                fields={customFields}
                                data={customData}
                                onChange={(id, val) => setCustomData(prev => ({ ...prev, [id]: val }))}
                                disabled={readOnly}
                                columns={2}
                            />
                        </div>
                    )}

                    {/* <div className="mt-8 pt-6 border-t border-gray-800">
                        <FileAttachment
                            documents={attachedDocuments}
                            onDocumentsChange={setAttachedDocuments}
                            readOnly={readOnly}
                        />
                    </div> */}
                </form>

                <div className="p-6 border-t border-border bg-card/80 backdrop-blur-md flex justify-between items-center">
                    <div className="flex gap-2">
                        {!readOnly && (
                            <>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImport}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors border border-primary/20 flex items-center gap-2"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4 rotate-180" />
                                    Import
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={handleExport}
                            className="px-4 py-2 bg-green-600/10 text-green-500 hover:bg-green-600/20 rounded-lg text-sm font-medium transition-colors border border-green-500/20 flex items-center gap-2"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-8 py-2.5 bg-muted text-muted-foreground font-bold rounded-xl hover:bg-muted/80 active:scale-95 transition-all border border-border"
                        >
                            {readOnly ? 'Close' : 'Cancel'}
                        </button>
                        {!readOnly && (
                            <button
                                onClick={handleSubmit}
                                className="px-8 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                {initialData ? 'Update Deal' : 'Create Deal'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
