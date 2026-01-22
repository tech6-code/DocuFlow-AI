import React from 'react';
import { CustomField } from '../services/salesSettingsService';

interface CustomFieldRendererProps {
    fields: CustomField[];
    data: Record<string, any>;
    onChange: (id: string, value: any) => void;
    disabled?: boolean;
    columns?: 1 | 2;
}

export const CustomFieldRenderer: React.FC<CustomFieldRendererProps> = ({
    fields,
    data,
    onChange,
    disabled = false,
    columns = 2
}) => {
    if (fields.length === 0) return null;

    const gridCols = columns === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2';

    return (
        <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
            {fields.map(field => {
                const value = data[field.id];
                const commonClasses = "w-full bg-gray-900 border border-gray-700 p-2.5 rounded-md text-white text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-70 border-gray-600";
                // Note: border-gray-600 added to match some specific styles if needed, or stick to border-gray-700

                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-xs font-medium text-gray-400">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>

                        {field.type === 'text' && (
                            <input
                                type="text"
                                disabled={disabled}
                                value={value || ''}
                                onChange={e => onChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className={commonClasses}
                            />
                        )}

                        {field.type === 'number' && (
                            <input
                                type="number"
                                disabled={disabled}
                                value={value || ''}
                                onChange={e => onChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className={commonClasses}
                            />
                        )}

                        {field.type === 'date' && (
                            <input
                                type="date"
                                disabled={disabled}
                                value={value || ''}
                                onChange={e => onChange(field.id, e.target.value)}
                                className={commonClasses}
                            />
                        )}

                        {field.type === 'textarea' && (
                            <textarea
                                rows={3}
                                disabled={disabled}
                                value={value || ''}
                                onChange={e => onChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className={commonClasses}
                            />
                        )}

                        {field.type === 'dropdown' && (
                            <select
                                disabled={disabled}
                                value={value || ''}
                                onChange={e => onChange(field.id, e.target.value)}
                                className={commonClasses}
                            >
                                <option value="">Select {field.label}</option>
                                {field.options?.map((opt, i) => (
                                    <option key={i} value={opt}>{opt}</option>
                                ))}
                            </select>
                        )}

                        {field.type === 'radio' && (
                            <div className="flex flex-wrap gap-4 pt-2">
                                {field.options?.map((opt, i) => (
                                    <label key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                                        <input
                                            type="radio"
                                            name={`field-${field.id}`}
                                            value={opt}
                                            checked={value === opt}
                                            onChange={e => onChange(field.id, e.target.value)}
                                            disabled={disabled}
                                            className="text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-600"
                                        />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        )}

                        {field.type === 'checkbox' && (
                            <label className="flex items-center gap-2 text-gray-300 pt-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={e => onChange(field.id, e.target.checked)}
                                    disabled={disabled}
                                    className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-600"
                                />
                                {field.label}
                            </label>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
