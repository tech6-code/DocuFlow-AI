
import type { Permission } from './types';

export const PERMISSION_MODULES = {
    'Dashboard': { actions: ['view'], description: "Control access to the main dashboard." },
    'Projects': { actions: ['view'], description: "Access the integrated project workspace." },
    'Departments': { actions: ['view', 'create', 'edit', 'delete'], description: "Manage company departments." },
    'User Management': { actions: ['view', 'create', 'edit', 'delete'], description: "Control access to user accounts." },
    'Customer Management': { actions: ['view', 'create', 'edit', 'delete'], description: "Manage customer profiles and data." },
    'Role Management': { actions: ['view', 'create', 'edit', 'delete'], description: "Control access to roles and permissions."},
    'Bank Statements': { actions: ['upload', 'view', 'export'], description: "Manage bank statement processing."},
    'Bank Statement Analysis': { actions: ['view', 'categorize', 'delete', 'export'], description: "View, categorize, and delete processed bank statements."},
    'Invoices & Bills': { actions: ['upload', 'view', 'export', 'manageKnowledgeBase'], description: "Manage invoice and bill processing."},
    'Official IDs': { actions: ['upload', 'view', 'export'], description: "Manage passports, visas, and Emirates IDs."},
    'Business Documents': { actions: ['upload', 'view', 'export'], description: "Manage trade licenses and other corporate documents."},
};

export const generatePermissions = (): Permission[] => {
    const permissions: Permission[] = [];
    for (const category in PERMISSION_MODULES) {
        const module = PERMISSION_MODULES[category as keyof typeof PERMISSION_MODULES];
        for (const action of module.actions) {
            const id = `${category.toLowerCase().replace(' & ', '-&-').replace(/ /g, '-')}:${action}`;
            
            // Create a more descriptive label
            let label = action.charAt(0).toUpperCase() + action.slice(1);
            label = label.replace(/([A-Z])/g, ' $1').trim(); // Add space before caps for camelCase
            
            permissions.push({
                id,
                label: `${label}`,
                description: `Allows user to ${action.toLowerCase()} ${category.toLowerCase()}.`,
                category: category,
            });
        }
    }
    return permissions;
};

export const ALL_PERMISSIONS: Permission[] = generatePermissions();
