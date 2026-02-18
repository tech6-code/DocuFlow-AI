import React, { useState } from 'react';
import type { Department } from '../types';
import { XMarkIcon } from './icons';

interface DepartmentModalProps {
    department: Partial<Department> | null;
    onSave: (departmentData: { name: string; id?: string }) => void;
    onClose: () => void;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({ department, onSave, onClose }) => {
    const [name, setName] = useState(department?.name || '');
    const isEditing = !!department?.id;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave({ name, id: department?.id });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md m-4 border border-border">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-border flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-foreground">{isEditing ? 'Edit Department' : 'Add New Department'}</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted">
                            <XMarkIcon className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="p-6">
                        <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Department Name</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-muted text-foreground focus:ring-primary focus:border-primary"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="p-4 bg-muted/50 border-t border-border flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-muted border border-border text-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm">Save Department</button>
                    </div>
                </form>
            </div>
        </div>
    );
};