import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Deal } from '../types';
import { useData } from '../contexts/DataContext';
import { DealModal } from './DealModal';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { EnvelopeIcon, PencilIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon, IdentificationIcon, BuildingOfficeIcon, UserGroupIcon, CalendarDaysIcon, BriefcaseIcon, MapPinIcon, EyeIcon, Bars3Icon } from './icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-start gap-2">
            <button
                {...attributes}
                {...listeners}
                className="mt-4 p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors"
            >
                <Bars3Icon className="w-5 h-5" />
            </button>
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
};

interface CustomerDetailProps {
    customers: Customer[];
    onEdit: (customer: Customer) => void;
    onDelete: (id: string) => void;
    canEdit: boolean;
    canDelete: boolean;
}

const formatCurrency = (amount: number, currencyCode: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
};

const DataRow: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-3 py-1.5 items-center border-b border-gray-800/30 last:border-0 group">
        <span className="text-xs font-medium text-gray-500 group-hover:text-gray-400 transition-colors uppercase tracking-tight">{label}</span>
        <span className="col-span-2 text-sm text-gray-100 font-medium break-words leading-tight">{value || <span className="text-gray-700">-</span>}</span>
    </div>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customers, onEdit, onDelete, canEdit, canDelete }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { deals, addDeal, updateDeal, deleteDeal, salesSettings, updateSalesSettings } = useData();
    const customer = customers.find(c => c.id === id);
    const [activeTab, setActiveTab] = React.useState<'overview' | 'deal'>('overview');
    const [expandedSections, setExpandedSections] = React.useState<string[]>(['Registration']);
    const [isDealModalOpen, setIsDealModalOpen] = React.useState(false);
    const [prefillData, setPrefillData] = React.useState<Partial<Deal> | null>(null);
    const [isViewMode, setIsViewMode] = React.useState(false);
    const [customFields, setCustomFields] = React.useState<CustomField[]>([]);

    React.useEffect(() => {
        salesSettingsService.getCustomFields('customers').then(setCustomFields);
    }, []);

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    // Load service categories dynamically from database to ensure exact matching
    const serviceCategories = salesSettings.servicesRequired;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = serviceCategories.findIndex((item) => item.id === active.id);
            const newIndex = serviceCategories.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(serviceCategories, oldIndex, newIndex);

            updateSalesSettings({
                ...salesSettings,
                servicesRequired: newItems
            });
        }
    };

    if (!id) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Select a customer to view details
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Customer not found
            </div>
        );
    }

    const name = customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`;

    // Filter deals for this customer
    const customerDeals = deals.filter(d => d.cifNumber === customer.cifNumber);

    // Helper function to get brand name from UUID
    const getBrandName = (brandId: string): string => {
        const brand = salesSettings.brands.find(b => b.id === brandId);
        return brand?.name || brandId;
    };

    // Helper function to get service name from UUID
    const getServiceName = (serviceId: string): string => {
        const service = salesSettings.servicesRequired.find(s => s.id === serviceId);
        return service?.name || serviceId;
    };

    const renderCustomValue = (field: CustomField, value: any) => {
        if (value === undefined || value === null || value === '') return '-';
        if (field.type === 'checkbox') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    };

    const handleNewDeal = (category: string) => {
        // Find the service UUID from servicesRequired that matches the category name
        const serviceMatch = salesSettings.servicesRequired.find(
            s => s.name.toLowerCase() === category.toLowerCase()
        );

        setPrefillData({
            cifNumber: customer.cifNumber,
            companyName: customer.companyName || `${customer.firstName} ${customer.lastName}`,
            name: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            contactNo: customer.mobile || customer.workPhone,
            services: serviceMatch?.id || '' // Use UUID instead of name
        });
        setIsViewMode(false);
        setIsDealModalOpen(true);
    };

    const handleViewDeal = (deal: Deal) => {
        setPrefillData(deal);
        setIsViewMode(true);
        setIsDealModalOpen(true);
    };

    const handleEditDeal = (deal: Deal) => {
        setPrefillData(deal);
        setIsViewMode(false);
        setIsDealModalOpen(true);
    };

    const handleDeleteDeal = async (dealId: string) => {
        if (window.confirm('Are you sure you want to delete this deal?')) {
            await deleteDeal(dealId);
        }
    };

    const handleSaveDeal = async (deal: Omit<Deal, 'id'>) => {
        if (prefillData && 'id' in prefillData) {
            await updateDeal({ ...deal, id: prefillData.id as string });
        } else {
            await addDeal(deal);
        }
        setIsDealModalOpen(false);
        setPrefillData(null);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gray-900 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">{name}</h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                        {customer.email && (
                            <span className="flex items-center">
                                <EnvelopeIcon className="w-4 h-4 mr-1" /> {customer.email}
                            </span>
                        )}
                        {customer.trn && (
                            <>
                                <span className="text-gray-600">•</span>
                                <span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-xs">{customer.trn}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex space-x-2">
                    {canEdit && (
                        <button
                            onClick={() => onEdit(customer)}
                            className="flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                            <PencilIcon className="w-4 h-4 mr-2" /> Edit
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this customer?')) {
                                    onDelete(customer.id);
                                }
                            }}
                            className="flex items-center px-3 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40 transition-colors text-sm"
                        >
                            <TrashIcon className="w-4 h-4 mr-2" /> Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-gray-800">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('deal')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'deal'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                            }`}
                    >
                        Deal
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'overview' ? (
                    <div className="p-8 space-y-8 max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Primary Contact & Details */}
                            <div className="space-y-8">
                                <section>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <IdentificationIcon className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Contact Information</h3>
                                    </div>
                                    <div className="bg-gray-800/40 rounded-xl p-5 space-y-4 border border-gray-800">
                                        <DataRow label="CIF Number" value={customer.cifNumber} />
                                        <DataRow label="Email" value={customer.email} />
                                        <DataRow label="Mobile" value={customer.mobile} />
                                        <DataRow label="Work Phone" value={customer.workPhone} />
                                        <DataRow label="Currency" value={customer.currency} />
                                        <DataRow label="Language" value={customer.language} />
                                        <DataRow label="Portal Access" value={customer.portalAccess ? 'Enabled' : 'Disabled'} />
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <BuildingOfficeIcon className="w-5 h-5 text-purple-400" />
                                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Business Details</h3>
                                    </div>
                                    <div className="bg-gray-800/40 rounded-xl p-5 space-y-4 border border-gray-800">
                                        <DataRow label="Entity Type" value={customer.entityType} />
                                        <DataRow label="Entity Sub Type" value={customer.entitySubType} />
                                        <DataRow label="Incorporation Date" value={customer.incorporationDate} />
                                        <DataRow label="Business Activity" value={customer.businessActivity} />
                                        <DataRow label="Trade License #" value={customer.tradeLicenseNumber} />
                                        <DataRow label="Authority" value={customer.tradeLicenseAuthority} />
                                        <DataRow label="Issue Date" value={customer.tradeLicenseIssueDate} />
                                        <DataRow label="Expiry Date" value={customer.tradeLicenseExpiryDate} />
                                        <DataRow label="Freezone" value={customer.isFreezone ? `Yes (${customer.freezoneName})` : 'No'} />
                                        <DataRow label="Share Capital" value={customer.shareCapital} />
                                        <DataRow label="Auth. Signatories" value={customer.authorisedSignatories} />
                                        <DataRow label="Reg. Number" value={customer.businessRegistrationNumber} />
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <MapPinIcon className="w-5 h-5 text-red-400" />
                                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Addresses</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-800">
                                            <h4 className="text-xs font-medium text-gray-500 mb-2">Billing Address</h4>
                                            <p className="text-sm text-white whitespace-pre-line leading-relaxed">
                                                {customer.billingAddress || 'No billing address provided'}
                                            </p>
                                        </div>
                                        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-800">
                                            <h4 className="text-xs font-medium text-gray-500 mb-2">Shipping Address</h4>
                                            <p className="text-sm text-white whitespace-pre-line leading-relaxed">
                                                {customer.shippingAddress || 'No shipping address provided'}
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Financials, Tax & Others */}
                            <div className="space-y-8">
                                <section>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <BriefcaseIcon className="w-5 h-5 text-yellow-400" />
                                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Tax & Financials</h3>
                                    </div>
                                    <div className="bg-gray-800/40 rounded-xl p-5 space-y-6 border border-gray-800">
                                        <div>
                                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 px-2 border-l-2 border-blue-400">VAT Information</h4>
                                            <div className="space-y-4">
                                                <DataRow label="Tax Treatment" value={customer.taxTreatment} />
                                                <DataRow label="TRN" value={customer.trn} />
                                                <DataRow label="VAT Reg. Date" value={customer.vatRegisteredDate} />
                                                <DataRow label="Reporting Period" value={customer.vatReportingPeriod} />
                                                <DataRow label="First Filing Period" value={customer.firstVatFilingPeriod} />
                                                <DataRow label="Filing Due Date" value={customer.vatFilingDueDate} />
                                                <DataRow label="Place of Supply" value={customer.placeOfSupply} />
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-purple-400 uppercase mb-3 px-2 border-l-2 border-purple-400">Corporate Tax Information</h4>
                                            <div className="space-y-4">
                                                <DataRow label="CT Treatment" value={customer.corporateTaxTreatment} />
                                                <DataRow label="CT TRN" value={customer.corporateTaxTrn} />
                                                <DataRow label="CT Reg. Date" value={customer.corporateTaxRegisteredDate} />
                                                <DataRow label="CT Period" value={customer.corporateTaxPeriod} />
                                                <DataRow label="First Period Start" value={customer.firstCorporateTaxPeriodStart} />
                                                <DataRow label="First Period End" value={customer.firstCorporateTaxPeriodEnd} />
                                                <DataRow label="CT Filing Due Date" value={customer.corporateTaxFilingDueDate} />
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-green-400 uppercase mb-3 px-2 border-l-2 border-green-400">Opening Balance</h4>
                                            <div className="space-y-4">
                                                <DataRow label="Amount" value={formatCurrency(customer.openingBalance, customer.currency)} />
                                                <DataRow label="Payment Terms" value={customer.paymentTerms} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {customer.contactPersons && customer.contactPersons.length > 0 && (
                                    <section>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <UserGroupIcon className="w-5 h-5 text-indigo-400" />
                                            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Contact Persons</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {customer.contactPersons.map((person, idx) => (
                                                <div key={idx} className="bg-gray-800/40 rounded-xl p-4 border border-gray-800 hover:bg-gray-800/60 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-medium text-white">{person.salutation} {person.firstName} {person.lastName}</span>
                                                        <span className="text-xs text-gray-500">#{idx + 1}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div className="flex items-center text-gray-400">
                                                            <EnvelopeIcon className="w-3.5 h-3.5 mr-1.5" />
                                                            {person.email || '-'}
                                                        </div>
                                                        <div className="flex items-center text-gray-400">
                                                            <IdentificationIcon className="w-3.5 h-3.5 mr-1.5" />
                                                            {person.mobile || person.workPhone || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {customer.shareholders && customer.shareholders.length > 0 && (
                                    <section>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <UserIcon className="w-5 h-5 text-pink-400" />
                                            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Shareholders</h3>
                                        </div>
                                        <div className="bg-gray-800/40 rounded-xl overflow-hidden border border-gray-800">
                                            <table className="w-full text-left text-xs text-gray-400">
                                                <thead className="bg-gray-900/50 text-gray-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium">Name</th>
                                                        <th className="px-4 py-3 font-medium">Type</th>
                                                        <th className="px-4 py-3 font-medium">Nationality</th>
                                                        <th className="px-4 py-3 font-medium text-right">%</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800">
                                                    {customer.shareholders.map((sh, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-700/20 transition-colors">
                                                            <td className="px-4 py-3 text-white font-medium">{sh.name}</td>
                                                            <td className="px-4 py-3">{sh.ownerType}</td>
                                                            <td className="px-4 py-3">{sh.nationality}</td>
                                                            <td className="px-4 py-3 text-right text-blue-400 font-mono">{sh.percentage}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}

                                {customer.remarks && (
                                    <section>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                <span className="text-sm font-bold text-gray-400">!</span>
                                            </div>
                                            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Remarks</h3>
                                        </div>
                                        <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-5">
                                            <p className="text-sm text-gray-300 italic leading-relaxed">
                                                "{customer.remarks}"
                                            </p>
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>

                        {/* Custom Fields Section */}
                        {customFields.length > 0 && (
                            <div className="space-y-8">
                                <section>
                                    <div className="flex items-center space-x-2 mb-4">
                                        <BriefcaseIcon className="w-5 h-5 text-teal-400" />
                                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Additional Information</h3>
                                    </div>
                                    <div className="bg-gray-800/40 rounded-xl p-5 space-y-4 border border-gray-800">
                                        {customFields.map(field => (
                                            <DataRow
                                                key={field.id}
                                                label={field.label}
                                                value={renderCustomValue(field, customer.custom_data?.[field.id])}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-6 space-y-4 font-sans">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-white">Service Categories</h2>
                            <button className="text-blue-400 text-sm hover:underline flex items-center transition-all" onClick={() => navigate('/sales/deals')}>
                                Go to transactions <ChevronRightIcon className="w-4 h-4 ml-1" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={serviceCategories.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                    {serviceCategories.map((service) => {
                                        const category = service.name;
                                        const isExpanded = expandedSections.includes(category);
                                        // Filter deals by matching service name (resolved from UUID) with category
                                        const currentDeals = customerDeals.filter(d => {
                                            const serviceName = getServiceName(d.services);
                                            console.log(`Comparing service "${serviceName}" with category "${category}"`);
                                            // Try exact match first, then partial match
                                            return serviceName.toLowerCase() === category.toLowerCase() ||
                                                serviceName.toLowerCase().includes(category.toLowerCase()) ||
                                                category.toLowerCase().includes(serviceName.toLowerCase());
                                        });

                                        return (
                                            <SortableItem key={service.id} id={service.id}>
                                                <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900 shadow-sm">
                                                    <div
                                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/40 transition-all group"
                                                        onClick={() => toggleSection(category)}
                                                    >
                                                        <div className="flex items-center space-x-4">
                                                            <div className="p-1 rounded-md bg-gray-800 group-hover:bg-gray-700 transition-colors">
                                                                {isExpanded ? (
                                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                                ) : (
                                                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                                                )}
                                                            </div>
                                                            <span className="text-gray-100 font-medium tracking-tight group-hover:text-white transition-colors cursor-grab active:cursor-grabbing">
                                                                {category}
                                                            </span>
                                                            {currentDeals.length > 0 && (
                                                                <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-600/20">
                                                                    {currentDeals.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="flex items-center px-4 py-1.5 bg-blue-600/10 text-blue-400 rounded-lg hover:bg-blue-600/20 active:scale-95 transition-all text-xs font-bold border border-blue-600/20"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNewDeal(category);
                                                            }}
                                                            onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking button
                                                        >
                                                            <PlusIcon className="w-4 h-4 mr-1.5" /> New
                                                        </button>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="border-t border-gray-800 bg-gray-950/40 animate-fadeIn" onPointerDown={(e) => e.stopPropagation()}>
                                                            {currentDeals.length > 0 ? (
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs">
                                                                        <thead className="bg-gray-900/50 text-gray-500 uppercase tracking-wider">
                                                                            <tr>
                                                                                <th className="px-6 py-3 font-medium">Date</th>
                                                                                <th className="px-6 py-3 font-medium">Brand</th>
                                                                                <th className="px-6 py-3 font-medium text-right">Amount</th>
                                                                                <th className="px-6 py-3 font-medium">Status</th>
                                                                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-800">
                                                                            {currentDeals.map((deal) => (
                                                                                <tr key={deal.id} className="hover:bg-gray-800/40 transition-colors">
                                                                                    <td className="px-6 py-4 text-gray-300">{deal.date}</td>
                                                                                    <td className="px-6 py-4 text-gray-300">{getBrandName(deal.brand)}</td>
                                                                                    <td className="px-6 py-4 text-right text-emerald-400 font-mono font-bold">
                                                                                        {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(deal.serviceAmount)}
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${deal.paymentStatus === 'Paid' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-yellow-900/20 text-yellow-500 border-yellow-900/50'}`}>
                                                                                            {deal.paymentStatus}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right">
                                                                                        <div className="flex justify-end space-x-2">
                                                                                            <button
                                                                                                onClick={() => handleViewDeal(deal)}
                                                                                                className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                                                                title="View Details"
                                                                                            >
                                                                                                <EyeIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleEditDeal(deal)}
                                                                                                className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                                                                                                title="Edit Deal"
                                                                                            >
                                                                                                <PencilIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDeleteDeal(deal.id)}
                                                                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                                                                title="Delete Deal"
                                                                                            >
                                                                                                <TrashIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="px-8 py-10 text-center">
                                                                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                                                                        <PlusIcon className="w-6 h-6 text-gray-500" />
                                                                    </div>
                                                                    <p className="text-gray-500 text-sm font-medium">No {category.toLowerCase()} deals found for this customer.</p>
                                                                    <button
                                                                        className="mt-4 text-xs text-blue-500/80 hover:text-blue-400 transition-colors"
                                                                        onClick={() => handleNewDeal(category)}
                                                                    >
                                                                        Click 'New' to add your first deal
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>
                )}
            </div>
            <DealModal
                isOpen={isDealModalOpen}
                onClose={() => setIsDealModalOpen(false)}
                onSave={handleSaveDeal}
                initialData={prefillData}
                readOnly={isViewMode}
            />
        </div>
    );
};
