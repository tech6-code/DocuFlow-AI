import React, { useState, useMemo } from 'react';
import type { Department, User } from '../types';
import { PlusIcon, PencilIcon, TrashIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { DepartmentModal } from './DepartmentModal';

interface DepartmentManagementProps {
    departments: Department[];
    users: User[];
    onAddDepartment: (name: string) => void;
    onUpdateDepartment: (department: Department) => void;
    onDeleteDepartment: (departmentId: string) => void;
}

export const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ departments, users, onAddDepartment, onUpdateDepartment, onDeleteDepartment }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const { hasPermission } = useData();

    const canCreate = hasPermission('departments:create');
    const canEdit = hasPermission('departments:edit');
    const canDelete = hasPermission('departments:delete');

    const departmentUsage = useMemo(() => {
        const usageCount: Record<string, number> = {};
        for (const user of users) {
            usageCount[user.departmentId] = (usageCount[user.departmentId] || 0) + 1;
        }
        return usageCount;
    }, [users]);

    const handleOpenAddModal = () => {
        if (!canCreate) return;
        setEditingDepartment(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (department: Department) => {
        if (!canEdit) return;
        setEditingDepartment(department);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingDepartment(null);
    };

    const handleSaveDepartment = (departmentData: { name: string; id?: string }) => {
        if (departmentData.id) {
            onUpdateDepartment({ id: departmentData.id, name: departmentData.name });
        } else {
            onAddDepartment(departmentData.name);
        }
    };

    const handleDelete = (departmentId: string) => {
        if (canDelete && window.confirm("Are you sure you want to delete this department?")) {
            onDeleteDepartment(departmentId);
        }
    };

    return (
        <div>
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Departments</h2>
                        <p className="text-sm text-gray-400">Total departments: {departments.length}</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        disabled={!canCreate}
                        className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Department
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-semibold">Department Name</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Users</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.length > 0 ? (
                                departments.map(dept => {
                                    const usage = departmentUsage[dept.id] || 0;
                                    const isDeletable = usage === 0;

                                    return (
                                        <tr key={dept.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                            <td className="px-6 py-4 font-medium text-white">{dept.name}</td>
                                            <td className="px-6 py-4">{usage}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => handleOpenEditModal(dept)} disabled={!canEdit} className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        <PencilIcon className="w-4 h-4 text-gray-300" />
                                                    </button>
                                                    <div className="relative" title={!isDeletable ? `Cannot delete: ${usage} user(s) assigned` : ''}>
                                                        <button
                                                            onClick={() => handleDelete(dept.id)}
                                                            disabled={!canDelete || !isDeletable}
                                                            className="p-2 rounded hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <TrashIcon className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={3} className="text-center p-6 text-gray-500">
                                        No departments found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <DepartmentModal
                    department={editingDepartment}
                    onSave={handleSaveDepartment}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};