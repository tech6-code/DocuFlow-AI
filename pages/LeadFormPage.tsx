import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { XMarkIcon } from '../components/icons';
import { Lead } from '../types';

export const LeadFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { leads, addLead, updateLead } = useData();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        companyName: '',
        mobileNumber: '',
        email: '',
        leadSource: '',
        status: ''
    });

    useEffect(() => {
        if (isEditMode && id) {
            const leadToEdit = leads.find(l => l.id === id);
            if (leadToEdit) {
                setFormData({
                    date: leadToEdit.date,
                    companyName: leadToEdit.companyName,
                    mobileNumber: leadToEdit.mobileNumber,
                    email: leadToEdit.email,
                    leadSource: leadToEdit.leadSource,
                    status: leadToEdit.status
                });
            } else {
                navigate('/sales/leads');
            }
        }
    }, [isEditMode, id, leads, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDropdownChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'status' && value === 'Convert as customer') {
            if (window.confirm('Do you want to convert this lead to a customer?')) {
                // Should update the status in the backend before navigating?
                // If it is an existing lead (isEditMode), yes.
                if (isEditMode && id) {
                    await updateLead({ ...formData, status: value, id } as Lead);
                }

                navigate('/customers', {
                    state: {
                        prefill: {
                            companyName: formData.companyName,
                            email: formData.email,
                            mobile: formData.mobileNumber
                        }
                    }
                });
                return;
            } else {
                return;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditMode && id) {
            updateLead({ ...formData, id } as Lead);
        } else {
            addLead(formData);
        }
        navigate('/sales/leads');
    };

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
                        <h3 className="text-xl font-semibold text-white">{isEditMode ? 'Edit Lead' : 'Add New Lead'}</h3>
                        <button type="button" onClick={() => navigate('/sales/leads')} className="p-2 rounded-full hover:bg-gray-800 transition-colors">
                            <XMarkIcon className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    id="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                                <select
                                    name="status"
                                    id="status"
                                    value={formData.status}
                                    onChange={handleDropdownChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="" disabled>Select Status</option>
                                    <option value="Follow up">Follow up</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="Lost to competitor">Lost to competitor</option>
                                    <option value="Convert as customer">Convert as customer</option>
                                    <option value="Dropped">Dropped</option>
                                    <option value="Waiting for client replay">Waiting for client replay</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-gray-400 mb-2">Company Name</label>
                            <input
                                type="text"
                                name="companyName"
                                id="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="Enter company name"
                                className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-400 mb-2">Mobile Number</label>
                                <input
                                    type="tel"
                                    name="mobileNumber"
                                    id="mobileNumber"
                                    value={formData.mobileNumber}
                                    onChange={handleChange}
                                    placeholder="+971 50..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@company.com"
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="leadSource" className="block text-sm font-medium text-gray-400 mb-2">Lead Source</label>
                            <select
                                name="leadSource"
                                id="leadSource"
                                value={formData.leadSource}
                                onChange={handleDropdownChange}
                                className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            >
                                <option value="" disabled>Select source</option>
                                <option value="Agent">Agent</option>
                                <option value="Call">Call</option>
                                <option value="Mail">Mail</option>
                                <option value="Reference">Reference</option>
                                <option value="Tawk">Tawk</option>
                                <option value="Whatsapp">Whatsapp</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900/50 rounded-b-lg">
                        <button type="button" onClick={() => navigate('/sales/leads')} className="px-6 py-2.5 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-sm border border-gray-700">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors text-sm shadow-lg shadow-blue-900/20">
                            {isEditMode ? 'Update Lead' : 'Create Lead'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
