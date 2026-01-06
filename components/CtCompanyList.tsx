
import React, { useState } from 'react';
import type { Company } from '../types';
import { BuildingOfficeIcon, IdentificationIcon, CalendarDaysIcon, ArrowRightIcon, BriefcaseIcon, MagnifyingGlassIcon, PlusIcon } from './icons';

interface CtCompanyListProps {
    companies: Company[];
    onAddCompany?: () => void;
    onSelectCompany: (company: Company) => void;
    title?: string;
}

export const CtCompanyList: React.FC<CtCompanyListProps> = ({ companies, onSelectCompany, onAddCompany, title }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.trn.includes(searchTerm)
    );

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{title || "Select Company"}</h2>
                    <p className="mt-1 text-sm text-gray-400">Search and select a customer to proceed.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or TRN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm"
                        />
                    </div>
                    {onAddCompany && (
                        <button
                            onClick={onAddCompany}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-md whitespace-nowrap"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" />
                            Add New
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-300 uppercase bg-gray-800 border-b border-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Company Name</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">TRN</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Business Type</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Reporting Period</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCompanies.length > 0 ? (
                                filteredCompanies.map(company => (
                                    <tr
                                        key={company.id}
                                        onClick={() => onSelectCompany(company)}
                                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center mr-3 ring-1 ring-gray-700">
                                                    <BuildingOfficeIcon className="w-4 h-4 text-white" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-white">{company.name}</div>
                                                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{company.address}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <IdentificationIcon className="w-4 h-4 mr-2 text-gray-500" />
                                                <span className="font-mono text-gray-300">{company.corporateTaxTrn || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <BriefcaseIcon className="w-4 h-4 mr-2 text-gray-500" />
                                                {company.businessType || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <CalendarDaysIcon className="w-4 h-4 mr-2 text-gray-500" />
                                                Annual
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-blue-400 group-hover:translate-x-1 transition-transform">
                                                <ArrowRightIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mb-3">
                                                <BuildingOfficeIcon className="w-6 h-6 text-gray-600" />
                                            </div>
                                            <p className="text-gray-400 font-medium">No companies found</p>
                                            <p className="text-sm text-gray-600 mt-1">Try adjusting your search or add a new customer.</p>
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
