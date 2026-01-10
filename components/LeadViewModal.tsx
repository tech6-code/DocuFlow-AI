
import React from 'react';
import { XMarkIcon, PencilIcon, CalendarDaysIcon as CalendarIcon, UsersIcon as UserIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon, TagIcon, ChatBubbleBottomCenterTextIcon, MagnifyingGlassIcon } from './icons';
import { Lead, User } from '../types';

interface LeadViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    users: User[];
    onEdit: (id: string) => void;
}

export const LeadViewModal: React.FC<LeadViewModalProps> = ({ isOpen, onClose, lead, users, onEdit }) => {
    if (!isOpen || !lead) return null;

    const leadOwnerName = users.find(u => u.id === lead.leadOwner)?.name || '-';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Follow up': return 'bg-yellow-900/40 text-yellow-300 border border-yellow-800';
            case 'Submitted': return 'bg-purple-900/40 text-purple-300 border border-purple-800';
            case 'Lost to competitor': return 'bg-red-900/40 text-red-300 border border-red-800';
            case 'Convert as customer': return 'bg-emerald-900/40 text-emerald-300 border border-emerald-800';
            case 'Dropped': return 'bg-gray-700/40 text-gray-300 border border-gray-600';
            case 'Waiting for client replay': return 'bg-orange-900/40 text-orange-300 border border-orange-800';
            case 'Others': return 'bg-indigo-900/40 text-indigo-300 border border-indigo-800';
            default: return 'bg-gray-700 text-gray-300 border border-gray-600';
        }
    };

    const DetailItem = ({ label, value, icon: Icon }: { label: string, value: string | undefined, icon: any }) => (
        <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-800 flex items-start space-x-3">
            <div className="p-2 bg-gray-900/50 rounded-lg text-gray-400">
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-sm text-white font-medium">{value || '-'}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">{lead.companyName}</h2>
                        <div className="flex items-center space-x-3">
                            <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${getStatusColor(lead.status)}`}>
                                {lead.status}
                            </span>
                            <span className="text-gray-500 text-xs flex items-center">
                                <CalendarIcon className="w-3 h-3 mr-1" />
                                Added {lead.date}
                            </span>
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => onEdit(lead.id)}
                            className="p-2 bg-blue-600/10 text-blue-400 rounded-full hover:bg-blue-600/20 transition-colors"
                            title="Edit Lead"
                        >
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Contact */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Contact Information</h3>
                            <div className="space-y-3">
                                <DetailItem label="Email Address" value={lead.email} icon={EnvelopeIcon} />
                                <DetailItem label="Mobile Number" value={lead.mobileNumber} icon={PhoneIcon} />
                            </div>
                        </div>

                        {/* Section: Professional */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Professional Details</h3>
                            <div className="space-y-3">
                                <DetailItem label="Brand" value={lead.brand} icon={TagIcon} />
                                <DetailItem label="Lead Source" value={lead.leadSource} icon={MagnifyingGlassIcon} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Management */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Management</h3>
                            <div className="space-y-3">
                                <DetailItem label="Lead Owner" value={leadOwnerName} icon={UserIcon} />
                                <DetailItem label="Qualification" value={lead.leadQualification} icon={BriefcaseIcon} />
                            </div>
                        </div>

                        {/* Section: Service */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Service & Timeline</h3>
                            <div className="space-y-3">
                                <DetailItem label="Service Required" value={lead.serviceRequired} icon={BriefcaseIcon} />
                                <DetailItem label="Expected Closing" value={lead.closingDate} icon={CalendarIcon} />
                            </div>
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div className="mt-8 space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Remarks & Notes</h3>
                        <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800 flex items-start space-x-3">
                            <div className="p-2 bg-gray-900/50 rounded-lg text-gray-400">
                                <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed italic">
                                {lead.remarks || 'No additional remarks provided for this lead.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-900/30">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
