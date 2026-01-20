import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, UserCircleIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon, TagIcon, FunnelIcon, BriefcaseIcon, CalendarDaysIcon as CalendarIcon, ChatBubbleBottomCenterTextIcon, ArrowDownTrayIcon, SparklesIcon, ArrowPathIcon, ChartBarIcon, ExclamationTriangleIcon, LightBulbIcon, MagnifyingGlassIcon } from './icons';
import { Lead, SalesSettings, User } from '../types';
import { ConfirmationDialog } from './ConfirmationDialog';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { FileAttachment } from './FileAttachment';
import { AttachedDocument } from '../types';
import { readExcel, exportToExcel } from '../utils/excelUtils';
import { generateLeadScore, parseLeadSmartNotes } from '../services/geminiService';
import { AIEmailModal } from './AIEmailModal';

interface LeadFormProps {
    lead: Lead | null;
    onSave: (leadData: any) => void;
    onCancel: () => void;
    salesSettings: SalesSettings;
    users: User[];
}

export const LeadForm: React.FC<LeadFormProps> = ({ lead, onSave, onCancel, salesSettings, users }) => {
    const isEditMode = Boolean(lead);
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        companyName: '',
        brand: '',
        mobileNumber: '',
        email: '',
        leadSource: '',
        status: 'Follow up',
        serviceRequired: '',
        leadQualification: '',
        leadOwner: '',
        remarks: '',
        lastContact: '',
        closingCycle: '',
        closingDate: ''
    });

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customData, setCustomData] = useState<Record<string, any>>({});
    const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);

    const [showConvertConfirmation, setShowConvertConfirmation] = useState(false);

    // AI State
    const [smartNotes, setSmartNotes] = useState('');
    const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
    const [aiScore, setAiScore] = useState<{ score: number; rationale: string; nextAction: string } | null>(null);
    const [isAnalyzingScore, setIsAnalyzingScore] = useState(false);

    useEffect(() => {
        salesSettingsService.getCustomFields('leads').then(setCustomFields);
    }, []);

    useEffect(() => {
        if (lead) {
            setFormData({
                date: lead.date,
                companyName: lead.companyName,
                brand: lead.brand || '',
                mobileNumber: lead.mobileNumber,
                email: lead.email,
                leadSource: lead.leadSource,
                status: lead.status,
                serviceRequired: lead.serviceRequired || '',
                leadQualification: lead.leadQualification || '',
                leadOwner: lead.leadOwner || '',
                remarks: lead.remarks || '',
                lastContact: lead.lastContact || '',
                closingCycle: lead.closingCycle || '',
                closingDate: lead.closingDate || ''
            });
            if (lead.custom_data) {
                setCustomData(lead.custom_data);
                if (lead.custom_data.aiScore) {
                    setAiScore(lead.custom_data.aiScore);
                }
            }
            if (lead.documents) {
                setAttachedDocuments(lead.documents);
            }
        }
    }, [lead]);

    const calculateDuration = (startDate: string, endDate: string) => {
        if (!startDate || !endDate) return '';
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
        if (end < start) return '';

        let years = end.getFullYear() - start.getFullYear();
        let months = end.getMonth() - start.getMonth();
        let days = end.getDate() - start.getDate();

        if (days < 0) {
            months--;
            const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
            days += prevMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        const parts = [];
        if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
        if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

        return parts.length > 0 ? parts.join(', ') : '0 days';
    };

    useEffect(() => {
        if (formData.date && formData.closingDate) {
            const cycle = calculateDuration(formData.date, formData.closingDate);
            setFormData(prev => {
                if (prev.closingCycle !== cycle) return { ...prev, closingCycle: cycle };
                return prev;
            });
        }
    }, [formData.date, formData.closingDate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'status' && value === 'Convert as customer') {
            setFormData(prev => ({ ...prev, [name]: value }));
            setShowConvertConfirmation(true);
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfirmConversion = async () => {
        setShowConvertConfirmation(false);
        await onSave({ ...formData, custom_data: { ...customData, aiScore }, documents: attachedDocuments });
        navigate('/customers', {
            state: {
                prefill: {
                    companyName: formData.companyName,
                    email: formData.email,
                    mobile: formData.mobileNumber,
                    type: 'business',
                    custom_data: customData
                }
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, custom_data: { ...customData, aiScore }, documents: attachedDocuments });
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await readExcel(e.target.files[0]);
                if (data && data.length > 0) {
                    const row = data[0];
                    setFormData(prev => ({
                        ...prev,
                        companyName: row['Company Name'] || prev.companyName,
                        date: row['Registration Date'] || prev.date,
                        email: row['Contact Email'] || prev.email,
                        mobileNumber: row['Mobile Number'] || prev.mobileNumber,
                        brand: row['Brand'] || prev.brand,
                        leadSource: row['Lead Source'] || prev.leadSource,
                        leadOwner: row['Lead Owner'] || prev.leadOwner,
                        status: row['Status'] || prev.status,
                        serviceRequired: row['Service Required'] || prev.serviceRequired,
                        leadQualification: row['Qualification'] || prev.leadQualification,
                        lastContact: row['Last Contact'] || prev.lastContact,
                        closingCycle: row['Closing Cycle'] || prev.closingCycle,
                        closingDate: row['Expected Closing'] || prev.closingDate,
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
            'Company Name': formData.companyName,
            'Registration Date': formData.date,
            'Contact Email': formData.email,
            'Mobile Number': formData.mobileNumber,
            'Brand': formData.brand,
            'Lead Source': formData.leadSource,
            'Lead Owner': formData.leadOwner,
            'Status': formData.status,
            'Service Required': formData.serviceRequired,
            'Qualification': formData.leadQualification,
            'Last Contact': formData.lastContact,
            'Closing Cycle': formData.closingCycle,
            'Expected Closing': formData.closingDate,
            'Remarks': formData.remarks
        }];
        exportToExcel(exportData, `Lead_${formData.companyName || 'New'}`);
    };

    const handleSmartNoteAnalysis = async () => {
        if (!smartNotes.trim()) return;
        setIsAnalyzingNotes(true);
        try {
            const extracted = await parseLeadSmartNotes(smartNotes);
            setFormData(prev => ({
                ...prev,
                ...extracted
            }));
            // Update custom data if needed (if extracted contains custom fields logic later)
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzingNotes(false);
        }
    };

    const handleLeadAnalysis = async () => {
        setIsAnalyzingScore(true);
        try {
            const result = await generateLeadScore({ ...formData, custom_data: customData });
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
        <>
            <ConfirmationDialog
                isOpen={showConvertConfirmation}
                onConfirm={handleConfirmConversion}
                onCancel={() => setShowConvertConfirmation(false)}
                title="Convert to Customer?"
                confirmText="Yes"
                cancelText="No"
            >
                Are you sure you want to convert this lead into a customer? This will pre-fill the customer registration form with current lead information.
            </ConfirmationDialog>

            <form onSubmit={handleSubmit} className="space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl relative">
                <AIEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    deal={{
                        name: formData.companyName,
                        companyName: formData.companyName,
                        services: formData.serviceRequired,
                        email: formData.email,
                        contactNo: formData.mobileNumber
                    }}
                />
                {/* Header */}
                <div className="flex items-center space-x-3 pb-6 border-b border-gray-800 justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500">
                            {isEditMode ? <PlusIcon className="w-6 h-6 rotate-45" /> : <PlusIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Lead Details' : 'Create New Lead'}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Fill in the information to {isEditMode ? 'update' : 'add'} a lead</p>
                        </div>
                    </div>
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
                </div>

                {/* Smart Notes Section */}
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <SparklesIcon className="w-3 h-3" /> AI Smart Fill
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            placeholder="Paste raw notes here... e.g. 'Met John from ABC Corp at Gitex. Need ERP. Phone: 0551234567'"
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Section: Basic Info */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                <MagnifyingGlassIcon className="w-4 h-4" />
                                <span>Basic Information</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Company Name</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        required
                                        value={formData.companyName}
                                        onChange={handleChange}
                                        placeholder="Enter company name"
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Registration Date</label>
                                    <input
                                        type="date"
                                        name="date"
                                        required
                                        value={formData.date}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Contact Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="name@company.com"
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Mobile Number</label>
                                    <input
                                        type="tel"
                                        name="mobileNumber"
                                        required
                                        value={formData.mobileNumber}
                                        onChange={handleChange}
                                        placeholder="+971 50..."
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Sales Details */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                <TagIcon className="w-4 h-4" />
                                <span>Sales & Lead Details</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Brand</label>
                                    <select
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select Brand</option>
                                        {salesSettings.brands.map(brand => (
                                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Lead Source</label>
                                    <select
                                        name="leadSource"
                                        required
                                        value={formData.leadSource}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select Source</option>
                                        {salesSettings.leadSources.map(source => (
                                            <option key={source.id} value={source.name}>{source.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Lead Owner</label>
                                    <select
                                        name="leadOwner"
                                        value={formData.leadOwner}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select Owner</option>
                                        {salesSettings.leadOwners.map(owner => (
                                            <option key={owner.id} value={owner.id}>{owner.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Status</label>
                                    <select
                                        name="status"
                                        required
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="Follow up">Follow up</option>
                                        <option value="Submitted">Submitted</option>
                                        <option value="Lost to competitor">Lost to competitor</option>
                                        <option value="Convert as customer">Convert as customer</option>
                                        <option value="Dropped">Dropped</option>
                                        <option value="Waiting for client replay">Waiting for client replay</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Qualification</label>
                                    <select
                                        name="leadQualification"
                                        value={formData.leadQualification}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select Qualification</option>
                                        {salesSettings.leadQualifications.map(qual => (
                                            <option key={qual.id} value={qual.id}>{qual.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Service Required</label>
                                    <select
                                        name="serviceRequired"
                                        value={formData.serviceRequired}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select Service</option>
                                        {salesSettings.servicesRequired.map(service => (
                                            <option key={service.id} value={service.id}>{service.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section: Timeline & Remarks */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                <CalendarIcon className="w-4 h-4" />
                                <span>Timeline</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Last Contact</label>
                                    <input
                                        type="date"
                                        name="lastContact"
                                        value={formData.lastContact}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Closing Cycle</label>
                                    <input
                                        type="text"
                                        name="closingCycle"
                                        value={formData.closingCycle}
                                        onChange={handleChange}
                                        placeholder="e.g. 1 month"
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Closing Date</label>
                                    <input
                                        type="date"
                                        name="closingDate"
                                        value={formData.closingDate}
                                        onChange={handleChange}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Remarks */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                                <span>Remarks</span>
                            </div>
                            <div>
                                <textarea
                                    name="remarks"
                                    rows={3}
                                    value={formData.remarks}
                                    onChange={handleChange}
                                    placeholder="Add any additional notes or details about this lead..."
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600 resize-y"
                                />
                            </div>
                        </div>

                        {/* Section: Custom Fields */}
                        {customFields.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                                    <PlusIcon className="w-4 h-4" />
                                    <span>Additional Information</span>
                                </div>
                                <CustomFieldRenderer
                                    fields={customFields}
                                    data={customData}
                                    onChange={(id, val) => setCustomData(prev => ({ ...prev, [id]: val }))}
                                    columns={2}
                                />
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN - Lead Scoring */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Lead Scoring Widget */}
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 sticky top-6">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-purple-400" />
                                Lead Scoring
                            </h3>

                            <div className="space-y-6">
                                {aiScore ? (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="flex flex-col items-center justify-center py-4 bg-gray-800 rounded-xl border border-gray-700">
                                            <span className={`text-4xl font-bold ${getScoreColor(aiScore.score)}`}>
                                                {aiScore.score}
                                            </span>
                                            <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Lead Potential</span>
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
                                            Analyze lead details to generate a quality score and action plan.
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleLeadAnalysis}
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
                                            {aiScore ? 'Re-Analyze Lead' : 'Calculate Lead Score'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                {/* Submit Section */}
                <div className="pt-4 border-t border-gray-800 flex justify-between items-center bg-gray-900 pb-2">
                    <div className="flex gap-2">
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
                            Import Data
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            className="px-4 py-2 bg-green-600/10 text-green-400 hover:bg-green-600/20 rounded-lg text-sm font-medium transition-colors border border-green-500/20 flex items-center gap-2"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Export Data
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-8 py-2.5 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 active:scale-95 transition-all border border-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                        >
                            {isEditMode ? 'Update Lead' : 'Create Lead'}
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
};
