import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/icons';

export const LeadsPage: React.FC = () => {
    const { leads, deleteLead } = useData();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLeads = leads.filter(lead =>
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this lead?')) {
            deleteLead(id);
        }
    };

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

    return (
        <div className="p-8">
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Leads Management</h2>
                        <p className="text-sm text-gray-400 mt-1">Total leads: {leads.length}</p>
                    </div>
                    <button
                        onClick={() => navigate('/sales/leads/add')}
                        className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Lead
                    </button>
                </div>

                <div className="p-4 border-b border-gray-800 bg-gray-900">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search leads by company or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2.5 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-900 border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Company Name</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Mobile Number</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Email</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Lead Source</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.length > 0 ? (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-500">{lead.date}</td>
                                        <td className="px-6 py-4 font-medium text-white">{lead.companyName}</td>
                                        <td className="px-6 py-4">{lead.mobileNumber}</td>
                                        <td className="px-6 py-4 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">{lead.email}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-xs text-gray-300 border border-gray-700">
                                                {lead.leadSource}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => navigate(`/sales/leads/view/${lead.id}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-blue-400 transition-colors"
                                                    title="View"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/sales/leads/edit/${lead.id}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(lead.id)}
                                                    className="p-2 rounded-lg hover:bg-red-900/20 text-gray-400 hover:text-red-400 transition-colors group"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="text-center p-12">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium text-gray-400">No leads found</p>
                                            <p className="text-sm">Try adjusting your search terms or add a new lead.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
