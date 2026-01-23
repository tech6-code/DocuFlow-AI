-- Migration: Add granular CRUD permissions for Sales module
-- Date: 2026-01-23
-- Description: Adds Create, Edit, and Delete permissions for Sales Leads, Deals, Settings, and Custom Fields

-- Sales - Leads Permissions
INSERT INTO permissions (id, label, description, category) VALUES
('sales-leads:create', 'Create Leads', 'Access to create new sales leads', 'Sales'),
('sales-leads:edit', 'Edit Leads', 'Access to edit existing sales leads', 'Sales'),
('sales-leads:delete', 'Delete Leads', 'Access to delete sales leads', 'Sales');

-- Sales - Deals Permissions
INSERT INTO permissions (id, label, description, category) VALUES
('sales-deals:create', 'Create Deals', 'Access to create new deals', 'Sales'),
('sales-deals:edit', 'Edit Deals', 'Access to edit existing deals', 'Sales'),
('sales-deals:delete', 'Delete Deals', 'Access to delete deals', 'Sales');

-- Sales - Settings Permissions
INSERT INTO permissions (id, label, description, category) VALUES
('sales-settings:create', 'Add Sales Settings', 'Access to add sales configuration options', 'Sales'),
('sales-settings:edit', 'Edit Sales Settings', 'Access to edit sales configuration options', 'Sales'),
('sales-settings:delete', 'Delete Sales Settings', 'Access to delete sales configuration options', 'Sales');

-- Sales - Custom Fields Permissions
INSERT INTO permissions (id, label, description, category) VALUES
('sales-custom-fields:create', 'Create Custom Fields', 'Access to create custom fields for sales', 'Sales'),
('sales-custom-fields:edit', 'Edit Custom Fields', 'Access to edit custom fields for sales', 'Sales'),
('sales-custom-fields:delete', 'Delete Custom Fields', 'Access to delete custom fields for sales', 'Sales');

-- Optional: Grant all new permissions to Super Admin role
-- Uncomment the following lines if you want to automatically grant these permissions to Super Admin
-- INSERT INTO role_permissions (role_id, permission_id)
-- SELECT r.id, p.id
-- FROM roles r, permissions p
-- WHERE r.name = 'Super Admin'
-- AND p.id IN (
--   'sales-leads:create', 'sales-leads:edit', 'sales-leads:delete',
--   'sales-deals:create', 'sales-deals:edit', 'sales-deals:delete',
--   'sales-settings:create', 'sales-settings:edit', 'sales-settings:delete',
--   'sales-custom-fields:create', 'sales-custom-fields:edit', 'sales-custom-fields:delete'
-- );
