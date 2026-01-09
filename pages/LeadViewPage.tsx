import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ArrowLeftIcon, PencilIcon } from '../components/icons';

export const LeadViewPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { leads } = useData();

    const lead = leads.find(l => l.id === id);

    if (!lead) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-400">Lead not found.</p>
                <button onClick={() => navigate('/sales/leads')} className="mt-4 text-blue-400 hover:text-blue-300">
                    Back to Leads
                </button>
            </div>
        );
    }

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

    const DetailItem = ({ label, value }: { label: string, value: string }) => (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-800">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-white font-medium">{value}</p>
        </div>
    );

    return (
        <div className="p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/sales/leads')}
                        className="flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-2" />
                        Back to Leads
                    </button>
                    <button
                        onClick={() => navigate(`/sales/leads/edit/${lead.id}`)}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors text-sm shadow-sm"
                    >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Edit Lead
                    </button>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-2">{lead.companyName}</h1>
                                <div className="flex items-center space-x-3">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                                        {lead.status}
                                    </span>
                                    <span className="text-gray-500 text-sm border-l border-gray-700 pl-3">
                                        Added on {lead.date}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DetailItem label="Contact Email" value={lead.email} />
                        <DetailItem label="Mobile Number" value={lead.mobileNumber} />
                        <DetailItem label="Lead Source" value={lead.leadSource} />
                    </div>
                </div>
            </div>
        </div>
    );
};
