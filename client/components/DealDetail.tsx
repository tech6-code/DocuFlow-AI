import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDaysIcon as CalendarIcon, UsersIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon, TagIcon, BanknotesIcon, CreditCardIcon, CheckCircleIcon, HashtagIcon, SparklesIcon, ArrowPathIcon, ExclamationTriangleIcon, LightBulbIcon, ChartBarIcon, PencilIcon, TrashIcon, ClockIcon, DocumentTextIcon, PlusIcon } from './icons';
import { Deal, SalesSettings, DealFollowUp, DealNote, DealDocument, DealHistoryItem } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { generateDealScore } from '../services/geminiService';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { dealService } from '../services/dealService';
import AddFollowUpModal from './AddFollowUpModal';
import AddNoteModal from './AddNoteModal';

interface DealDetailProps {
    deals: Deal[];
    salesSettings: SalesSettings;
    onEdit: (deal: Deal) => void;
    onDelete: (id: string) => void;
}

interface DetailItemProps {
    label: string;
    value: string | number | undefined;
    icon: any;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, icon: Icon }) => (
    <div className="bg-muted p-3 rounded-xl border border-border flex items-start space-x-3">
        <div className="p-2 bg-background rounded-lg text-muted-foreground">
            <Icon className="w-4 h-4" />
        </div>
        <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm text-foreground font-medium">{value ?? '-'}</p>
        </div>
    </div>
);

