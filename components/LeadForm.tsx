
import React, { useState, useEffect } from 'react';
import { PlusIcon, UserCircleIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon, TagIcon, FunnelIcon, BriefcaseIcon, CalendarDaysIcon as CalendarIcon, ChatBubbleBottomCenterTextIcon } from './icons';
import { Lead, SalesSettings, User } from '../types';

interface LeadFormProps {
    lead: Lead | null;
    onSave: (leadData: any) => void;
    onCancel: () => void;
    salesSettings: SalesSettings;
    users: User[];
}

export const LeadForm: React.FC<LeadFormProps> = ({ lead, onSave, onCancel, salesSettings, users }) => {
    const isEditMode = Boolean(lead);

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
        }
    }, [lead]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl">
            {/* Header */}
            <div className="flex items-center space-x-3 pb-6 border-b border-gray-800">
                <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500">
                    {isEditMode ? <PlusIcon className="w-6 h-6 rotate-45" /> : <PlusIcon className="w-6 h-6" />}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Lead Details' : 'Create New Lead'}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Fill in the information to {isEditMode ? 'update' : 'add'} a lead</p>
                </div>
            </div>

            {/* Section: Basic Info */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                    <UserCircleIcon className="w-4 h-4" />
                    <span>Basic Information</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Company Name</label>
                        <div className="relative">
                            <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                name="companyName"
                                required
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="Enter company name"
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Registration Date</label>
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="date"
                                name="date"
                                required
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Contact Email</label>
                        <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Mobile Number</label>
                        <div className="relative">
                            <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="tel"
                                name="mobileNumber"
                                required
                                value={formData.mobileNumber}
                                onChange={handleChange}
                                placeholder="+971 50..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                            />
                        </div>
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Brand</label>
                        <select
                            name="brand"
                            value={formData.brand}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">Select Brand</option>
                            {salesSettings.brands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Lead Source</label>
                        <select
                            name="leadSource"
                            required
                            value={formData.leadSource}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">Select Source</option>
                            {salesSettings.leadSources.map(source => (
                                <option key={source.id} value={source.name}>{source.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Lead Owner</label>
                        <select
                            name="leadOwner"
                            value={formData.leadOwner}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">Select Owner</option>
                            {salesSettings.leadOwners.map(owner => (
                                <option key={owner} value={owner}>{owner}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Status</label>
                        <select
                            name="status"
                            required
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Qualification</label>
                        <select
                            name="leadQualification"
                            value={formData.leadQualification}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">Select Qualification</option>
                            {salesSettings.leadQualifications.map(qual => (
                                <option key={qual.id} value={qual.name}>{qual.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Service Required</label>
                        <select
                            name="serviceRequired"
                            value={formData.serviceRequired}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            <option value="">Select Service</option>
                            {salesSettings.servicesRequired.map(service => (
                                <option key={service.id} value={service.name}>{service.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Section: Timeline & Remarks */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-800/50">
                    <FunnelIcon className="w-4 h-4" />
                    <span>Timeline & Notes</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Last Contact</label>
                        <input
                            type="date"
                            name="lastContact"
                            value={formData.lastContact}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Closing Cycle</label>
                        <input
                            type="text"
                            name="closingCycle"
                            value={formData.closingCycle}
                            onChange={handleChange}
                            placeholder="e.g. 1 month"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 ml-1">Expected Closing</label>
                        <input
                            type="date"
                            name="closingDate"
                            value={formData.closingDate}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400 ml-1 flex items-center">
                        <ChatBubbleBottomCenterTextIcon className="w-3 h-3 mr-1" /> Remarks
                    </label>
                    <textarea
                        name="remarks"
                        rows={3}
                        value={formData.remarks}
                        onChange={handleChange}
                        placeholder="Add any additional notes or details about this lead..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600 resize-none"
                    />
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex justify-end space-x-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-8 py-3 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition-colors border border-gray-700"
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
        </form>
    );
};
