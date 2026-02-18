import React, { useState } from 'react';
import type { Role } from '../types';
import { XMarkIcon } from './icons';

interface RoleModalProps {
    role: Partial<Role> | null;
    onSave: (roleData: { name: string; description: string; id?: string }) => void;
    onClose: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({ role, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: role?.name || '',
        description: role?.description || '',
    });

    const isEditing = !!role?.id;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, id: role?.id });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md m-4 border border-border">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-border flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-foreground">{isEditing ? 'Edit Role' : 'Add New Role'}</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted">
                            <XMarkIcon className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">Role Name</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-border rounded-md bg-muted text-foreground focus:ring-primary focus:border-primary" required />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                            <input type="text" name="description" id="description" value={formData.description} onChange={handleChange} className="w-full p-2 border border-border rounded-md bg-muted text-foreground focus:ring-primary focus:border-primary" required />
                        </div>
                    </div>
                    <div className="p-4 bg-muted/50 border-t border-border flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-muted border border-border text-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm">Save Role</button>
                    </div>
                </form>
            </div>
        </div>
    );
};