export const DealDetail: React.FC<DealDetailProps> = ({ deals, salesSettings, onEdit, onDelete }) => {
    const { id } = useParams<{ id: string }>();
    const { updateDeal } = useData();
    const { currentUser } = useAuth();
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'follow-up' | 'proposal' | 'notes' | 'history'>('overview');
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [followUps, setFollowUps] = useState<DealFollowUp[]>([]);
    const [notes, setNotes] = useState<DealNote[]>([]);
    const [documents, setDocuments] = useState<DealDocument[]>([]);
    const [history, setHistory] = useState<DealHistoryItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const deal = deals.find(d => d.id === id);

    useEffect(() => {
        if (deal) {
            salesSettingsService.getCustomFields('deals').then(setCustomFields);
            if (deal.custom_data?.aiScore) {
                setAiAnalysis(deal.custom_data.aiScore);
            } else {
                setAiAnalysis(null);
            }

            // Load all data
            loadFollowUps();
            loadNotes();
            loadDocuments();
            loadHistory();
        }
    }, [deal]);

    const loadFollowUps = async () => {
        if (!deal) return;
        try {
            const data = await dealService.getDealFollowUps(deal.id);
            setFollowUps(data);
        } catch (error) {
            console.error("Failed to load follow-ups", error);
        }
    };

    const loadNotes = async () => {
        if (!deal) return;
        try {
            const data = await dealService.getDealNotes(deal.id);
            setNotes(data);
        } catch (error) {
            console.error("Failed to load notes", error);
        }
    };

    const loadDocuments = async () => {
        if (!deal) return;
        try {
            const data = await dealService.getDealDocuments(deal.id);
            setDocuments(data);
        } catch (error) {
            console.error("Failed to load documents", error);
        }
    };

    const loadHistory = async () => {
        if (!deal) return;
        try {
            const data = await dealService.getDealHistory(deal.id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load history", error);
        }
    };

    const handleAnalyzeDeal = async () => {
        setIsAnalyzing(true);
        try {
            const analysis = await generateDealScore(deal);
            setAiAnalysis(analysis);
            const updatedDeal = {
                ...deal,
                custom_data: {
                    ...deal.custom_data,
                    aiScore: analysis
                }
            };
            updateDeal(updatedDeal);
        } catch (error) {
            console.error("Failed to analyze deal", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getBrandName = (brandId: string): string => {
        const brand = salesSettings.brands.find(b => b.id === brandId);
        return brand?.name || brandId;
    };

    const getServiceName = (serviceId: string): string => {
        const service = salesSettings.servicesRequired.find(s => s.id === serviceId);
        return service?.name || serviceId;
    };

    const getLeadSourceName = (sourceId: string): string => {
        const source = salesSettings.leadSources.find(s => s.id === sourceId);
        return source?.name || sourceId;
    };

    const getStatusColor = (status: string) => {
        const statusColors: Record<string, string> = {
            'Paid': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            'Pending': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
            'Overdue': 'bg-destructive/10 text-destructive border-destructive/20',
            'Partial': 'bg-primary/10 text-primary border-primary/20'
        };
        return statusColors[status] || 'bg-muted text-muted-foreground border-border';
    };

    const renderCustomValue = (field: CustomField, value: any) => {
        if (value === undefined || value === null || value === '') return '-';
        if (field.type === 'checkbox') return value ? 'Yes' : 'No';
        return String(value);
    };

    // File Handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !deal || !currentUser) return;

        const file = e.target.files[0];
        setIsUploading(true);
        try {
            await dealService.uploadDealDocument(deal.id, file, currentUser.id);
            await loadDocuments();
            await loadHistory(); // Upload adds to history
        } catch (error) {
            console.error("Failed to upload file", error);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDeleteDocument = async (doc: DealDocument) => {
        if (!window.confirm(`Are you sure you want to delete "${doc.fileName}"?`)) return;
        try {
            await dealService.deleteDealDocument(doc.id, doc.filePath, deal.id);
            await loadDocuments();
            await loadHistory();
        } catch (error) {
            console.error("Failed to delete document", error);
            alert("Failed to delete document");
        }
    };

    // State for editing
    const [editingFollowUp, setEditingFollowUp] = useState<DealFollowUp | null>(null);
    const [editingNote, setEditingNote] = useState<DealNote | null>(null);

    // Follow-up handlers
    const handleAddFollowUp = async (followUpData: Omit<DealFollowUp, 'id' | 'dealId' | 'created'> | Partial<DealFollowUp>) => {
        if (!currentUser) return alert("You must be logged in to manage follow-ups.");

        try {
            if ('id' in followUpData && followUpData.id) {
                // Edit mode
                await dealService.updateDealFollowUp(
                    followUpData.id as string,
                    { ...followUpData, dealId: deal.id },
                    currentUser.id
                );
            } else {
                // Create mode
                const newFollowUp: Partial<DealFollowUp> = {
                    ...followUpData,
                    dealId: deal.id,
                    status: 'Pending'
                };
                await dealService.createDealFollowUp(newFollowUp, currentUser.id);
            }
            await loadFollowUps();
            await loadHistory();
            setIsFollowUpModalOpen(false);
            setEditingFollowUp(null);
        } catch (error) {
            alert("Failed to save follow-up");
            console.error(error);
        }
    };

    const handleEditFollowUp = (followUp: DealFollowUp) => {
        setEditingFollowUp(followUp);
        setIsFollowUpModalOpen(true);
    };

    const handleDeleteFollowUp = async (followUpId: string) => {
        if (!window.confirm('Are you sure you want to delete this follow-up?')) return;
        try {
            await dealService.deleteDealFollowUp(followUpId, deal.id);
            await loadFollowUps();
            await loadHistory();
        } catch (error) {
            alert("Failed to delete follow-up");
            console.error(error);
        }
    };

    // Note handlers
    const handleAddNote = async (noteData: Omit<DealNote, 'id' | 'dealId' | 'created'> | Partial<DealNote>) => {
        if (!currentUser) return alert("You must be logged in to manage notes.");

        try {
            if ('id' in noteData && noteData.id) {
                // Edit mode
                await dealService.updateDealNote(
                    noteData.id as string,
                    { ...noteData, dealId: deal.id },
                    currentUser.id
                );
            } else {
                // Create mode
                const newNote: Partial<DealNote> = {
                    ...noteData,
                    dealId: deal.id
                };
                await dealService.createDealNote(newNote, currentUser.id);
            }
            await loadNotes();
            await loadHistory();
            setIsNoteModalOpen(false);
            setEditingNote(null);
        } catch (error) {
            alert("Failed to save note");
            console.error(error);
        }
    };

    const handleEditNote = (note: DealNote) => {
        setEditingNote(note);
        setIsNoteModalOpen(true);
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        try {
            await dealService.deleteDealNote(noteId, deal.id);
            await loadNotes();
            await loadHistory();
        } catch (error) {
            alert("Failed to delete note");
            console.error(error);
        }
    };


    return (
        <div className="h-full flex flex-col bg-background overflow-hidden font-sans">
            {/* Header */}
            <div className="p-6 bg-background flex justify-between items-start border-b border-border">
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <h1 className="text-xl font-bold text-foreground">{deal.companyName}</h1>
                        <span className="text-muted-foreground text-xs">— {deal.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getStatusColor(deal.paymentStatus)}`}>
                            {deal.paymentStatus}
                        </span>
                        <span className="text-muted-foreground text-xs flex items-center">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            Created {deal.date}
                        </span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => onEdit(deal)}
                        className="flex items-center px-4 py-2 bg-muted text-muted-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm border border-border"
                    >
                        <PencilIcon className="w-4 h-4 mr-2" /> Edit
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this deal?')) {
                                onDelete(deal.id);
                            }
                        }}
                        className="flex items-center px-4 py-2 bg-destructive/10 text-destructive font-semibold rounded-lg hover:bg-destructive/20 transition-colors text-sm border border-destructive/30"
                    >
                        <TrashIcon className="w-4 h-4 mr-2" /> Delete
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-border">
                <nav className="flex space-x-8">
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'files', label: 'Files' },
                        { id: 'follow-up', label: 'Follow Up' },
                        { id: 'proposal', label: 'Proposal' },
                        { id: 'notes', label: 'Notes' },
                        { id: 'history', label: 'History' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {activeTab === 'overview' && (
                    <div className="animate-fadeIn space-y-8">
                        {/* AI Insights Section */}
                        <div className="bg-gradient-to-br from-primary/10 to-indigo-500/10 rounded-xl border border-primary/20 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <SparklesIcon className="w-24 h-24 text-primary" />
                            </div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center">
                                    <SparklesIcon className="w-4 h-4 mr-2" />
                                    Deal Insights (Beta)
                                </h3>
                                <button
                                    onClick={handleAnalyzeDeal}
                                    disabled={isAnalyzing}
                                    className="text-xs flex items-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 border border-primary/20"
                                >
                                    {isAnalyzing ? (
                                        <>Analyzing...</>
                                    ) : (
                                        <>
                                            <ArrowPathIcon className="w-3 h-3 mr-1.5" />
                                            {aiAnalysis ? 'Refresh Analysis' : 'Analyze Deal'}
                                        </>
                                    )}
                                </button>
                            </div>

                            {aiAnalysis ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                                    <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-background/50 rounded-lg border border-primary/20 shadow-sm">
                                        <div className="text-3xl font-bold text-foreground mb-1">{aiAnalysis.score}<span className="text-lg text-muted-foreground font-normal">/100</span></div>
                                        <div className="text-xs text-primary uppercase tracking-wider font-semibold">Deal Score</div>
                                    </div>
                                    <div className="md:col-span-2 space-y-3">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Rationale</p>
                                            <p className="text-sm text-foreground/80 leading-relaxed">{aiAnalysis.rationale}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Recommended Action</p>
                                            <p className="text-sm text-primary font-medium">{aiAnalysis.nextAction}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 relative z-10">
                                    <p className="text-sm text-muted-foreground mb-2">Get AI-powered insights on this deal's quality and win probability.</p>
                                    <button
                                        onClick={handleAnalyzeDeal}
                                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                                    >
                                        Generate Analysis
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Section: Identifiers */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Identifiers</h3>
                                <div className="space-y-3">
                                    <DetailItem label="CIF Number" value={deal.cifNumber} icon={HashtagIcon} />
                                    <DetailItem label="Brand" value={getBrandName(deal.brand)} icon={TagIcon} />
                                </div>
                            </div>

                            {/* Section: Contact */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Contact Information</h3>
                                <div className="space-y-3">
                                    <DetailItem label="Email Address" value={deal.email} icon={EnvelopeIcon} />
                                    <DetailItem label="Contact Number" value={deal.contactNo} icon={PhoneIcon} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Section: Service Details */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Service Details</h3>
                                <div className="space-y-3">
                                    <DetailItem label="Service Type" value={getServiceName(deal.services)} icon={BriefcaseIcon} />
                                    <DetailItem label="Service Closed" value={deal.serviceClosed} icon={CheckCircleIcon} />
                                </div>
                            </div>

                            {/* Section: Financials */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Financials</h3>
                                <div className="space-y-3">
                                    <DetailItem
                                        label="Service Amount"
                                        value={new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(deal.serviceAmount)}
                                        icon={BanknotesIcon}
                                    />
                                    <DetailItem label="Closing Date" value={deal.closingDate} icon={CalendarIcon} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Source</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DetailItem label="Lead Source" value={getLeadSourceName(deal.leadSource)} icon={TagIcon} />
                            </div>
                        </div>

                        {customFields.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Additional Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {customFields.map(field => {
                                        const value = deal.custom_data?.[field.id];
                                        return (
                                            <DetailItem
                                                key={field.id}
                                                label={field.label}
                                                value={renderCustomValue(field, value)}
                                                icon={BriefcaseIcon}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="animate-fadeIn p-4 border border-border rounded-xl bg-card shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-foreground">Deal Documents</h3>
                            <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                                <PlusIcon className="w-4 h-4" />
                                {isUploading ? 'Uploading...' : 'Upload File'}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>
                        {documents && documents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {documents.map((doc, idx) => (
                                    <div key={idx} className="p-4 bg-muted border border-border rounded-xl hover:border-primary/30 transition-colors group relative">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-background rounded-lg text-muted-foreground">
                                                <DocumentTextIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate" title={doc.fileName}>{doc.fileName}</p>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteDocument(doc)}
                                                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <DocumentTextIcon className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                                <h4 className="text-muted-foreground font-medium">No documents yet</h4>
                                <p className="text-sm text-muted-foreground/60 mt-1">Attach proposals, contracts or other relevant files.</p>
                            </div>
                        )}
                    </div>
                )
                }

                {activeTab === 'history' && (
                    <div className="animate-fadeIn">
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-6">
                            {history.length > 0 ? (
                                <div className="space-y-6">
                                    {history.map((item) => (
                                        <div key={item.id} className="flex gap-4">
                                            <div className="flex-shrink-0">
                                                {/* Placeholder Avatar */}
                                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                                                    {item.userAvatar ? (
                                                        <img src={item.userAvatar} alt={item.userName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-muted-foreground">{item.userName.substring(0, 2).toUpperCase()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        {item.type} — {item.action} By <span className="text-foreground font-medium">{item.userName}</span>
                                                    </span>
                                                    <span className="text-xs text-primary hover:underline cursor-pointer">View Details</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground/60 mt-1">
                                                    {new Date(item.date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {item.details && item.type !== 'Note' && (
                                                    <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50">
                                                        {item.details}
                                                    </div>
                                                )}
                                                {item.type === 'Note' && item.metadata?.title && (
                                                    <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50">
                                                        <span className="font-semibold text-foreground/80">{item.metadata.title}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ClockIcon className="w-8 h-8 text-muted-foreground/50" />
                                    </div>
                                    <h4 className="text-muted-foreground font-medium">No history yet</h4>
                                    <p className="text-sm text-muted-foreground/60 mt-1">Actions on this deal will appear here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {activeTab === 'follow-up' && (
                    <div className="animate-fadeIn">
                        <button
                            onClick={() => {
                                setEditingFollowUp(null);
                                setIsFollowUpModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium mb-6 shadow-sm"
                        >
                            <PlusIcon className="w-5 h-5" />
                            New Follow Up
                        </button>

                        {/* Table */}
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Follow Up</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remark</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {followUps.length > 0 ? (
                                        followUps.map((followUp) => (
                                            <tr key={followUp.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                                                <td className="p-4 text-sm text-muted-foreground">
                                                    {new Date(followUp.created).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-sm text-muted-foreground">
                                                    {new Date(followUp.nextFollowUp).toLocaleDateString()} {followUp.startTime}
                                                </td>
                                                <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                                                    {followUp.remark || '-'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${followUp.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                                        followUp.status === 'Cancelled' ? 'bg-destructive/10 text-destructive' :
                                                            'bg-yellow-500/10 text-yellow-600'
                                                        }`}>
                                                        {followUp.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 flex gap-2">
                                                    <button
                                                        onClick={() => handleEditFollowUp(followUp)}
                                                        className="text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFollowUp(followUp.id)}
                                                        className="text-destructive hover:text-destructive/80 transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <ClockIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                                    <p className="text-muted-foreground font-medium">- No record found. -</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="animate-fadeIn">
                        <button
                            onClick={() => {
                                setEditingNote(null);
                                setIsNoteModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium mb-6 shadow-sm"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Add Note
                        </button>

                        {/* Table */}
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note Detail</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notes.length > 0 ? (
                                        notes.map((note) => (
                                            <tr key={note.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="text-sm font-medium text-foreground mb-1">{note.title}</div>
                                                    <div
                                                        className="text-sm text-muted-foreground/80 line-clamp-2"
                                                        dangerouslySetInnerHTML={{ __html: note.detail }}
                                                    />
                                                </td>
                                                <td className="p-4 text-sm text-muted-foreground">
                                                    {new Date(note.created).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 flex gap-2">
                                                    <button
                                                        onClick={() => handleEditNote(note)}
                                                        className="text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteNote(note.id)}
                                                        className="text-destructive hover:text-destructive/80 transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="p-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <DocumentTextIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                                    <p className="text-muted-foreground font-medium">- No record found. -</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {['proposal', 'history'].includes(activeTab) && (
                    <div className="animate-fadeIn flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-muted p-6 rounded-full mb-6">
                            <ArrowPathIcon className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-muted-foreground capitalize">{activeTab.replace('-', ' ')} Content Coming Soon</h3>
                        <p className="text-muted-foreground/60 mt-2 max-w-sm">
                            We are currently building this feature to help you better manage your deal lifecycle.
                        </p>
                        <button className="mt-8 px-6 py-2 bg-muted text-muted-foreground rounded-lg text-sm border border-border hover:bg-accent transition-colors">
                            Subscribe for Updates
                        </button>
                    </div>
                )}
            </div >

            {/* Modals */}
            <AddFollowUpModal
                isOpen={isFollowUpModalOpen}
                onClose={() => {
                    setIsFollowUpModalOpen(false);
                    setEditingFollowUp(null);
                }}
                onSave={handleAddFollowUp}
                dealName={deal.companyName}
                initialData={editingFollowUp}
            />

            <AddNoteModal
                isOpen={isNoteModalOpen}
                onClose={() => {
                    setIsNoteModalOpen(false);
                    setEditingNote(null);
                }}
                onSave={handleAddNote}
                initialData={editingNote}
            />
        </div >
    );
};
