import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
    PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon,
    ListBulletIcon, CalendarDaysIcon, DocumentTextIcon,
    ChatBubbleBottomCenterTextIcon, HashtagIcon, ChevronDownIcon,
    StopCircleIcon, FunnelIcon, BriefcaseIcon, UserGroupIcon
} from '../components/icons';
import { salesSettingsService, CustomField, FieldType } from '../services/salesSettingsService';

const FIELD_TYPES: { type: FieldType; label: string; icon: any }[] = [
    { type: 'text', label: 'Input Text', icon: DocumentTextIcon },
    { type: 'textarea', label: 'Text Area', icon: ChatBubbleBottomCenterTextIcon },
    { type: 'number', label: 'Number', icon: HashtagIcon },
    { type: 'date', label: 'Date', icon: CalendarDaysIcon },
    { type: 'dropdown', label: 'Dropdown', icon: ChevronDownIcon },
    { type: 'radio', label: 'Radio Button', icon: StopCircleIcon },
    { type: 'checkbox', label: 'Checkbox', icon: CheckIcon },
];

type ModuleType = 'leads' | 'deals' | 'customers';

const MODULES: { id: ModuleType; label: string; icon: any }[] = [
    { id: 'leads', label: 'Leads', icon: FunnelIcon },
    { id: 'deals', label: 'Deals', icon: BriefcaseIcon },
    { id: 'customers', label: 'Customers', icon: UserGroupIcon },
];

