import React, { useState, useMemo } from 'react';
import type { Department, User } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { DepartmentModal } from './DepartmentModal';
import { Pagination } from './Pagination';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
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

    const filteredDepartments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);
    const paginatedDepartments = filteredDepartments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to first page when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

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
            <div className="bg-card rounded-lg border border-border shadow-sm">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Departments</h2>
                        <p className="text-sm text-muted-foreground">Total departments: {departments.length}</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        disabled={!canCreate}
                        className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Department
                    </button>
                </div>
                <div className="p-4 border-b border-border">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search departments..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border border-border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition bg-muted text-foreground placeholder-muted-foreground/50 font-medium"
                            aria-label="Search departments"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-semibold">Department Name</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Users</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedDepartments.length > 0 ? (
                                paginatedDepartments.map(dept => {
                                    const usage = departmentUsage[dept.id] || 0;
                                    const isDeletable = usage === 0;

                                    return (
                                        <tr key={dept.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground">{dept.name}</td>
                                            <td className="px-6 py-4">{usage}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => handleOpenEditModal(dept)} disabled={!canEdit} className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                        <PencilIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                    <div className="relative" title={!isDeletable ? `Cannot delete: ${usage} user(s) assigned` : ''}>
                                                        <button
                                                            onClick={() => handleDelete(dept.id)}
                                                            disabled={!canDelete || !isDeletable}
                                                            className="p-2 rounded hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            <TrashIcon className="w-4 h-4 text-destructive" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={3} className="text-center p-6 text-muted-foreground font-medium">
                                        No departments found.
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
                    totalItems={filteredDepartments.length}
                    itemsPerPage={itemsPerPage}
                    itemName="departments"
                />
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