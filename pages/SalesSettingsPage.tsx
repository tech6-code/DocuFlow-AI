import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '../components/icons';
import { salesSettingsService } from '../services/salesSettingsService';

const SettingsSection: React.FC<{
    title: string;
    description: string;
    items: { id: string; name: string }[];
    onAdd: (item: string) => void;
    onDelete: (id: string, index: number) => void;
    onEdit: (id: string, newName: string) => void;
}> = ({ title, description, items, onAdd, onDelete, onEdit }) => {
    const [newItem, setNewItem] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItem.trim()) {
            onAdd(newItem.trim());
            setNewItem('');
        }
    };

    const handleStartEdit = (item: { id: string, name: string }) => {
        setEditingId(item.id);
        setEditValue(item.name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const handleSaveEdit = (id: string) => {
        if (editValue.trim()) {
            onEdit(id, editValue.trim());
            setEditingId(null);
            setEditValue('');
        }
    };

    return (
        <div className="bg-gray-800/40 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400">{description}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
                <div className="relative flex-1">
                    <PlusIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Add a new entry..."
                        className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-600"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!newItem.trim()}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                >
                    Add Item
                </button>
            </form>

            <div className="space-y-3">
                {items.length > 0 ? (
                    items.map((item, index) => (
                        <div key={item.id || index} className="flex justify-between items-center bg-gray-900/30 p-4 rounded-xl border border-gray-800/30 group hover:border-gray-700/50 hover:bg-gray-800/20 transition-all duration-300">
                            {editingId === item.id ? (
                                <div className="flex-1 flex gap-2 items-center">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveEdit(item.id);
                                            if (e.key === 'Escape') handleCancelEdit();
                                        }}
                                        className="flex-1 bg-gray-800 border border-blue-500/50 rounded-lg px-3 py-1 text-white outline-none"
                                    />
                                    <button onClick={() => handleSaveEdit(item.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg" title="Save">
                                        <CheckIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleCancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-400/10 rounded-lg" title="Cancel">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-gray-200 font-medium">{item.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                        <button
                                            onClick={() => handleStartEdit(item)}
                                            className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg"
                                            title="Edit Item"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(item.id, index)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg"
                                            title="Delete Item"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800/50">
                        <PlusIcon className="w-10 h-10 text-gray-700 mx-auto mb-3 opacity-20" />
                        <p className="text-gray-500 font-medium italic">No items have been added to this category yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

import { FunnelIcon, BriefcaseIcon, ShieldCheckIcon, UserGroupIcon, TagIcon, BanknotesIcon, MagnifyingGlassIcon, WrenchScrewdriverIcon } from '../components/icons';

export const SalesSettingsPage: React.FC = () => {
    const { salesSettings, updateSalesSettings } = useData();
    const [activeCategory, setActiveCategory] = useState('leadSources');

    const leadCategories = [
        { id: 'leadSources', label: 'Lead Sources', icon: FunnelIcon },
        { id: 'servicesRequired', label: 'Services Required', icon: BriefcaseIcon },
        { id: 'leadQualifications', label: 'Lead Qualifications', icon: ShieldCheckIcon },
        { id: 'leadOwners', label: 'Lead Owners', icon: UserGroupIcon },
    ];

    const dealCategories = [
        { id: 'services', label: 'Services', icon: WrenchScrewdriverIcon },
        { id: 'brands', label: 'Brands', icon: TagIcon },
        { id: 'serviceClosedOptions', label: 'Service Closed Status', icon: CheckIcon },
        { id: 'paymentStatusOptions', label: 'Payment Status', icon: BanknotesIcon },
    ];

    const handleAddSource = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadSource(name);
            updateSalesSettings({
                ...salesSettings,
                leadSources: [...salesSettings.leadSources, newItem]
            });
        } catch (error) {
            console.error("Failed to add lead source", error);
        }
    };

    const handleDeleteSource = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadSource(id);
            updateSalesSettings({
                ...salesSettings,
                leadSources: salesSettings.leadSources.filter(s => s.id !== id)
            });
        } catch (error) {
            console.error("Failed to delete lead source", error);
        }
    };

    const handleUpdateSource = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadSource(id, name);
            updateSalesSettings({
                ...salesSettings,
                leadSources: salesSettings.leadSources.map(s => s.id === id ? updated : s)
            });
        } catch (error) {
            console.error("Failed to update lead source", error);
        }
    };

    const handleAddService = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addServiceRequired(name);
            updateSalesSettings({
                ...salesSettings,
                servicesRequired: [...salesSettings.servicesRequired, newItem]
            });
        } catch (error) {
            console.error("Failed to add service", error);
        }
    };

    const handleDeleteService = async (id: string) => {
        try {
            await salesSettingsService.deleteServiceRequired(id);
            updateSalesSettings({
                ...salesSettings,
                servicesRequired: salesSettings.servicesRequired.filter(s => s.id !== id)
            });
        } catch (error) {
            console.error("Failed to delete service", error);
        }
    };

    const handleUpdateService = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateServiceRequired(id, name);
            updateSalesSettings({
                ...salesSettings,
                servicesRequired: salesSettings.servicesRequired.map(s => s.id === id ? updated : s)
            });
        } catch (error) {
            console.error("Failed to update service", error);
        }
    };

    const handleAddQualification = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadQualification(name);
            updateSalesSettings({
                ...salesSettings,
                leadQualifications: [...salesSettings.leadQualifications, newItem]
            });
        } catch (error) {
            console.error("Failed to add qualification", error);
        }
    };

    const handleDeleteQualification = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadQualification(id);
            updateSalesSettings({
                ...salesSettings,
                leadQualifications: salesSettings.leadQualifications.filter(q => q.id !== id)
            });
        } catch (error) {
            console.error("Failed to delete qualification", error);
        }
    };

    const handleUpdateQualification = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadQualification(id, name);
            updateSalesSettings({
                ...salesSettings,
                leadQualifications: salesSettings.leadQualifications.map(q => q.id === id ? updated : q)
            });
        } catch (error) {
            console.error("Failed to update qualification", error);
        }
    };

    const handleAddServiceSimple = (item: string) => {
        updateSalesSettings({
            ...salesSettings,
            services: [...salesSettings.services, item]
        });
    };

    const handleDeleteServiceSimple = (_id: string, index: number) => {
        const newList = [...salesSettings.services];
        newList.splice(index, 1);
        updateSalesSettings({
            ...salesSettings,
            services: newList
        });
    };

    const handleUpdateServiceSimple = (id: string, name: string) => {
        updateSalesSettings({
            ...salesSettings,
            services: salesSettings.services.map(s => s === id ? name : s)
        });
    };

    const handleAddBrand = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addBrand(name);
            updateSalesSettings({
                ...salesSettings,
                brands: [...salesSettings.brands, newItem]
            });
        } catch (error) {
            console.error("Failed to add brand", error);
        }
    };

    const handleDeleteBrand = async (id: string) => {
        try {
            await salesSettingsService.deleteBrand(id);
            updateSalesSettings({
                ...salesSettings,
                brands: salesSettings.brands.filter(b => b.id !== id)
            });
        } catch (error) {
            console.error("Failed to delete brand", error);
        }
    };

    const handleUpdateBrand = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateBrand(id, name);
            updateSalesSettings({
                ...salesSettings,
                brands: salesSettings.brands.map(b => b.id === id ? updated : b)
            });
        } catch (error) {
            console.error("Failed to update brand", error);
        }
    };

    const handleAddLeadOwner = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadOwner(name);
            updateSalesSettings({
                ...salesSettings,
                leadOwners: [...salesSettings.leadOwners, newItem]
            });
        } catch (error) {
            console.error("Failed to add lead owner", error);
        }
    };

    const handleDeleteLeadOwner = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadOwner(id);
            updateSalesSettings({
                ...salesSettings,
                leadOwners: salesSettings.leadOwners.filter(o => o.id !== id)
            });
        } catch (error) {
            console.error("Failed to delete lead owner", error);
        }
    };

    const handleUpdateLeadOwner = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadOwner(id, name);
            updateSalesSettings({
                ...salesSettings,
                leadOwners: salesSettings.leadOwners.map(o => o.id === id ? updated : o)
            });
        } catch (error) {
            console.error("Failed to update lead owner", error);
        }
    };

    const handleAddServiceClosed = (item: string) => {
        updateSalesSettings({
            ...salesSettings,
            serviceClosedOptions: [...salesSettings.serviceClosedOptions, item]
        });
    };

    const handleDeleteServiceClosed = (_id: string, index: number) => {
        const newList = [...salesSettings.serviceClosedOptions];
        newList.splice(index, 1);
        updateSalesSettings({
            ...salesSettings,
            serviceClosedOptions: newList
        });
    };

    const handleUpdateServiceClosed = (id: string, name: string) => {
        updateSalesSettings({
            ...salesSettings,
            serviceClosedOptions: salesSettings.serviceClosedOptions.map(s => s === id ? name : s)
        });
    };

    const handleAddPaymentStatus = (item: string) => {
        updateSalesSettings({
            ...salesSettings,
            paymentStatusOptions: [...salesSettings.paymentStatusOptions, item]
        });
    };

    const handleDeletePaymentStatus = (_id: string, index: number) => {
        const newList = [...salesSettings.paymentStatusOptions];
        newList.splice(index, 1);
        updateSalesSettings({
            ...salesSettings,
            paymentStatusOptions: newList
        });
    };

    const handleUpdatePaymentStatus = (id: string, name: string) => {
        updateSalesSettings({
            ...salesSettings,
            paymentStatusOptions: salesSettings.paymentStatusOptions.map(p => p === id ? name : p)
        });
    };

    const renderActiveCategory = () => {
        switch (activeCategory) {
            case 'leadSources':
                return (
                    <SettingsSection
                        title="Lead Sources"
                        description="Manage the list of lead sources available in dropdowns."
                        items={salesSettings.leadSources}
                        onAdd={handleAddSource}
                        onDelete={handleDeleteSource}
                        onEdit={handleUpdateSource}
                    />
                );
            case 'servicesRequired':
                return (
                    <SettingsSection
                        title="Services Required"
                        description="Manage the services that leads can request."
                        items={salesSettings.servicesRequired}
                        onAdd={handleAddService}
                        onDelete={handleDeleteService}
                        onEdit={handleUpdateService}
                    />
                );
            case 'leadQualifications':
                return (
                    <SettingsSection
                        title="Lead Qualifications"
                        description="Manage lead qualification statuses."
                        items={salesSettings.leadQualifications}
                        onAdd={handleAddQualification}
                        onDelete={handleDeleteQualification}
                        onEdit={handleUpdateQualification}
                    />
                );
            case 'leadOwners':
                return (
                    <SettingsSection
                        title="Lead Owners"
                        description="Manage a list of lead owners."
                        items={salesSettings.leadOwners}
                        onAdd={handleAddLeadOwner}
                        onDelete={handleDeleteLeadOwner}
                        onEdit={handleUpdateLeadOwner}
                    />
                );
            case 'services':
                return (
                    <SettingsSection
                        title="Services"
                        description="Manage services available for deals."
                        items={salesSettings.services.map(s => ({ id: s, name: s }))}
                        onAdd={handleAddServiceSimple}
                        onDelete={handleDeleteServiceSimple}
                        onEdit={handleUpdateServiceSimple}
                    />
                );
            case 'brands':
                return (
                    <SettingsSection
                        title="Brands"
                        description="Manage brands available for leads."
                        items={salesSettings.brands}
                        onAdd={handleAddBrand}
                        onDelete={handleDeleteBrand}
                        onEdit={handleUpdateBrand}
                    />
                );
            case 'serviceClosedOptions':
                return (
                    <SettingsSection
                        title="Service Closed Status"
                        description="Manage service closed options (e.g., Yes, No)."
                        items={salesSettings.serviceClosedOptions.map(s => ({ id: s, name: s }))}
                        onAdd={handleAddServiceClosed}
                        onDelete={handleDeleteServiceClosed}
                        onEdit={handleUpdateServiceClosed}
                    />
                );
            case 'paymentStatusOptions':
                return (
                    <SettingsSection
                        title="Payment Status"
                        description="Manage payment status options."
                        items={salesSettings.paymentStatusOptions.map(p => ({ id: p, name: p }))}
                        onAdd={handleAddPaymentStatus}
                        onDelete={handleDeletePaymentStatus}
                        onEdit={handleUpdatePaymentStatus}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Sales Settings</h1>
            <p className="text-gray-500 mb-10">Configure and customize your Lead and Deal attributes</p>

            <div className="flex gap-10">
                {/* Sidebar Navigation */}
                <div className="w-72 flex-shrink-0 space-y-10">
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-4">Lead Configuration</h4>
                        <div className="space-y-1">
                            {leadCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${activeCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                        }`}
                                >
                                    <cat.icon className={`w-4 h-4 ${activeCategory === cat.id ? 'text-white' : 'text-gray-600'}`} />
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-4">Deal Management</h4>
                        <div className="space-y-1">
                            {dealCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${activeCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                        }`}
                                >
                                    {/* Handle WrenchScrewdriverIcon vs fallback */}
                                    {cat.icon ? <cat.icon className={`w-4 h-4 ${activeCategory === cat.id ? 'text-white' : 'text-gray-600'}`} /> : <CheckIcon className="w-4 h-4" />}
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 max-w-3xl">
                    {renderActiveCategory()}
                </div>
            </div>
        </div>
    );
};
