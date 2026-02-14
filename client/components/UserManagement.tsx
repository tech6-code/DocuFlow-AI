
import React, { useState } from 'react';
import type { User, Role, Department } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon, EyeIcon, EyeSlashIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { Pagination } from './Pagination';





interface UserManagementProps {
    users: User[];
    roles: Role[];
    departments: Department[];
    onAddUser: (user: Omit<User, 'id'>) => void;
    onUpdateUser: (user: User) => void;
    onDeleteUser: (userId: string) => void;
}

const UserModal = ({
    user,
    roles,
    departments,
    onSave,
    onClose
}: {
    user: Partial<User> | null,
    roles: Role[],
    departments: Department[],
    onSave: (user: Omit<User, 'id'> | User) => void,
    onClose: () => void
}) => {
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: user?.password || '',
        roleId: user?.roleId || '',
        departmentId: user?.departmentId || ''
    });
    const [showPassword, setShowPassword] = useState(false);

    const isEditing = !!user?.id;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing) {
            onSave({ ...user, ...formData } as User);
        } else {
            onSave(formData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md m-4 border border-gray-700">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-white">{isEditing ? 'Edit User' : 'Add New User'}</h3>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                            <XMarkIcon className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-white focus:border-white" required />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-white focus:border-white" required />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    id="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder={isEditing ? "(Unchanged)" : "Enter password"}
                                    className="w-full p-2 pr-10 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-white focus:border-white"
                                    required={!isEditing}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white focus:outline-none"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="roleId" className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                            <select name="roleId" id="roleId" value={formData.roleId} onChange={handleChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-white focus:border-white" required>
                                <option value="" disabled>Select a role</option>
                                {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="departmentId" className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                            <select name="departmentId" id="departmentId" value={formData.departmentId} onChange={handleChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-white focus:border-white">
                                <option value="">None</option>
                                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-800/50 border-t border-gray-800 flex justify-end space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-700 border border-gray-600 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm">Save User</button>
                    </div>
                </form>
            </div>
        </div>
    )

}

export const UserManagement: React.FC<UserManagementProps> = ({ users, roles, departments, onAddUser, onUpdateUser, onDeleteUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { hasPermission } = useData();

    const canCreate = hasPermission('user-management:create');
    const canEdit = hasPermission('user-management:edit');
    const canDelete = hasPermission('user-management:delete');

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to first page when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleOpenAddModal = () => {
        if (!canCreate) return;
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        if (!canEdit) return;
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSaveUser = (user: Omit<User, 'id'> | User) => {
        if ('id' in user) {
            onUpdateUser(user);
        } else {
            onAddUser(user);
        }
    };

    const handleDelete = (userId: string) => {
        if (canDelete && window.confirm("Are you sure you want to delete this user?")) {
            onDeleteUser(userId);
        }
    };

    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Unknown Role';
    const getDepartmentName = (deptId: string) => departments.find(d => d.id === deptId)?.name || 'None';

    return (
        <div>
            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Users</h2>
                        <p className="text-sm text-gray-400">Total users: {users.length}</p>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        disabled={!canCreate}
                        className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" /> Add User
                    </button>
                </div>
                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border border-gray-600 rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none transition bg-gray-800 text-white"
                            aria-label="Search users"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-semibold">Name</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Role</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Department</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedUsers.length > 0 ? (
                                paginatedUsers.map(user => (
                                    <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-white">{user.name}</p>
                                            <p className="text-gray-400">{user.email}</p>
                                        </td>
                                        <td className="px-6 py-4">{getRoleName(user.roleId)}</td>
                                        <td className="px-6 py-4">{getDepartmentName(user.departmentId)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => handleOpenEditModal(user)} disabled={!canEdit} className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <PencilIcon className="w-4 h-4 text-gray-300" />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} disabled={!canDelete} className="p-2 rounded hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <TrashIcon className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center p-6 text-gray-500">
                                        No users found.
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
                    totalItems={filteredUsers.length}
                    itemsPerPage={itemsPerPage}
                    itemName="users"
                />
            </div>

            {isModalOpen && (
                <UserModal
                    user={editingUser}
                    roles={roles}
                    departments={departments}
                    onSave={handleSaveUser}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};
