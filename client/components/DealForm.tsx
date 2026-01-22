import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { Deal, Customer, AttachedDocument } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { FileAttachment } from './FileAttachment';
import { readExcel, exportToExcel } from '../utils/excelUtils';
import { generateDealScore, parseSmartNotes } from '../services/geminiService';
import { AIEmailModal } from './AIEmailModal';
import { SparklesIcon, EnvelopeIcon, ChartBarIcon, ArrowPathIcon, LightBulbIcon } from './icons';

interface DealFormProps {
    onSave: (deal: Omit<Deal, 'id'>) => Promise<void>;
    onCancel: () => void;
    initialData?: Partial<Deal> | null;
    readOnly?: boolean;
}

export const DealForm: React.FC<DealFormProps> = ({ onSave, onCancel, initialData, readOnly }) => {
    const { customers, salesSettings } = useData();
    const [formData, setFormData] = useState<Omit<Deal, 'id'> & { remarks?: string }>({
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
        paymentStatus: 'Pending',
        remarks: ''
    });

    const [suggestions, setSuggestions] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<string | null>(null); // 'cif' or 'company'
    const suggestionRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customData, setCustomData] = useState<Record<string, any>>({});
    const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);

    // AI State
    const [smartNotes, setSmartNotes] = useState('');
    const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
    const [aiScore, setAiScore] = useState<{ score: number; rationale: string; nextAction: string } | null>(null);
    const [isAnalyzingScore, setIsAnalyzingScore] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

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
                paymentStatus: initialData.paymentStatus || prev.paymentStatus,
                remarks: initialData.custom_data?.remarks || ''
            }));
            if (initialData.custom_data) {
                setCustomData(initialData.custom_data);
                if (initialData.custom_data.aiScore) {
                    setAiScore(initialData.custom_data.aiScore);
                }
            }
            if (initialData.documents) {
                setAttachedDocuments(initialData.documents);
            }
        }
    }, [initialData]);

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
        // Persist remarks and aiScore in custom_data
        const finalCustomData = { ...customData, remarks: formData.remarks, aiScore };
        await onSave({ ...formData, custom_data: finalCustomData, documents: attachedDocuments });
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
                        closingDate: row['Closing Date'] || prev.closingDate,
                        remarks: row['Remarks'] || prev.remarks
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
            'Closing Date': formData.closingDate,
            'Remarks': formData.remarks
        }];
        exportToExcel(exportData, `Deal_${formData.companyName || 'New'}`);
    };

    const handleSmartNoteAnalysis = async () => {
        if (!smartNotes.trim()) return;
        setIsAnalyzingNotes(true);
        try {
            const extracted = await parseSmartNotes(smartNotes) as any;

            // Extract remarks separately as it might not be in Deal type
            const { remarks, ...rest } = extracted;

            setFormData(prev => ({
                ...prev,
                ...rest,
                date: rest.date || prev.date, // Ensure format
                remarks: remarks || prev.remarks
            }));

            // Populate custom fields if matches found in extracted data (optional enhancement)
            // But main goal is to populate standard form fields
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzingNotes(false);
        }
    };

    const handleDealAnalysis = async () => {
        setIsAnalyzingScore(true);
        try {
            // Pass remarks explicitly via custom_data
            const result = await generateDealScore({
                ...formData,
                id: 'temp',
                custom_data: { ...customData, remarks: formData.remarks }
            });
            setAiScore(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzingScore(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl relative">
            <AIEmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} deal={formData} />

            {/* Header */}
            <div className="flex items-center space-x-3 pb-6 border-b border-gray-800 justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500">
                        {initialData ? <PlusIcon className="w-6 h-6 rotate-45" /> : <PlusIcon className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">{readOnly ? 'View Deal' : (initialData ? 'Edit Deal Details' : 'Create New Deal')}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Fill in the information to {initialData ? 'update' : 'add'} a deal</p>
                    </div>
                </div>
                {!readOnly && (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsEmailModalOpen(true)}
                            className="px-3 py-2 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 rounded-lg text-sm font-medium transition-colors border border-purple-500/20 flex items-center gap-2"
                        >
                            <EnvelopeIcon className="w-4 h-4" />
                            Draft Email
                        </button>
                    </div>
                )}
            </div>

            {/* Smart Notes Section */}
            {!readOnly && (
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <SparklesIcon className="w-3 h-3" /> AI Smart Fill
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            placeholder="Paste raw notes here... e.g. 'Ahmed from TechCorp wants an Audit for 15k, closing next month'"
                            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg p-3 text-sm text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-16"
                            value={smartNotes}
                            onChange={(e) => setSmartNotes(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={handleSmartNoteAnalysis}
                            disabled={isAnalyzingNotes || !smartNotes}
                            className="px-4 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex flex-col items-center justify-center gap-1 w-24"
                        >
                            {isAnalyzingNotes ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                            {isAnalyzingNotes ? 'Parsing...' : 'Auto-Fill'}
                        </button>
                    </div>
                </div>
            )}

            {/* AI Analysis Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-8">

                    {/* Section: Basic Info */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                            <MagnifyingGlassIcon className="w-4 h-4" />
                            <span>Basic Information</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative" ref={showSuggestions === 'cif' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">CIF No</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        disabled={readOnly}
                                        placeholder="Type CIF or search..."
                                        className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        value={formData.cifNumber}
                                        onChange={(e) => handleCifChange(e.target.value)}
                                        onFocus={() => !readOnly && formData.cifNumber && handleCifChange(formData.cifNumber)}
                                    />
                                    {!readOnly && showSuggestions === 'cif' && suggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                                            {suggestions.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-3 hover:bg-blue-600/20 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors"
                                                    onClick={() => selectCustomer(c)}
                                                >
                                                    <div className="font-bold text-white text-sm">{c.cifNumber}</div>
                                                    <div className="text-xs text-gray-400">{c.companyName}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="relative" ref={showSuggestions === 'company' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    placeholder="Type company name..."
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.companyName}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    onFocus={() => !readOnly && formData.companyName && handleCompanyChange(formData.companyName)}
                                />
                                {!readOnly && showSuggestions === 'company' && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                        {suggestions.map(c => (
                                            <div
                                                key={c.id}
                                                className="p-3 hover:bg-blue-600/20 cursor-pointer border-b border-gray-700/50 last:border-0"
                                                onClick={() => selectCustomer(c)}
                                            >
                                                <div className="font-bold text-white text-sm">{c.companyName}</div>
                                                <div className="text-xs text-gray-400">{c.cifNumber}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Brand</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                >
                                    <option value="">Select Brand</option>
                                    {salesSettings.brands.map(brand => (
                                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Contact No</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.contactNo}
                                    onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Deal Info */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                            <ChartBarIcon className="w-4 h-4" />
                            <span>Deal Details</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Lead Source</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Services</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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

                    {/* Section: Financials */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            <span>Financials</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Service Amount (AED)</label>
                                <input
                                    type="number"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.serviceAmount}
                                    onChange={(e) => setFormData({ ...formData, serviceAmount: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Service Closed</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Payment Status</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                    </div>

                    {/* Section: Timeline */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                            <SparklesIcon className="w-4 h-4" />
                            <span>Timeline</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Deal Date</label>
                                <input
                                    type="date"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Closing Date</label>
                                <input
                                    type="date"
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.closingDate}
                                    onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Remarks */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                            <SparklesIcon className="w-4 h-4" />
                            <span>Remarks</span>
                        </div>
                        <div>
                            <textarea
                                rows={3}
                                disabled={readOnly}
                                placeholder="Add internal notes or remarks..."
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-y ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.remarks || ''}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Section: Custom Fields */}
                    {customFields.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                <SparklesIcon className="w-4 h-4" />
                                <span>Additional Information</span>
                            </div>
                            <CustomFieldRenderer
                                fields={customFields}
                                data={customData}
                                onChange={(id, val) => setCustomData(prev => ({ ...prev, [id]: val }))}
                                disabled={readOnly}
                                columns={2}
                            />
                        </div>
                    )}

                </div>


                {/* Right Column: AI Insights */}
                {/* Right Column: AI Scoring */}
                <div className="space-y-6">
                    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 sticky top-6">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-purple-400" />
                            Deal Scoring
                        </h3>

                        <div className="space-y-6">
                            {aiScore ? (
                                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex flex-col items-center justify-center py-4 bg-gray-800 rounded-xl border border-gray-700">
                                        <span className={`text-4xl font-bold ${getScoreColor(aiScore.score)}`}>
                                            {aiScore.score}
                                        </span>
                                        <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Win Probability</span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                            <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                                <LightBulbIcon className="w-4 h-4 text-yellow-500" />
                                                AI Rationale
                                            </div>
                                            <p className="text-sm text-gray-300 leading-relaxed">
                                                {aiScore.rationale}
                                            </p>
                                        </div>

                                        <div className="p-3 bg-blue-900/10 rounded-lg border border-blue-500/20">
                                            <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                                <ArrowPathIcon className="w-4 h-4" />
                                                Recommended Action
                                            </div>
                                            <p className="text-sm text-gray-300">
                                                {aiScore.nextAction}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 px-4 bg-gray-800/50 rounded-xl border border-gray-700/50 border-dashed">
                                    <p className="text-sm text-gray-400 mb-4">
                                        Analyze deal details to generate a quality score and action plan.
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleDealAnalysis}
                                disabled={isAnalyzingScore}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isAnalyzingScore ? (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-4 h-4" />
                                        {aiScore ? 'Re-Analyze Deal' : 'Calculate Deal Score'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* <div className="mt-8 pt-6 border-t border-gray-800">
                <FileAttachment
                    documents={attachedDocuments}
                    onDocumentsChange={setAttachedDocuments}
                    readOnly={readOnly}
                />
            </div> */}

            <div className="pt-4 border-t border-gray-800 flex justify-between items-center">
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
                                className="px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-sm font-medium transition-colors border border-blue-500/20 flex items-center gap-2"
                            >
                                <ArrowDownTrayIcon className="w-4 h-4 rotate-180" />
                                Import
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={handleExport}
                        className="px-4 py-2 bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded-lg text-sm font-medium transition-colors border border-green-500/20 flex items-center gap-2"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                    </button>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-8 py-2.5 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 active:scale-95 transition-all border border-gray-700"
                    >
                        {readOnly ? 'Back' : 'Cancel'}
                    </button>
                    {!readOnly && (
                        <button
                            type="submit"
                            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                        >
                            {initialData ? 'Update Deal' : 'Create Deal'}
                        </button>
                    )}
                </div>
            </div >
        </form >
    );
};
