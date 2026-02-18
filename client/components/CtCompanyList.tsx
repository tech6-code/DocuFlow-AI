
import React, { useState } from 'react';
import type { Company } from '../types';
import { BuildingOfficeIcon, IdentificationIcon, CalendarDaysIcon, ArrowRightIcon, BriefcaseIcon, MagnifyingGlassIcon, PlusIcon } from './icons';
import { Pagination } from './Pagination';

interface CtCompanyListProps {
    companies: Company[];
    onAddCompany?: () => void;
    onSelectCompany: (company: Company) => void;
    title?: string;
}

export const CtCompanyList: React.FC<CtCompanyListProps> = ({ companies, onSelectCompany, onAddCompany, title }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredCompanies = companies.filter(company =>
        (company.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.trn || '').includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
    const paginatedCompanies = filteredCompanies.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{title || "Select Company"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Search and select a customer to proceed.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or TRN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2 text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
                        />
                    </div>
                    {onAddCompany && (
                        <button
                            onClick={onAddCompany}
                            className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors shadow-md whitespace-nowrap"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" />
                            Add New
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Company Name</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">TRN</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Business Type</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider">Reporting Period</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCompanies.length > 0 ? (
                                paginatedCompanies.map(company => (
                                    <tr
                                        key={company.id}
                                        onClick={() => onSelectCompany(company)}
                                        className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center mr-3 ring-1 ring-border">
                                                    <BuildingOfficeIcon className="w-4 h-4 text-foreground" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground">{company.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{company.address}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <IdentificationIcon className="w-4 h-4 mr-2 text-muted-foreground/50" />
                                                <span className="font-mono text-foreground/80">{company.corporateTaxTrn || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <BriefcaseIcon className="w-4 h-4 mr-2 text-muted-foreground/50" />
                                                <span className="text-foreground/80">{company.businessType || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-foreground/80">
                                                <CalendarDaysIcon className="w-4 h-4 mr-2 text-muted-foreground/50" />
                                                Annual
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-primary group-hover:translate-x-1 transition-transform">
                                                <ArrowRightIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                                                <BuildingOfficeIcon className="w-6 h-6 text-muted-foreground/30" />
                                            </div>
                                            <p className="text-muted-foreground font-medium">No companies found</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or add a new customer.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={filteredCompanies.length}
                    itemsPerPage={itemsPerPage}
                    itemName="companies"
                />
            </div>
        </div>
    );
};
