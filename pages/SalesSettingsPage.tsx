import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, ChevronDownIcon } from '../components/icons';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FunnelIcon, BriefcaseIcon, ShieldCheckIcon, UserGroupIcon, TagIcon, BanknotesIcon, WrenchScrewdriverIcon, Bars3Icon, Cog6ToothIcon, ListBulletIcon } from '../components/icons';
import { CustomFieldsPage } from './CustomFieldsPage';

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
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
};

const SettingsSection: React.FC<{
    title: string;
    description: string;
    items: { id: string; name: string }[];
    onAdd: (item: string) => void;
    onDelete: (id: string, index: number) => void;
    onEdit: (id: string, newName: string) => void;
    onReorder?: (newItems: { id: string; name: string }[]) => void;
}> = ({ title, description, items, onAdd, onDelete, onEdit, onReorder }) => {
    const [newItem, setNewItem] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => (item.id || item.name) === active.id);
            const newIndex = items.findIndex((item) => (item.id || item.name) === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex);
            if (onReorder) {
                onReorder(newItems);
            }
        }
    };

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
        <div className="bg-gray-900/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-800/50 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-8 pb-6 border-b border-gray-800">
                <h3 className="text-3xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400">{description}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
                <div className="relative flex-1 group">
                    <PlusIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Add a new entry..."
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!newItem.trim()}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add</span>
                </button>
            </form>

            <div className="space-y-3">
                {items.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={items.map(i => i.id || i.name)} strategy={verticalListSortingStrategy}>
                            <div className="grid gap-3">
                                {items.map((item, index) => (
                                    <SortableItem key={item.id || item.name} id={item.id || item.name}>
                                        <div className="flex justify-between items-center bg-gray-800/40 p-4 rounded-xl border border-gray-800 group hover:border-gray-700 hover:bg-gray-800/80 transition-all duration-200">
                                            <div className="flex items-center gap-4 text-gray-500">
                                                <Bars3Icon className="w-5 h-5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" />
                                            </div>

                                            {editingId === item.id ? (
                                                <div className="flex-1 flex gap-2 items-center ml-2">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(item.id);
                                                            if (e.key === 'Escape') handleCancelEdit();
                                                        }}
                                                        className="flex-1 bg-gray-900 border border-blue-500/50 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                                                        onPointerDown={(e) => e.stopPropagation()}
                                                    />
                                                    <button onClick={() => handleSaveEdit(item.id)} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors" title="Save">
                                                        <CheckIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors" title="Cancel">
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-gray-200 font-medium ml-2 flex-1">{item.name}</span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                                                        <button
                                                            onClick={() => handleStartEdit(item)}
                                                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                            title="Edit"
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => onDelete(item.id, index)}
                                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Delete"
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </SortableItem>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                            <PlusIcon className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-400 font-medium">No items yet</p>
                        <p className="text-sm text-gray-600 mt-1">Add your first entry above</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const SalesSettingsPage: React.FC = () => {
    const { salesSettings, updateSalesSettings } = useData();
    const [activeTab, setActiveTab] = useState<'general' | 'customFields'>('general');
    const [activeCategory, setActiveCategory] = useState('leadSources');
    const [customLeadFields, setCustomLeadFields] = useState<CustomField[]>([]);
    const [customDealFields, setCustomDealFields] = useState<CustomField[]>([]);
    const [customCustomerFields, setCustomCustomerFields] = useState<CustomField[]>([]);

    useEffect(() => {
        const loadCustomFields = async () => {
            try {
                const leads = await salesSettingsService.getCustomFields('leads');
                const deals = await salesSettingsService.getCustomFields('deals');
                const customers = await salesSettingsService.getCustomFields('customers');

                // Show all custom fields in the list, not just dropdowns
                setCustomLeadFields(leads);
                setCustomDealFields(deals);
                setCustomCustomerFields(customers);
            } catch (err) {
                console.error("Failed to load custom fields for settings dropdown", err);
            }
        };

        if (activeTab === 'general') {
            loadCustomFields();
        }
    }, [activeTab]);

    const leadCategories = [
        { id: 'leadSources', label: 'Lead Sources', icon: FunnelIcon },
        { id: 'servicesRequired', label: 'Services Required', icon: BriefcaseIcon },
        { id: 'leadQualifications', label: 'Lead Qualifications', icon: ShieldCheckIcon },
        { id: 'leadOwners', label: 'Lead Owners', icon: UserGroupIcon },
        // Append Custom Fields
        ...customLeadFields.map(f => ({ id: f.id, label: f.label, icon: ListBulletIcon }))
    ];

    const dealCategories = [
        { id: 'services', label: 'Services', icon: WrenchScrewdriverIcon },
        { id: 'brands', label: 'Brands', icon: TagIcon },
        { id: 'serviceClosedOptions', label: 'Service Closed Status', icon: CheckIcon },
        { id: 'paymentStatusOptions', label: 'Payment Status', icon: BanknotesIcon },
        // Append Custom Fields
        ...customDealFields.map(f => ({ id: f.id, label: f.label, icon: ListBulletIcon }))
    ];

    const customerCategories = [
        // Append Custom Fields
        ...customCustomerFields.map(f => ({ id: f.id, label: f.label, icon: ListBulletIcon }))
    ];

    // ... (Handlers)
    const handleAddSource = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadSource(name);
            updateSalesSettings({ ...salesSettings, leadSources: [...salesSettings.leadSources, newItem] });
        } catch (error) { console.error("Failed to add lead source", error); }
    };
    const handleDeleteSource = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadSource(id);
            updateSalesSettings({ ...salesSettings, leadSources: salesSettings.leadSources.filter(s => s.id !== id) });
        } catch (error) { console.error("Failed to delete lead source", error); }
    };
    const handleUpdateSource = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadSource(id, name);
            updateSalesSettings({ ...salesSettings, leadSources: salesSettings.leadSources.map(s => s.id === id ? updated : s) });
        } catch (error) { console.error("Failed to update lead source", error); }
    };
    const handleReorderLeadSources = (newItems: { id: string; name: string }[]) => {
        updateSalesSettings({ ...salesSettings, leadSources: newItems as any[] });
    };

    const handleAddService = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addServiceRequired(name);
            updateSalesSettings({ ...salesSettings, servicesRequired: [...salesSettings.servicesRequired, newItem] });
        } catch (error) { console.error("Failed to add service", error); }
    };
    const handleDeleteService = async (id: string) => {
        try {
            await salesSettingsService.deleteServiceRequired(id);
            updateSalesSettings({ ...salesSettings, servicesRequired: salesSettings.servicesRequired.filter(s => s.id !== id) });
        } catch (error) { console.error("Failed to delete service", error); }
    };
    const handleUpdateService = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateServiceRequired(id, name);
            updateSalesSettings({ ...salesSettings, servicesRequired: salesSettings.servicesRequired.map(s => s.id === id ? updated : s) });
        } catch (error) { console.error("Failed to update service", error); }
    };
    const handleReorderServicesRequired = (newItems: { id: string; name: string }[]) => {
        updateSalesSettings({ ...salesSettings, servicesRequired: newItems as any[] });
    };

    const handleAddQualification = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadQualification(name);
            updateSalesSettings({ ...salesSettings, leadQualifications: [...salesSettings.leadQualifications, newItem] });
        } catch (error) { console.error("Failed to add qualification", error); }
    };
    const handleDeleteQualification = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadQualification(id);
            updateSalesSettings({ ...salesSettings, leadQualifications: salesSettings.leadQualifications.filter(q => q.id !== id) });
        } catch (error) { console.error("Failed to delete qualification", error); }
    };
    const handleUpdateQualification = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadQualification(id, name);
            updateSalesSettings({ ...salesSettings, leadQualifications: salesSettings.leadQualifications.map(q => q.id === id ? updated : q) });
        } catch (error) { console.error("Failed to update qualification", error); }
    };
    const handleReorderQualifications = (newItems: { id: string; name: string }[]) => {
        updateSalesSettings({ ...salesSettings, leadQualifications: newItems as any[] });
    };
    const handleAddServiceSimple = (item: string) => {
        updateSalesSettings({ ...salesSettings, services: [...salesSettings.services, item] });
    };
    const handleReorderServices = (newItems: { id: string; name: string }[]) => {
        const newServices = newItems.map(i => i.name);
        updateSalesSettings({ ...salesSettings, services: newServices });
        salesSettingsService.saveExtraSettings({ ...salesSettingsService.getExtraSettings(), services: newServices });
    };
    const handleDeleteServiceSimple = (_id: string, index: number) => {
        const newList = [...salesSettings.services];
        newList.splice(index, 1);
        updateSalesSettings({ ...salesSettings, services: newList });
    };
    const handleUpdateServiceSimple = (id: string, name: string) => {
        updateSalesSettings({ ...salesSettings, services: salesSettings.services.map(s => s === id ? name : s) });
    };
    const handleAddBrand = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addBrand(name);
            updateSalesSettings({ ...salesSettings, brands: [...salesSettings.brands, newItem] });
        } catch (error) { console.error("Failed to add brand", error); }
    };
    const handleDeleteBrand = async (id: string) => {
        try {
            await salesSettingsService.deleteBrand(id);
            updateSalesSettings({ ...salesSettings, brands: salesSettings.brands.filter(b => b.id !== id) });
        } catch (error) { console.error("Failed to delete brand", error); }
    };
    const handleUpdateBrand = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateBrand(id, name);
            updateSalesSettings({ ...salesSettings, brands: salesSettings.brands.map(b => b.id === id ? updated : b) });
        } catch (error) { console.error("Failed to update brand", error); }
    };
    const handleReorderBrands = (newItems: { id: string; name: string }[]) => {
        updateSalesSettings({ ...salesSettings, brands: newItems as any[] });
    };
    const handleAddLeadOwner = async (name: string) => {
        try {
            const newItem = await salesSettingsService.addLeadOwner(name);
            updateSalesSettings({ ...salesSettings, leadOwners: [...salesSettings.leadOwners, newItem] });
        } catch (error) { console.error("Failed to add lead owner", error); }
    };
    const handleDeleteLeadOwner = async (id: string) => {
        try {
            await salesSettingsService.deleteLeadOwner(id);
            updateSalesSettings({ ...salesSettings, leadOwners: salesSettings.leadOwners.filter(o => o.id !== id) });
        } catch (error) { console.error("Failed to delete lead owner", error); }
    };
    const handleUpdateLeadOwner = async (id: string, name: string) => {
        try {
            const updated = await salesSettingsService.updateLeadOwner(id, name);
            updateSalesSettings({ ...salesSettings, leadOwners: salesSettings.leadOwners.map(o => o.id === id ? updated : o) });
        } catch (error) { console.error("Failed to update lead owner", error); }
    };
    const handleReorderLeadOwners = (newItems: { id: string; name: string }[]) => {
        updateSalesSettings({ ...salesSettings, leadOwners: newItems as any[] });
    };
    const handleAddServiceClosed = (item: string) => {
        updateSalesSettings({ ...salesSettings, serviceClosedOptions: [...salesSettings.serviceClosedOptions, item] });
    };
    const handleReorderServiceClosed = (newItems: { id: string; name: string }[]) => {
        const newOptions = newItems.map(i => i.name);
        updateSalesSettings({ ...salesSettings, serviceClosedOptions: newOptions });
        salesSettingsService.saveExtraSettings({ ...salesSettingsService.getExtraSettings(), serviceClosedOptions: newOptions });
    };
    const handleDeleteServiceClosed = (_id: string, index: number) => {
        const newList = [...salesSettings.serviceClosedOptions];
        newList.splice(index, 1);
        updateSalesSettings({ ...salesSettings, serviceClosedOptions: newList });
    };
    const handleUpdateServiceClosed = (id: string, name: string) => {
        updateSalesSettings({ ...salesSettings, serviceClosedOptions: salesSettings.serviceClosedOptions.map(s => s === id ? name : s) });
    };
    const handleAddPaymentStatus = (item: string) => {
        updateSalesSettings({ ...salesSettings, paymentStatusOptions: [...salesSettings.paymentStatusOptions, item] });
    };
    const handleReorderPaymentStatus = (newItems: { id: string; name: string }[]) => {
        const newOptions = newItems.map(i => i.name);
        updateSalesSettings({ ...salesSettings, paymentStatusOptions: newOptions });
        salesSettingsService.saveExtraSettings({ ...salesSettingsService.getExtraSettings(), paymentStatusOptions: newOptions });
    };
    const handleDeletePaymentStatus = (_id: string, index: number) => {
        const newList = [...salesSettings.paymentStatusOptions];
        newList.splice(index, 1);
        updateSalesSettings({ ...salesSettings, paymentStatusOptions: newList });
    };
    const handleUpdatePaymentStatus = (id: string, name: string) => {
        updateSalesSettings({ ...salesSettings, paymentStatusOptions: salesSettings.paymentStatusOptions.map(p => p === id ? name : p) });
    };

    // --- Handlers for Custom Field Options ---
    const getActiveCustomField = (id: string) => {
        return [...customLeadFields, ...customDealFields, ...customCustomerFields].find(f => f.id === id);
    };

    const updateCustomFieldState = (updatedField: CustomField) => {
        if (updatedField.module === 'leads') {
            setCustomLeadFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f));
        } else if (updatedField.module === 'deals') {
            setCustomDealFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f));
        } else {
            setCustomCustomerFields(prev => prev.map(f => f.id === updatedField.id ? updatedField : f));
        }
    };

    const handleAddCustomOption = async (optionName: string) => {
        const field = getActiveCustomField(activeCategory);
        if (!field) return;

        const currentOptions = field.options || [];
        const newOptions = [...currentOptions, optionName];

        try {
            const updated = await salesSettingsService.updateCustomField(field.id, { options: newOptions });
            updateCustomFieldState(updated);
        } catch (e) {
            console.error("Failed to add custom option", e);
        }
    };

    const handleDeleteCustomOption = async (_id: string, index: number) => {
        const field = getActiveCustomField(activeCategory);
        if (!field) return;

        const currentOptions = [...(field.options || [])];
        currentOptions.splice(index, 1);

        try {
            const updated = await salesSettingsService.updateCustomField(field.id, { options: currentOptions });
            updateCustomFieldState(updated);
        } catch (e) {
            console.error("Failed to delete custom option", e);
        }
    };

    const handleUpdateCustomOption = async (_id: string, newName: string) => {
        const field = getActiveCustomField(activeCategory);
        if (!field) return;

        // Matches oldName which acts as ID here for string arrays
        const oldName = _id;
        const currentOptions = field.options || [];
        const newOptions = currentOptions.map(opt => opt === oldName ? newName : opt);

        try {
            const updated = await salesSettingsService.updateCustomField(field.id, { options: newOptions });
            updateCustomFieldState(updated);
        } catch (e) {
            console.error("Failed to update custom option", e);
        }
    };

    const handleReorderCustomOptions = async (newItems: { id: string; name: string }[]) => {
        const field = getActiveCustomField(activeCategory);
        if (!field) return;

        const newOptions = newItems.map(i => i.name);
        try {
            const updated = await salesSettingsService.updateCustomField(field.id, { options: newOptions });
            updateCustomFieldState(updated);
        } catch (e) {
            console.error("Failed to reorder custom options", e);
        }
    };

    const renderActiveCategory = () => {
        // Check if active category is a custom field
        const customField = getActiveCustomField(activeCategory);
        if (customField) {
            // Dropdown and Radio have options to manage
            if (customField.type === 'dropdown' || customField.type === 'radio') {
                return (
                    <SettingsSection
                        title={customField.label}
                        description={`Manage options for the ${customField.label} ${customField.type === 'radio' ? 'radio buttons' : 'dropdown'}.`}
                        items={(customField.options || []).map(opt => ({ id: opt, name: opt }))}
                        onAdd={handleAddCustomOption}
                        onDelete={handleDeleteCustomOption}
                        onEdit={handleUpdateCustomOption}
                        onReorder={handleReorderCustomOptions}
                    />
                );
            }

            // Other types (Text, Date, Number, etc.) do not have options to manage here
            return (
                <div className="bg-gray-900/50 backdrop-blur-xl p-12 rounded-3xl border border-gray-800/50 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <WrenchScrewdriverIcon className="w-10 h-10 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">{customField.label}</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                        This is a <strong>{customField.type}</strong> field. It doesn't have a list of options to configure.
                        You can manage its properties (label, placeholder, etc.) in the <strong>Custom Fields</strong> tab.
                    </p>
                    <button
                        onClick={() => setActiveTab('customFields')}
                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                    >
                        Go to Custom Fields Config
                    </button>
                </div>
            );
        }

        switch (activeCategory) {
            case 'leadSources': return <SettingsSection title="Lead Sources" description="Manage the list of lead sources available in dropdowns." items={salesSettings.leadSources} onAdd={handleAddSource} onDelete={handleDeleteSource} onEdit={handleUpdateSource} onReorder={handleReorderLeadSources} />;
            case 'servicesRequired': return <SettingsSection title="Services Required" description="Manage the services that leads can request." items={salesSettings.servicesRequired} onAdd={handleAddService} onDelete={handleDeleteService} onEdit={handleUpdateService} onReorder={handleReorderServicesRequired} />;
            case 'leadQualifications': return <SettingsSection title="Lead Qualifications" description="Manage lead qualification statuses." items={salesSettings.leadQualifications} onAdd={handleAddQualification} onDelete={handleDeleteQualification} onEdit={handleUpdateQualification} onReorder={handleReorderQualifications} />;
            case 'leadOwners': return <SettingsSection title="Lead Owners" description="Manage a list of lead owners." items={salesSettings.leadOwners} onAdd={handleAddLeadOwner} onDelete={handleDeleteLeadOwner} onEdit={handleUpdateLeadOwner} onReorder={handleReorderLeadOwners} />;
            case 'services': return <SettingsSection title="Services" description="Manage services available for deals." items={salesSettings.services.map(s => ({ id: s, name: s }))} onAdd={handleAddServiceSimple} onDelete={handleDeleteServiceSimple} onEdit={handleUpdateServiceSimple} onReorder={handleReorderServices} />;
            case 'brands': return <SettingsSection title="Brands" description="Manage brands available for leads." items={salesSettings.brands} onAdd={handleAddBrand} onDelete={handleDeleteBrand} onEdit={handleUpdateBrand} onReorder={handleReorderBrands} />;
            case 'serviceClosedOptions': return <SettingsSection title="Service Closed Status" description="Manage service closed options (e.g., Yes, No)." items={salesSettings.serviceClosedOptions.map(s => ({ id: s, name: s }))} onAdd={handleAddServiceClosed} onDelete={handleDeleteServiceClosed} onEdit={handleUpdateServiceClosed} onReorder={handleReorderServiceClosed} />;
            case 'paymentStatusOptions': return <SettingsSection title="Payment Status" description="Manage payment status options." items={salesSettings.paymentStatusOptions.map(p => ({ id: p, name: p }))} onAdd={handleAddPaymentStatus} onDelete={handleDeletePaymentStatus} onEdit={handleUpdatePaymentStatus} onReorder={handleReorderPaymentStatus} />;
            default: return null;
        }
    };

    const allCategories = [...leadCategories, ...dealCategories, ...customerCategories];
    const currentCategory = allCategories.find(c => c.id === activeCategory);

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Settings
                </h1>
                <p className="text-gray-500 text-lg">Configure and customize your Lead and Deal attributes</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
                <div className="bg-gray-900/50 p-1 rounded-xl inline-flex border border-gray-800">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'general'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        <Cog6ToothIcon className="w-5 h-5 mr-2" />
                        Sales Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('customFields')}
                        className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'customFields'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        <ListBulletIcon className="w-5 h-5 mr-2" />
                        Custom Fields
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'general' ? (
                    <>
                        {/* Category Selection Dropdown */}
                        <div className="max-w-md mx-auto">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block px-1">
                                Configuration Category
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 group-hover:scale-110 transition-transform duration-300">
                                    {currentCategory?.icon ? <currentCategory.icon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                                </div>
                                <select
                                    value={activeCategory}
                                    onChange={(e) => setActiveCategory(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-800 rounded-2xl py-4 pl-12 pr-10 text-white font-semibold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none appearance-none cursor-pointer hover:bg-gray-800/50 hover:border-gray-700 transition-all shadow-xl"
                                >
                                    <optgroup label="Lead Configuration" className="bg-gray-900 text-gray-400">
                                        {leadCategories.map(cat => (
                                            <option key={cat.id} value={cat.id} className="text-white py-2">
                                                {cat.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Deal Management" className="bg-gray-900 text-gray-400">
                                        {dealCategories.map(cat => (
                                            <option key={cat.id} value={cat.id} className="text-white py-2">
                                                {cat.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                    {customerCategories.length > 0 && (
                                        <optgroup label="Customer Management" className="bg-gray-900 text-gray-400">
                                            {customerCategories.map(cat => (
                                                <option key={cat.id} value={cat.id} className="text-white py-2">
                                                    {cat.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDownIcon className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div>
                            {renderActiveCategory()}
                        </div>
                    </>
                ) : (
                    <CustomFieldsPage />
                )}
            </div>
        </div>
    );
};
