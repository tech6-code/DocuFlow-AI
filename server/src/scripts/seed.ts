
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  multipleStatements: true,
};

const DB_NAME = process.env.DB_NAME || 'docuflow';

async function seed() {
  console.log(`Connecting to MySQL at ${dbConfig.host}...`);
  const connection = await mysql.createConnection(dbConfig);

  console.log(`Creating database ${DB_NAME} if not exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.query(`USE \`${DB_NAME}\`;`);

  console.log('Resetting database...');

  await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

  const [rows]: any = await connection.query('SHOW TABLES');
  if (rows.length > 0) {
    const tables = rows.map((r: any) => Object.values(r)[0]);
    console.log(`Dropping tables: ${tables.join(', ')}`);
    for (const table of tables) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

  console.log('Creating tables...');

  const queries = [
    `CREATE TABLE IF NOT EXISTS roles (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      is_editable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      name VARCHAR(255),
      role_id CHAR(36),
      department_id CHAR(36),
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id CHAR(36),
      permission_id CHAR(36),
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS departments (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) PRIMARY KEY,
      cif VARCHAR(50),
      type VARCHAR(50),
      salutation VARCHAR(20),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      company_name VARCHAR(255),
      email VARCHAR(255),
      work_phone VARCHAR(50),
      mobile VARCHAR(50),
      currency VARCHAR(10),
      language VARCHAR(50),
      billing_address TEXT,
      shipping_address TEXT,
      remarks TEXT,
      entity_type VARCHAR(100),
      entity_sub_type VARCHAR(100),
      incorporation_date DATE,
      trade_license_authority VARCHAR(255),
      trade_license_number VARCHAR(100),
      trade_license_issue_date DATE,
      trade_license_expiry_date DATE,
      business_activity TEXT,
      is_freezone BOOLEAN,
      freezone_name VARCHAR(255),
      shareholders JSON,
      authorised_signatories JSON,
      share_capital VARCHAR(100),
      tax_treatment VARCHAR(100),
      trn VARCHAR(100),
      vat_registered_date DATE,
      first_vat_filing_period DATE,
      vat_filing_due_date DATE,
      vat_reporting_period VARCHAR(50),
      corporate_tax_treatment VARCHAR(100),
      corporate_tax_trn VARCHAR(100),
      corporate_tax_registered_date DATE,
      corporate_tax_period VARCHAR(100),
      first_corporate_tax_period_start DATE,
      first_corporate_tax_period_end DATE,
      corporate_tax_filing_due_date DATE,
      business_registration_number VARCHAR(100),
      place_of_supply VARCHAR(255),
      opening_balance DECIMAL(15, 2),
      payment_terms VARCHAR(100),
      owner_id CHAR(36),
      portal_access BOOLEAN,
      contact_persons JSON,
      custom_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      settings JSON
    )`,
    `CREATE TABLE IF NOT EXISTS customer_legal_docs (
      id CHAR(36) PRIMARY KEY,
      customer_id CHAR(36),
      uploader_id CHAR(36),
      document_type VARCHAR(100),
      file_path TEXT,
      file_name VARCHAR(255),
      file_size BIGINT,
      content_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36),
      date DATE,
      company_name VARCHAR(255),
      brand_id VARCHAR(100),
      mobile_number VARCHAR(50),
      email VARCHAR(255),
      lead_source VARCHAR(100),
      status VARCHAR(50),
      service_required_id VARCHAR(100),
      lead_qualification_id VARCHAR(100),
      lead_owner_id CHAR(36),
      remarks TEXT,
      last_contact DATE,
      closing_cycle INT,
      expected_closing DATE,
      is_active BOOLEAN default TRUE,
      custom_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS deals (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36),
      cif VARCHAR(50),
      deal_date DATE,
      name VARCHAR(255),
      company_name VARCHAR(255),
      brand VARCHAR(100),
      contact_number VARCHAR(50),
      email VARCHAR(255),
      lead_source VARCHAR(100),
      service TEXT,
      service_closed BOOLEAN,
      service_amount DECIMAL(15, 2),
      closing_date DATE,
      payment_status VARCHAR(50),
      custom_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS deals_follow_up (
      id CHAR(36) PRIMARY KEY,
      deal_id CHAR(36),
      user_id CHAR(36),
      follow_up DATETIME,
      start_time DATETIME,
      send_remainder BOOLEAN,
      remind_before_value INT,
      remind_before_unit VARCHAR(20),
      remarks TEXT,
      status VARCHAR(50),
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS deals_notes (
      id CHAR(36) PRIMARY KEY,
      deal_id CHAR(36),
      user_id CHAR(36),
      note_title VARCHAR(255),
      note_details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS deals_documents (
       id CHAR(36) PRIMARY KEY,
       deal_id CHAR(36),
       uploader_id CHAR(36),
       document_type VARCHAR(100),
       file_path TEXT,
       file_name VARCHAR(255),
       file_size BIGINT,
       content_type VARCHAR(100),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
     )`,
    `CREATE TABLE IF NOT EXISTS lead_sources (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS service_required (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS lead_qualifications (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS brands (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS lead_owners (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS custom_fields (
      id CHAR(36) PRIMARY KEY,
      module VARCHAR(50),
      label VARCHAR(255),
      type VARCHAR(50),
      required BOOLEAN,
      options JSON,
      sort_order INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ct_types (id CHAR(36) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ct_filing_period (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36),
      customer_id CHAR(36),
      ct_type_id CHAR(36),
      period_from DATE,
      period_to DATE,
      due_date DATE,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const q of queries) {
    console.log(`Executing: ${q.substring(0, 50)}...`);
    await connection.query(q);
  }
  console.log('Tables created.');

  // Seeds
  const superAdminRoleId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash('password123', 10);

  // Check if roles exist
  const [roles]: any = await connection.query('SELECT * FROM roles WHERE name = ?', ['Super Admin']);

  let roleIdToUse = superAdminRoleId;

  if (roles.length === 0) {
    await connection.query('INSERT INTO roles (id, name, description, is_editable) VALUES (?, ?, ?, ?)',
      [superAdminRoleId, 'Super Admin', 'Full access to everything', false]);
    console.log('Super Admin role created');
  } else {
    roleIdToUse = roles[0].id;
  }

  // Check if admin user exists
  const [users]: any = await connection.query('SELECT * FROM users WHERE email = ?', ['admin@docuflow.com']);
  if (users.length === 0) {
    await connection.query('INSERT INTO users (id, email, password, name, role_id) VALUES (?, ?, ?, ?, ?)',
      [userId, 'admin@docuflow.com', passwordHash, 'System Admin', roleIdToUse]);
    console.log('Admin user created (admin@docuflow.com / password123)');
  }

  const permissionsList = [
    { slug: 'user-management:create', name: 'Create Users', category: 'User Management' },
    { slug: 'user-management:edit', name: 'Edit Users', category: 'User Management' },
    { slug: 'user-management:delete', name: 'Delete Users', category: 'User Management' },
    { slug: 'user-management:view', name: 'View Users', category: 'User Management' },

    { slug: 'role-management:create', name: 'Create Roles', category: 'Role Management' },
    { slug: 'role-management:edit', name: 'Edit Roles', category: 'Role Management' },
    { slug: 'role-management:delete', name: 'Delete Roles', category: 'Role Management' },
    { slug: 'role-management:view', name: 'View Roles', category: 'Role Management' },

    { slug: 'customer-management:create', name: 'Create Customers', category: 'Customer Management' },
    { slug: 'customer-management:edit', name: 'Edit Customers', category: 'Customer Management' },
    { slug: 'customer-management:delete', name: 'Delete Customers', category: 'Customer Management' },
    { slug: 'customer-management:view', name: 'View Customers', category: 'Customer Management' },

    { slug: 'sales-leads:create', name: 'Create Leads', category: 'Sales' },
    { slug: 'sales-leads:edit', name: 'Edit Leads', category: 'Sales' },
    { slug: 'sales-leads:delete', name: 'Delete Leads', category: 'Sales' },
    { slug: 'sales-leads:view', name: 'View Leads', category: 'Sales' },

    { slug: 'sales-deals:create', name: 'Create Deals', category: 'Sales' },
    { slug: 'sales-deals:edit', name: 'Edit Deals', category: 'Sales' },
    { slug: 'sales-deals:delete', name: 'Delete Deals', category: 'Sales' },
    { slug: 'sales-deals:view', name: 'View Deals', category: 'Sales' },

    { slug: 'departments:create', name: 'Create Departments', category: 'Departments' },
    { slug: 'departments:edit', name: 'Edit Departments', category: 'Departments' },
    { slug: 'departments:delete', name: 'Delete Departments', category: 'Departments' },
    { slug: 'departments:view', name: 'View Departments', category: 'Departments' },
  ];

  for (const p of permissionsList) {
    const [existing]: any = await connection.query('SELECT id FROM permissions WHERE slug = ?', [p.slug]);
    let permId = existing[0]?.id;
    if (!permId) {
      permId = randomUUID();
      await connection.query('INSERT INTO permissions (id, name, slug, category) VALUES (?, ?, ?, ?)', [permId, p.name, p.slug, p.category]);
    }

    const [assigned]: any = await connection.query('SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?', [roleIdToUse, permId]);
    if (assigned.length === 0) {
      await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIdToUse, permId]);
    }
  }

  console.log('Seed completed successfully.');
  await connection.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