export const CustomFieldsPage: React.FC = () => {
    const [activeModule, setActiveModule] = useState<ModuleType>('leads');
    const [fields, setFields] = useState<CustomField[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    // Initial State for new field
    const emptyField: CustomField = {
        id: '',
        type: 'text',
        label: '',
        placeholder: '',
        required: false,
        options: [],
        module: 'leads' // Default, will be overwritten by activeModule on save
    };

    const [formData, setFormData] = useState<CustomField>(emptyField);
    const [optionsString, setOptionsString] = useState(''); // Helper for comma-separated options
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadFields();
    }, [activeModule]);

    const loadFields = async () => {
        setLoading(true);
        try {
            const data = await salesSettingsService.getCustomFields(activeModule);
            setFields(data);
        } catch (error) {
            console.error('Error loading fields:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.label) {
            alert('Label is required');
            return;
        }

        setLoading(true);
        try {
            const fieldData = {
                type: formData.type,
                label: formData.label,
                placeholder: formData.placeholder,
                required: formData.required,
                options: ['dropdown', 'radio', 'checkbox'].includes(formData.type)
                    ? optionsString.split(',').map(s => s.trim()).filter(Boolean)
                    : undefined,
                module: activeModule,
                sort_order: fields.length // Simple append for now
            };

            if (editingField) {
                const updated = await salesSettingsService.updateCustomField(editingField.id, fieldData);
                setFields(fields.map(f => f.id === editingField.id ? updated : f));
            } else {
                const saved = await salesSettingsService.addCustomField(fieldData);
                setFields([...fields, saved]);
            }
            handleCancel();
        } catch (error) {
            console.error('Error saving field:', error);
            alert('Failed to save field');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (field: CustomField) => {
        setEditingField(field);
        setFormData(field);
        setOptionsString(field.options?.join(', ') || '');
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this field?')) {
            setLoading(true);
            try {
                await salesSettingsService.deleteCustomField(id);
                setFields(fields.filter(f => f.id !== id));
            } catch (error) {
                console.error('Error deleting field:', error);
                alert('Failed to delete field');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingField(null);
        setFormData(emptyField);
        setOptionsString('');
    };

    const PreviewField = ({ field }: { field: CustomField }) => {
        const options = ['dropdown', 'radio'].includes(field.type)
            ? (optionsString ? optionsString.split(',').map(s => s.trim()).filter(Boolean) : field.options || [])
            : [];

        // Use live data for preview if editing directly
        const displayLabel = field.label || 'Field Label';
        const displayPlaceholder = field.placeholder || 'Placeholder text...';

        return (
            <div className="space-y-2 pointer-events-none opacity-90">
                <label className="block text-sm font-medium text-muted-foreground">
                    {displayLabel} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.type === 'text' && (
                    <input type="text" className="w-full bg-muted border border-border rounded-lg py-2 px-3 text-foreground" placeholder={displayPlaceholder} />
                )}
                {field.type === 'number' && (
                    <input type="number" className="w-full bg-muted border border-border rounded-lg py-2 px-3 text-foreground" placeholder={displayPlaceholder} />
                )}
                {field.type === 'date' && (
                    <input type="date" className="w-full bg-muted border border-border rounded-lg py-2 px-3 text-foreground" />
                )}
                {field.type === 'textarea' && (
                    <textarea className="w-full bg-muted border border-border rounded-lg py-2 px-3 text-foreground" rows={3} placeholder={displayPlaceholder} />
                )}
                {field.type === 'dropdown' && (
                    <select className="w-full bg-muted border border-border rounded-lg py-2 px-3 text-foreground">
                        <option value="">Select option</option>
                        {options.map((opt, i) => <option key={i}>{opt}</option>)}
                    </select>
                )}
                {field.type === 'radio' && (
                    <div className="flex gap-4">
                        {options.length > 0 ? options.map((opt, i) => (
                            <label key={i} className="flex items-center gap-2">
                                <input type="radio" name="preview-radio" className="text-primary" />
                                <span className="text-sm text-foreground/80">{opt}</span>
                            </label>
                        )) : <span className="text-xs text-muted-foreground italic">No options defined</span>}
                    </div>
                )}
                {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-border bg-muted text-primary" />
                        <span className="text-sm text-foreground/80 cursor-pointer">{displayLabel}</span>
                    </label>
                )}
            </div>
        );
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Custom Fields</h1>
                    <p className="text-muted-foreground text-sm">Design custom input fields for Leads, Deals, and Customers.</p>
                </div>
            </div>

            {/* Module Selector Tabs */}
            <div className="flex space-x-1 bg-card/50 p-1 rounded-xl mb-8 border border-border w-fit">
                {MODULES.map((mod) => (
                    <button
                        key={mod.id}
                        onClick={() => {
                            setActiveModule(mod.id);
                            setIsEditing(false); // Reset editing state when switching modules
                        }}
                        className={`
                            flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                            ${activeModule === mod.id
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }
                        `}
                    >
                        <mod.icon className={`w-4 h-4 mr-2 ${activeModule === mod.id ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        {mod.label}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-foreground flex items-center">
                    <span className="bg-primary/90/10 text-primary text-xs px-2 py-1 rounded border border-primary/20 mr-3 uppercase tracking-wider">
                        {MODULES.find(m => m.id === activeModule)?.label} Module
                    </span>
                    <span>Fields Configuration</span>
                </h2>

                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center font-medium shadow-lg"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Create Field
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List of Fields */}
                {(!isEditing || fields.length > 0) && (
                    <div className={`lg:col-span-${isEditing ? '1' : '3'} space-y-4`}>
                        {!isEditing && fields.length === 0 && (
                            <div className="text-center py-20 bg-card/30 rounded-2xl border border-dashed border-border">
                                <ListBulletIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-muted-foreground">No custom fields created for {activeModule} yet.</p>
                            </div>
                        )}

                        {fields.map(field => (
                            <div
                                key={field.id}
                                className={`p-4 bg-card/50 border rounded-xl flex items-center justify-between group transition-all duration-200 ${editingField?.id === field.id ? 'border-primary/50 bg-primary/90/5' : 'border-border hover:border-border'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                                        {React.createElement(FIELD_TYPES.find(t => t.type === field.type)?.icon || DocumentTextIcon, { className: "w-5 h-5" })}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-foreground font-medium truncate">{field.label}</h3>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{FIELD_TYPES.find(t => t.type === field.type)?.label}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(field)}
                                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/90/10 rounded-lg"
                                        title="Edit"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(field.id)}
                                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Editor & Preview */}
                {isEditing && (
                    <div className={`${fields.length === 0 ? 'lg:col-span-3' : 'lg:col-span-2'} grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn`}>
                        {/* Configuration Form */}
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-xl space-y-6">
                            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center">
                                <PencilIcon className="w-5 h-5 mr-2 text-primary" />
                                {editingField ? 'Edit Field' : 'New Field Configuration'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Field Type</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            {React.createElement(FIELD_TYPES.find(t => t.type === formData.type)?.icon || DocumentTextIcon, { className: "w-5 h-5" })}
                                        </div>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value as FieldType })}
                                            className="w-full bg-muted border border-border rounded-xl py-3 pl-12 pr-10 text-foreground focus:ring-2 focus:ring-primary/50 outline-none appearance-none cursor-pointer hover:border-border transition-colors"
                                        >
                                            {FIELD_TYPES.map(ft => (
                                                <option key={ft.type} value={ft.type}>{ft.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Field Label</label>
                                    <input
                                        type="text"
                                        value={formData.label}
                                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="e.g., Referral Source"
                                    />
                                </div>

                                {['text', 'number', 'textarea'].includes(formData.type) && (
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Placeholder</label>
                                        <input
                                            type="text"
                                            value={formData.placeholder || ''}
                                            onChange={e => setFormData({ ...formData, placeholder: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder="e.g., Enter source..."
                                        />
                                    </div>
                                )}

                                {['dropdown', 'radio'].includes(formData.type) && (
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Options (Comma separated)</label>
                                        <textarea
                                            value={optionsString}
                                            onChange={e => setOptionsString(e.target.value)}
                                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 outline-none h-24"
                                            placeholder="High, Medium, Low"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center pt-2">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.required}
                                            onChange={e => setFormData({ ...formData, required: e.target.checked })}
                                            className="form-checkbox w-5 h-5 text-primary rounded bg-muted border-border group-hover:border-primary transition-colors"
                                        />
                                        <span className="text-foreground/80 group-hover:text-foreground transition-colors">Required Field</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-border">
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : 'Save Field'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="bg-muted text-muted-foreground font-bold py-3 px-6 rounded-xl hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-xl flex flex-col">
                            <h2 className="text-lg font-bold text-foreground mb-6 flex items-center">
                                <EyeIcon className="w-5 h-5 mr-2 text-green-500" />
                                Live Preview
                            </h2>
                            <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 rounded-xl border border-dashed border-border">
                                <div className="w-full bg-card p-6 rounded-xl shadow-2xl border border-border">
                                    <PreviewField field={{
                                        ...formData,
                                        // Pass temp options string for immediate preview update
                                        options: optionsString.split(',')
                                    }} />
                                </div>
                            </div>
                            <p className="text-center text-xs text-muted-foreground mt-4">
                                This is how the field will appear in forms.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Simple EyeIcon import fix if missing from main icons file
function EyeIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
    );
}
